import type { SupabaseClient } from "@supabase/supabase-js";
import type { LocationRow, SearchResultRow } from "@/lib/matching/types";
import { PROCEDURE_CODE } from "@/lib/matching/types";

export interface ProvinceOption {
  province: string;
  province_slug: string;
  region: string;
}

/** Distinct published provinces, for the home page dropdown and /locations grouping. */
export async function getProvinces(supabase: SupabaseClient): Promise<ProvinceOption[]> {
  const { data, error } = await supabase
    .from("locations")
    .select("province, province_slug, region")
    .eq("moderation_status", "published")
    .order("province", { ascending: true });

  if (error) throw error;

  const seen = new Map<string, ProvinceOption>();
  for (const row of data ?? []) {
    if (!seen.has(row.province_slug)) {
      seen.set(row.province_slug, row as ProvinceOption);
    }
  }
  return [...seen.values()];
}

export async function getPublishedLocationsGroupedByProvince(
  supabase: SupabaseClient
): Promise<Map<string, LocationRow[]>> {
  const { data, error } = await supabase
    .from("locations")
    .select("*")
    .eq("moderation_status", "published")
    .order("province", { ascending: true })
    .order("name", { ascending: true });

  if (error) throw error;

  const grouped = new Map<string, LocationRow[]>();
  for (const row of (data ?? []) as LocationRow[]) {
    const list = grouped.get(row.province) ?? [];
    list.push(row);
    grouped.set(row.province, list);
  }
  return grouped;
}

export interface ProvinceGroup {
  province: string;
  provinceSlug: string;
  region: string;
  offices: Pick<LocationRow, "id" | "name" | "city" | "type" | "address">[];
}

/**
 * Flattens the province->offices Map into the shape /locations renders: one
 * group per province, alphabetised the Spanish way, carrying only the fields
 * the list shows.
 *
 * Derives `provinceSlug`/`region` from the group's own rows rather than joining
 * against getProvinces(): the offices are the source of truth, so a province
 * can never appear with an empty office list — which is what made the old
 * two-step picker look broken after a province was chosen.
 */
export function toProvinceGroups(grouped: Map<string, LocationRow[]>): ProvinceGroup[] {
  return [...grouped.entries()]
    .filter(([, offices]) => offices.length > 0)
    .map(([province, offices]) => ({
      province,
      provinceSlug: offices[0].province_slug,
      region: offices[0].region,
      offices: offices.map((office) => ({
        id: office.id,
        name: office.name,
        city: office.city,
        type: office.type,
        address: office.address,
      })),
    }))
    .sort((a, b) => a.province.localeCompare(b.province, "es"));
}

export async function getLocationById(
  supabase: SupabaseClient,
  id: string
): Promise<LocationRow | null> {
  const { data, error } = await supabase.from("locations").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as LocationRow | null;
}

/**
 * Calls fn_search_results, returning locations in the exact order the
 * matching function already sorted them in (fresh matches desc, latest match
 * date desc, province asc — see supabase/migrations/0021).
 *
 * `provinceSlug` null searches all of Spain, which is what the search form
 * does: one office per province takes applications, so the result is one
 * card per province. A slug is still honoured for old shared links.
 */
export async function searchLocations(
  supabase: SupabaseClient,
  params: { provinceSlug: string | null; userDocs: string[]; militaryFilter: string | null }
): Promise<{ location: LocationRow; data: SearchResultRow["data"] }[]> {
  const { data: rpcData, error } = await supabase.rpc("fn_search_results", {
    p_province_slug: params.provinceSlug,
    p_procedure_code: PROCEDURE_CODE,
    p_user_docs: params.userDocs,
    p_military_filter: params.militaryFilter,
  });
  if (error) throw error;

  const rows = (rpcData ?? []) as SearchResultRow[];
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.location_id);
  const { data: locations, error: locError } = await supabase
    .from("locations")
    .select("*")
    .in("id", ids);
  if (locError) throw locError;

  const byId = new Map((locations as LocationRow[]).map((l) => [l.id, l]));
  return rows
    .map((r) => ({ location: byId.get(r.location_id), data: r.data }))
    .filter((r): r is { location: LocationRow; data: SearchResultRow["data"] } => !!r.location);
}
