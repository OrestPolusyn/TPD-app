import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getProvinces, getPublishedLocationsGroupedByProvince } from "@/lib/data/locations";
import { getActiveDocumentTypes } from "@/lib/data/documentTypes";
import { SearchForm } from "@/components/search/SearchForm";
import { Card } from "@/components/shared/Card";
import { LocationsMapLoader } from "@/components/home/LocationsMapLoader";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const t = await getTranslations("home");
  const tResults = await getTranslations("results");
  const supabase = await createClient();
  const [provinces, documentTypes, grouped] = await Promise.all([
    getProvinces(supabase),
    getActiveDocumentTypes(supabase),
    getPublishedLocationsGroupedByProvince(supabase),
  ]);
  const mapLocations = [...grouped.values()].flat().map((l) => ({ id: l.id, name: l.name, city: l.city }));

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("title")}</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">{t("subtitle")}</p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div className="flex min-h-[320px] flex-col gap-2">
          <h2 className="font-medium">{t("mapSectionTitle")}</h2>
          <LocationsMapLoader locations={mapLocations} openLocationLabel={tResults("card.openLocation")} />
          <p className="text-xs text-[var(--muted)]">{t("mapCaption")}</p>
        </div>
        <div className="flex flex-col gap-3">
          <h2 className="font-medium">{t("searchSectionTitle")}</h2>
          <SearchForm provinces={provinces} documentTypes={documentTypes} />
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
