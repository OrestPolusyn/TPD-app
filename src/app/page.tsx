import Link from "next/link";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getPublishedLocationsGroupedByProvince } from "@/lib/data/locations";
import { getActiveDocumentTypes } from "@/lib/data/documentTypes";
import { SearchForm } from "@/components/search/SearchForm";
import { Card } from "@/components/shared/Card";
import { LocationsMapLoader } from "@/components/home/LocationsMapLoader";
import { ClientErrorBoundary } from "@/components/shared/ClientErrorBoundary";
import { LoadingIndicator } from "@/components/shared/LoadingIndicator";

export const dynamic = "force-dynamic";

/**
 * The map and the search form each own their Supabase queries behind their own
 * <Suspense> boundary, so the headings and the "share your experience" card
 * paint immediately and each half fills in on its own. Previously the page
 * awaited all three queries before returning any markup, which on a phone
 * looked like a dead tap.
 */
async function MapSection({ openLocationLabel }: { openLocationLabel: string }) {
  const supabase = await createClient();
  const grouped = await getPublishedLocationsGroupedByProvince(supabase);
  const mapLocations = [...grouped.values()].flat().map((l) => ({ id: l.id, name: l.name, city: l.city }));

  return <LocationsMapLoader locations={mapLocations} openLocationLabel={openLocationLabel} />;
}

async function SearchSection() {
  const supabase = await createClient();
  const documentTypes = await getActiveDocumentTypes(supabase);

  return <SearchForm documentTypes={documentTypes} />;
}

export default async function HomePage() {
  const t = await getTranslations("home");
  const tResults = await getTranslations("results");

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("title")}</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">{t("subtitle")}</p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div className="flex min-h-[320px] flex-col gap-2">
          <h2 className="font-medium">{t("mapSectionTitle")}</h2>
          <ClientErrorBoundary
            fallback={
              <div className="flex min-h-[320px] items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-center text-sm text-[var(--muted)]">
                {t("mapUnavailable")}
              </div>
            }
          >
            <Suspense
              fallback={
                <div className="h-full min-h-[320px] w-full animate-pulse rounded-xl bg-[var(--surface)]" aria-hidden="true" />
              }
            >
              <MapSection openLocationLabel={tResults("card.openLocation")} />
            </Suspense>
          </ClientErrorBoundary>
          <p className="text-xs text-[var(--muted)]">{t("mapCaption")}</p>
        </div>
        <div className="flex flex-col gap-3">
          <h2 className="font-medium">{t("searchSectionTitle")}</h2>
          <Suspense
            fallback={
              <div className="flex flex-col gap-3">
                <LoadingIndicator />
                <div className="h-10 w-full animate-pulse rounded-md bg-[var(--surface)]" aria-hidden="true" />
                <div className="h-40 w-full animate-pulse rounded-md bg-[var(--surface)]" aria-hidden="true" />
                <div className="h-10 w-1/3 animate-pulse rounded-md bg-[var(--surface)]" aria-hidden="true" />
              </div>
            }
          >
            <SearchSection />
          </Suspense>
        </div>
      </div>

      <Card className="flex flex-col gap-2">
        <h2 className="font-medium">{t("shareSectionTitle")}</h2>
        <p className="text-sm text-[var(--muted)]">{t("shareSectionBody")}</p>
        <Link
          href="/reports/new"
          className="mt-1 self-start rounded-full border border-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--accent)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--accent-contrast)]"
        >
          {t("shareSectionCta")}
        </Link>
      </Card>
    </main>
  );
}
