import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { searchLocations, getProvinces } from "@/lib/data/locations";
import { LocationCard } from "@/components/results/LocationCard";
import { Disclaimer } from "@/components/shared/Disclaimer";
import { normalizeDocsParam } from "@/lib/searchParams";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

interface RawSearchParams {
  province?: string;
  docs?: string | string[];
  mil?: string;
  page?: string;
}

interface ResultsPageProps {
  searchParams: Promise<RawSearchParams>;
}

function buildQueryString(params: RawSearchParams, overrides: Record<string, string>): string {
  const qs = new URLSearchParams();
  if (params.province) qs.set("province", params.province);
  for (const d of normalizeDocsParam(params.docs)) qs.append("docs", d);
  if (params.mil) qs.set("mil", params.mil);
  for (const [key, value] of Object.entries(overrides)) qs.set(key, value);
  return qs.toString();
}

export default async function ResultsPage({ searchParams }: ResultsPageProps) {
  const params = await searchParams;
  const t = await getTranslations("results");
  const supabase = await createClient();

  const provinceSlug = params.province ?? "";
  const userDocs = normalizeDocsParam(params.docs);
  const militaryFilter = params.mil ?? null;
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);

  const [results, provinces] = await Promise.all([
    provinceSlug ? searchLocations(supabase, { provinceSlug, userDocs, militaryFilter }) : Promise.resolve([]),
    getProvinces(supabase),
  ]);

  const province = provinces.find((p) => p.province_slug === provinceSlug);
  const totalPages = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const pageResults = results.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const anyFreshMatches = results.some((r) => r.data.fresh_matching_count > 0);
  const cardSearchQuery = buildQueryString(params, {});

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 p-4">
      <h1 className="text-xl font-semibold">{t("title", { province: province?.province ?? provinceSlug })}</h1>

      {results.length === 0 ? (
        <div className="rounded-md border border-[var(--border)] p-4 text-sm">
          <p>{t("noLocations")}</p>
          <Link href="/locations/new" className="mt-2 inline-block underline">
            {t("noLocationsCta")}
          </Link>
        </div>
      ) : (
        <>
          {!anyFreshMatches ? (
            <div className="rounded-md border border-[var(--border)] p-3 text-sm">
              <p>{t("noMatchingReports")}</p>
              <Link href="/locations" className="mt-1 inline-block underline">
                {t("addReportCta")}
              </Link>
            </div>
          ) : null}

          <ul className="flex flex-col gap-3">
            {pageResults.map((r) => (
              <LocationCard key={r.location.id} location={r.location} data={r.data} searchQuery={cardSearchQuery} />
            ))}
          </ul>

          {totalPages > 1 ? (
            <nav aria-label="pagination" className="flex items-center justify-between text-sm">
              <span>{t("pageInfo", { page, totalPages })}</span>
              <span className="flex gap-2">
                {page > 1 ? (
                  <Link href={`/results?${buildQueryString(params, { page: String(page - 1) })}`} className="underline">
                    ←
                  </Link>
                ) : null}
                {page < totalPages ? (
                  <Link href={`/results?${buildQueryString(params, { page: String(page + 1) })}`} className="underline">
                    →
                  </Link>
                ) : null}
              </span>
            </nav>
          ) : null}
        </>
      )}

      <Disclaimer />
    </main>
  );
}
