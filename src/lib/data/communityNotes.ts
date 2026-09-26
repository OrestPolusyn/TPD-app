import type { SupabaseClient } from "@supabase/supabase-js";

export type BriefStance = "still_true" | "changed";

/**
 * What the community chats say an office needs, in bullet form.
 *
 * Two short lists rather than a paragraph or a stack of cards: "which
 * documents" is the question almost every chat message asks, and the answer
 * has to fit on a phone screen above the office's actual reports. Confirmed
 * or disputed as a whole (location_brief_confirmations, migration 0019).
 */
export interface CommunityBrief {
  documents: string[];
  info: string[];
  /** Newest observation date among the bullets. */
  observed_on: string;
  still_true: number;
  changed: number;
  my_stance: BriefStance | null;
}

export async function getCommunityBrief(
  supabase: SupabaseClient,
  locationId: string,
  userId: string | null
): Promise<CommunityBrief | null> {
  const [notesResult, confirmationsResult, channelResult] = await Promise.all([
    supabase
      .from("community_notes")
      .select("kind, body, observed_on")
      .eq("location_id", locationId)
      .eq("moderation_status", "published")
      .order("position", { ascending: true }),
    supabase.from("location_brief_confirmations").select("user_id, stance").eq("location_id", locationId),
    // "✅ Актуально" taps under this office's posts in the Telegram channel.
    supabase.rpc("channel_confirmations", { p_location_id: locationId }),
  ]);
  if (notesResult.error) throw notesResult.error;
  if (confirmationsResult.error) throw confirmationsResult.error;

  const notes = (notesResult.data ?? []) as { kind: "document" | "info"; body: string; observed_on: string }[];
  if (notes.length === 0) return null;

  const confirmations = (confirmationsResult.data ?? []) as { user_id: string; stance: BriefStance }[];

  return {
    documents: notes.filter((n) => n.kind === "document").map((n) => n.body),
    info: notes.filter((n) => n.kind === "info").map((n) => n.body),
    observed_on: notes.map((n) => n.observed_on).sort().at(-1)!,
    still_true:
      confirmations.filter((c) => c.stance === "still_true").length +
      (channelResult.error ? 0 : Number(channelResult.data) || 0),
    changed: confirmations.filter((c) => c.stance === "changed").length,
    my_stance: confirmations.find((c) => c.user_id === userId)?.stance ?? null,
  };
}

/**
 * Enough people say the brief is out of date that it should be read as a
 * lead rather than as current practice. Same threshold the flag mechanism
 * uses for reports: three people, and more of them than those who confirmed.
 */
export function isBriefDisputed(brief: Pick<CommunityBrief, "still_true" | "changed">): boolean {
  return brief.changed >= 3 && brief.changed > brief.still_true;
}

export interface OfficeUpdate {
  location_id: string;
  city: string;
  name: string;
  /** When the newest of these bullets was added. */
  added_at: string;
  bullets: string[];
}

/**
 * Card bullets added recently, grouped by office, newest office first — the
 * "what changed" half of /feed. By when a bullet was added, not the date it
 * describes: a fact from 23.09 added today is today's news on this site.
 */
export async function getRecentOfficeUpdates(supabase: SupabaseClient, days = 14, limit = 12): Promise<OfficeUpdate[]> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const { data, error } = await supabase
    .from("community_notes")
    .select("location_id, body, kind, created_at, locations!inner(city, name)")
    .eq("moderation_status", "published")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) throw error;

  type Row = { location_id: string; body: string; kind: string; created_at: string; locations: { city: string; name: string } };
  const byOffice = new Map<string, OfficeUpdate>();
  for (const row of (data ?? []) as unknown as Row[]) {
    const entry = byOffice.get(row.location_id) ?? {
      location_id: row.location_id,
      city: row.locations.city,
      name: row.locations.name,
      added_at: row.created_at,
      bullets: [],
    };
    entry.bullets.push(row.body);
    byOffice.set(row.location_id, entry);
  }
  return [...byOffice.values()].slice(0, limit);
}
