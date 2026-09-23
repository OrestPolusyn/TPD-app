import type { SupabaseClient } from "@supabase/supabase-js";
import type { ModerationStatus } from "@/lib/matching/types";
import { getPublicProfiles, type PublicProfile } from "@/lib/data/reports";

export type NoteStance = "still_true" | "changed";

/** How many confirmers' faces a note shows before collapsing into "+N". */
export const SHOWN_CONFIRMERS = 5;

export interface CommunityNote {
  id: string;
  location_id: string;
  body: string;
  observed_on: string;
  source: string;
  moderation_status: ModerationStatus;
  still_true: number;
  changed: number;
  /** The first few people who said "still true", for the faces row. */
  confirmers: PublicProfile[];
  /** What the current reader has said about it, if anything. */
  my_stance: NoteStance | null;
}

export interface CommunityNoteWithLocation extends CommunityNote {
  location_name: string;
  city: string;
  province: string;
}

interface NoteRow {
  id: string;
  location_id: string;
  body: string;
  observed_on: string;
  source: string;
  moderation_status: ModerationStatus;
}

const NOTE_COLUMNS = "id, location_id, body, observed_on, source, moderation_status";

/**
 * Attaches each note's confirmation tally, the faces behind it and the
 * reader's own stance.
 *
 * Two queries for the whole page rather than one per note: the counts are
 * read from community_note_confirmations (publicly readable by design, see
 * supabase/migrations/0017) and aggregated here, because a denormalised
 * counter column would need a trigger to stay honest and would still not
 * answer "did *I* confirm this".
 */
async function withConfirmations<T extends NoteRow>(
  supabase: SupabaseClient,
  rows: T[],
  userId: string | null
): Promise<(T & Omit<CommunityNote, keyof NoteRow>)[]> {
  if (rows.length === 0) return [];

  const { data, error } = await supabase
    .from("community_note_confirmations")
    .select("note_id, user_id, stance, created_at")
    .in("note_id", rows.map((r) => r.id))
    .order("created_at", { ascending: true });
  if (error) throw error;

  const confirmations = (data ?? []) as { note_id: string; user_id: string; stance: NoteStance }[];

  const stillTrueUsers = new Map<string, string[]>();
  const changedCount = new Map<string, number>();
  const mine = new Map<string, NoteStance>();
  for (const c of confirmations) {
    if (c.stance === "still_true") {
      const list = stillTrueUsers.get(c.note_id) ?? [];
      list.push(c.user_id);
      stillTrueUsers.set(c.note_id, list);
    } else {
      changedCount.set(c.note_id, (changedCount.get(c.note_id) ?? 0) + 1);
    }
    if (userId && c.user_id === userId) mine.set(c.note_id, c.stance);
  }

  // Only the faces actually rendered are looked up — a note with 200
  // confirmations must not turn into a 200-row profile query.
  const shownIds = [...stillTrueUsers.values()].flatMap((users) => users.slice(0, SHOWN_CONFIRMERS));
  const profiles = await getPublicProfiles(supabase, shownIds);

  return rows.map((row) => {
    const users = stillTrueUsers.get(row.id) ?? [];
    return {
      ...row,
      still_true: users.length,
      changed: changedCount.get(row.id) ?? 0,
      confirmers: users
        .slice(0, SHOWN_CONFIRMERS)
        .map((id) => profiles.get(id))
        .filter((p): p is PublicProfile => !!p),
      my_stance: mine.get(row.id) ?? null,
    };
  });
}

/**
 * Ordering the community controls: the claims it has confirmed most come
 * first, ones it has marked as no longer true sink to the bottom.
 *
 * Deliberately not chronological. Every note imported from a chat digest
 * carries the same date, so date-ordering would be arbitrary; confirmations
 * are the only signal here that a reader actually contributed.
 */
function byStanding(a: CommunityNote, b: CommunityNote): number {
  const stale = (n: CommunityNote) => (n.moderation_status === "published" ? 0 : 1);
  if (stale(a) !== stale(b)) return stale(a) - stale(b);
  if (a.still_true !== b.still_true) return b.still_true - a.still_true;
  return b.observed_on.localeCompare(a.observed_on);
}

export async function getCommunityNotesForLocation(
  supabase: SupabaseClient,
  locationId: string,
  userId: string | null
): Promise<CommunityNote[]> {
  const { data, error } = await supabase
    .from("community_notes")
    .select(NOTE_COLUMNS)
    .eq("location_id", locationId)
    .in("moderation_status", ["published", "flagged"])
    .order("observed_on", { ascending: false });
  if (error) throw error;

  const notes = await withConfirmations(supabase, (data ?? []) as NoteRow[], userId);
  return notes.sort(byStanding);
}

/**
 * The newest community claims across every location, for /feed.
 *
 * `locations!inner` both supplies the office name and drops notes whose
 * location is not visible to this reader — an unpublished location's rows are
 * filtered by its own RLS policy, and an inner join turns that into "no note"
 * rather than "a note with no name".
 */
export async function getRecentCommunityNotes(
  supabase: SupabaseClient,
  userId: string | null,
  limit = 25
): Promise<CommunityNoteWithLocation[]> {
  const { data, error } = await supabase
    .from("community_notes")
    .select(`${NOTE_COLUMNS}, locations!inner(name, city, province)`)
    .in("moderation_status", ["published", "flagged"])
    .order("observed_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;

  type JoinedRow = NoteRow & { locations: { name: string; city: string; province: string } };
  const rows = (data ?? []) as unknown as JoinedRow[];
  const withCounts = await withConfirmations(supabase, rows, userId);

  return withCounts.map(({ locations, ...note }) => ({
    ...note,
    location_name: locations.name,
    city: locations.city,
    province: locations.province,
  }));
}
