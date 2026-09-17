import type { SupabaseClient } from "@supabase/supabase-js";
import type { ModerationStatus } from "@/lib/matching/types";

export interface OwnReportRow {
  id: string;
  location_id: string;
  event_date: string;
  outcome: string;
  moderation_status: ModerationStatus;
}

export interface OwnCommentRow {
  id: string;
  report_id: string;
  body: string;
  moderation_status: ModerationStatus;
  created_at: string;
}

export interface OwnSuggestionRow {
  id: string;
  location_id: string;
  field: string;
  current_value: string | null;
  proposed_value: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
}

/** RLS's "published or own" SELECT policy is a visibility gate, not a "mine
 * only" filter — every query here explicitly scopes to userId too. */
export async function getOwnReports(supabase: SupabaseClient, userId: string): Promise<OwnReportRow[]> {
  const { data, error } = await supabase
    .from("reports")
    .select("id, location_id, event_date, outcome, moderation_status")
    .eq("user_id", userId)
    .order("event_date", { ascending: false });
  if (error) throw error;
  return (data ?? []) as OwnReportRow[];
}

export async function getOwnComments(supabase: SupabaseClient, userId: string): Promise<OwnCommentRow[]> {
  const { data, error } = await supabase
    .from("comments")
    .select("id, report_id, body, moderation_status, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as OwnCommentRow[];
}

export async function getOwnSuggestions(supabase: SupabaseClient, userId: string): Promise<OwnSuggestionRow[]> {
  const { data, error } = await supabase
    .from("location_suggestions")
    .select("id, location_id, field, current_value, proposed_value, status, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as OwnSuggestionRow[];
}
