import type { SupabaseClient } from "@supabase/supabase-js";
import { countReportsSince } from "@/lib/data/reports";

/** What /feed shows at most — the bell never promises more than the feed delivers. */
export const FEED_RULE_CHANGES = 5;
export const FEED_OFFICE_UPDATES = 12;

/**
 * How many things on /feed are new since `sinceIso`: reports, rule changes,
 * and offices whose card gained a bullet. Offices rather than bullets — a
 * dozen facts added to Zaragoza's card at once is one piece of news, not
 * twelve.
 */
export async function countFeedItemsSince(supabase: SupabaseClient, sinceIso: string): Promise<number> {
  const [reports, rules, notes] = await Promise.all([
    countReportsSince(supabase, sinceIso),
    supabase.from("rule_changes").select("id", { count: "exact", head: true }).gt("created_at", sinceIso),
    supabase.from("community_notes").select("location_id").eq("moderation_status", "published").gt("created_at", sinceIso).limit(1000),
  ]);
  const offices = new Set((notes.data ?? []).map((n) => n.location_id as string)).size;
  return reports + Math.min(rules.count ?? 0, FEED_RULE_CHANGES) + Math.min(offices, FEED_OFFICE_UPDATES);
}
