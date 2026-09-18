import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getPublishedLocationsGroupedByProvince, toProvinceGroups } from "@/lib/data/locations";
import { LocationBrowser, type BrowserProvince } from "@/components/locations/LocationBrowser";
import { Card } from "@/components/shared/Card";

export const dynamic = "force-dynamic";

interface LocationsPageProps {
  /** `?office=<id>` from the old two-step picker is redirected in src/proxy.ts. */
  searchParams: Promise<{ province?: string }>;
}

export default async function LocationsPage({ searchParams }: LocationsPageProps) {
  const params = await searchParams;
  const t = await getTranslations("locations");
  const tLocation = await getTranslations("location");
  const tResults = await getTranslations("results");
  const supabase = await createClient();

  // One query instead of the two the wizard made: LocationRow already carries
  // province, province_slug and region, so getProvinces() is redundant here.
  const grouped = await getPublishedLocationsGroupedByProvince(supabase);
  const provinces: BrowserProvince[] = toProvinceGroups(grouped).map((group) => ({
    ...group,
    officeCountLabel: t("officeCount", { count: group.offices.length }),
  }));

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">{t("intro")}</p>
      </div>

      {provinces.length === 0 ? (
        <Card className="text-sm">
          <p>{tResults("noLocations")}</p>
          <Link href="/locations/new" className="mt-2 inline-block underline">
            {tResults("noLocationsCta")}
          </Link>
        </Card>
      ) : (
        <LocationBrowser
          provinces={provinces}
          initialProvinceSlug={params.province}
          labels={{
            searchLabel: t("searchLabel"),
            searchPlaceholder: t("searchPlaceholder"),
            noMatches: t("noMatches"),
            addressUnknown: tLocation("addressUnknown"),
            typeCreade: t("typeCreade"),
            typePoliceStation: t("typePoliceStation"),
          }}
        />
      )}
    </main>
  );
}
