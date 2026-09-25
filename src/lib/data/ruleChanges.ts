import type { SupabaseClient } from "@supabase/supabase-js";

export interface RuleChange {
  id: number;
  location_id: string | null;
  effective_date: string;
  title: string;
  city: string | null;
  location_name: string | null;
}

/**
 * Dated rule changes, newest first (future-dated ones — "очікується" — on
 * top). See supabase/migrations/0029 for why these are not policy_changes.
 */
export async function getRuleChanges(
  supabase: SupabaseClient,
  opts: { locationId?: string; limit?: number } = {}
): Promise<RuleChange[]> {
  let query = supabase
    .from("rule_changes")
    .select("id, location_id, effective_date, title, locations(city, name)")
    .order("effective_date", { ascending: false })
    .order("id", { ascending: false });
  if (opts.locationId) query = query.eq("location_id", opts.locationId);
  if (opts.limit) query = query.limit(opts.limit);

  const { data, error } = await query;
  if (error) throw error;

  type Row = { id: number; location_id: string | null; effective_date: string; title: string; locations: { city: string; name: string } | null };
  return ((data ?? []) as unknown as Row[]).map((r) => ({
    id: r.id,
    location_id: r.location_id,
    effective_date: r.effective_date,
    title: r.title,
    city: r.locations?.city ?? null,
    location_name: r.locations?.name ?? null,
  }));
}
