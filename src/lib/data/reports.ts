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

  for (const r of reports ?? []) {
    result.set(r.id, { ...r, documents: docsByReport.get(r.id) ?? [] });
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

  for (const c of (data ?? []) as CommentRow[]) {
    const list = grouped.get(c.report_id) ?? [];
    list.push(c);
    grouped.set(c.report_id, list);
  }
  return grouped;
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
