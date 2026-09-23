import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ReportOutcome,
  AppointmentType,
  TimeAtOffice,
  MilitaryObligations,
  DocumentCode,
  DocumentStatus,
  ModerationStatus,
} from "@/lib/matching/types";

export interface ReportDetail {
  id: string;
  event_date: string;
  outcome: ReportOutcome;
  appointment_type: AppointmentType | null;
  earliest_appointment_offered: string | null;
  time_at_office: TimeAtOffice | null;
  people_count: number | null;
  requested_list_complete: boolean;
  military_obligations_apply: MilitaryObligations | null;
  comment: string | null;
  moderation_status: ModerationStatus;
  documents: { document_code: DocumentCode; status: DocumentStatus }[];
  author_name: string;
  author_avatar_url: string | null;
}

export interface PublicProfile {
  display_name: string;
  avatar_url: string | null;
}

/**
 * Name + avatar for a set of user ids, via the public_profiles view — the
 * only path that can read another user's identity at all (profiles itself is
 * owner-only RLS; this view exposes just id/display_name/avatar_url, see
 * supabase/migrations/0012). A missing id (deleted account) falls back to the
 * same generic label the DB uses, so callers never need a null check.
 */
export async function getPublicProfiles(
  supabase: SupabaseClient,
  userIds: string[]
): Promise<Map<string, PublicProfile>> {
  const result = new Map<string, PublicProfile>();
  const uniqueIds = [...new Set(userIds)];
  if (uniqueIds.length === 0) return result;

  const { data, error } = await supabase.from("public_profiles").select("id, display_name, avatar_url").in("id", uniqueIds);
  if (error) throw error;

  for (const p of data ?? []) {
    result.set(p.id, { display_name: p.display_name, avatar_url: p.avatar_url });
  }
  return result;
}

/** One user's display name — the same one their submissions are signed with. */
export async function getDisplayName(supabase: SupabaseClient, userId: string): Promise<string> {
  const profiles = await getPublicProfiles(supabase, [userId]);
  return profiles.get(userId)?.display_name ?? "";
}

function authorOf(profiles: Map<string, PublicProfile>, userId: string): { author_name: string; author_avatar_url: string | null } {
  const profile = profiles.get(userId);
  return { author_name: profile?.display_name ?? "Користувач", author_avatar_url: profile?.avatar_url ?? null };
}

/** Full report rows + their document entries, for rendering report cards. */
export async function getReportDetails(
  supabase: SupabaseClient,
  reportIds: string[]
): Promise<Map<string, ReportDetail>> {
  const result = new Map<string, ReportDetail>();
  if (reportIds.length === 0) return result;

  const [{ data: reports, error: reportsError }, { data: docs, error: docsError }] = await Promise.all([
    supabase.from("reports").select("*").in("id", reportIds),
    supabase.from("report_documents").select("*").in("report_id", reportIds),
  ]);
  if (reportsError) throw reportsError;
  if (docsError) throw docsError;

  const docsByReport = new Map<string, { document_code: DocumentCode; status: DocumentStatus }[]>();
  for (const d of docs ?? []) {
    const list = docsByReport.get(d.report_id) ?? [];
    list.push({ document_code: d.document_code, status: d.status });
    docsByReport.set(d.report_id, list);
  }

  const profiles = await getPublicProfiles(supabase, (reports ?? []).map((r) => r.user_id));

  for (const r of reports ?? []) {
    result.set(r.id, { ...r, documents: docsByReport.get(r.id) ?? [], ...authorOf(profiles, r.user_id) });
  }
  return result;
}

/**
 * Reports on this location currently collapsed behind moderation (3+ flags),
 * per docs/SPEC.md: "stays public but collapsed with the label 'На перевірці'".
 * RLS already restricts this to moderation_status in ('published','flagged'),
 * so this plain select only ever returns flagged rows here by construction.
 */
export async function getFlaggedReportsForLocation(
  supabase: SupabaseClient,
  locationId: string,
  procedureCode: string
): Promise<ReportDetail[]> {
  const { data, error } = await supabase
    .from("reports")
    .select("*")
    .eq("location_id", locationId)
    .eq("procedure_code", procedureCode)
    .eq("moderation_status", "flagged");
  if (error) throw error;

  const details = await getReportDetails(supabase, (data ?? []).map((r) => r.id));
  return [...details.values()];
}

export interface CommentRow {
  id: string;
  report_id: string;
  body: string;
  moderation_status: ModerationStatus;
  created_at: string;
  author_name: string;
  author_avatar_url: string | null;
}

export async function getCommentsForReports(
  supabase: SupabaseClient,
  reportIds: string[]
): Promise<Map<string, CommentRow[]>> {
  const grouped = new Map<string, CommentRow[]>();
  if (reportIds.length === 0) return grouped;

  const { data, error } = await supabase
    .from("comments")
    .select("*")
    .in("report_id", reportIds)
    .order("created_at", { ascending: true });
  if (error) throw error;

  const rows = (data ?? []) as (CommentRow & { user_id: string })[];
  const profiles = await getPublicProfiles(supabase, rows.map((c) => c.user_id));

  for (const c of rows) {
    const list = grouped.get(c.report_id) ?? [];
    list.push({ ...c, ...authorOf(profiles, c.user_id) });
    grouped.set(c.report_id, list);
  }
  return grouped;
}

export interface RecentReport {
  id: string;
  location_id: string;
  location_name: string;
  event_date: string;
  outcome: ReportOutcome;
  comment: string | null;
  author_name: string;
  author_avatar_url: string | null;
}

/**
 * The newest published reports across every location.
 *
 * Ordered by created_at, not event_date: this answers "what has been added
 * since I last looked", and someone can file a report about a visit from
 * months ago.
 */
export async function getRecentReports(supabase: SupabaseClient, limit = 25): Promise<RecentReport[]> {
  const { data, error } = await supabase
    .from("reports")
    .select("id, location_id, event_date, outcome, comment, user_id")
    .eq("moderation_status", "published")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;

  const rows = (data ?? []) as (Omit<RecentReport, "location_name" | "author_name" | "author_avatar_url"> & {
    user_id: string;
  })[];
  if (rows.length === 0) return [];

  const [profiles, { data: locations, error: locationsError }] = await Promise.all([
    getPublicProfiles(supabase, rows.map((r) => r.user_id)),
    supabase.from("locations").select("id, name").in("id", [...new Set(rows.map((r) => r.location_id))]),
  ]);
  if (locationsError) throw locationsError;

  const names = new Map((locations ?? []).map((l) => [l.id, l.name as string]));

  return rows.map((r) => ({
    id: r.id,
    location_id: r.location_id,
    location_name: names.get(r.location_id) ?? r.location_id,
    event_date: r.event_date,
    outcome: r.outcome,
    comment: r.comment,
    ...authorOf(profiles, r.user_id),
  }));
}

/** How many published reports arrived after a given moment. */
export async function countReportsSince(supabase: SupabaseClient, sinceIso: string): Promise<number> {
  const { count, error } = await supabase
    .from("reports")
    .select("id", { count: "exact", head: true })
    .eq("moderation_status", "published")
    .gt("created_at", sinceIso);
  if (error) throw error;
  return count ?? 0;
}

/**
 * A single own report with its documents, for the edit form. Scoped to
 * userId explicitly rather than relying on RLS alone, same reasoning as
 * getOwnReports in src/lib/data/me.ts.
 */
export async function getOwnReportForEdit(
  supabase: SupabaseClient,
  userId: string,
  reportId: string
): Promise<(ReportDetail & { location_id: string }) | null> {
  const { data: report, error } = await supabase
    .from("reports")
    .select("*")
    .eq("id", reportId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!report) return null;

  const { data: docs, error: docsError } = await supabase
    .from("report_documents")
    .select("document_code, status")
    .eq("report_id", reportId);
  if (docsError) throw docsError;

  return { ...report, documents: (docs ?? []) as ReportDetail["documents"] };
}
