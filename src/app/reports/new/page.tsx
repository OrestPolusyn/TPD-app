import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getLocationById, getProvinces, getPublishedLocationsGroupedByProvince } from "@/lib/data/locations";
import { getActiveDocumentTypes } from "@/lib/data/documentTypes";
import { ReportForm } from "@/components/reports/ReportForm";
import { buildReportFormLabels } from "@/lib/reportFormLabels";
import { ShareExperienceFlow } from "@/components/reports/ShareExperienceFlow";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ location?: string }>;
}

export default async function NewReportPage({ searchParams }: PageProps) {
  const { location: locationId } = await searchParams;
  const supabase = await createClient();
  const [
    {
      data: { user },
    },
    tReportForm,
    tAuth,
    tErrors,
    labels,
  ] = await Promise.all([
    supabase.auth.getUser(),
    getTranslations("reportForm"),
    getTranslations("auth"),
    getTranslations("errors"),
    buildReportFormLabels(),
  ]);

  if (!user) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-3 p-4 sm:p-6">
        <p className="text-sm">{tAuth("loginHint")}</p>
        <Link href="/me" className="underline text-sm">
          {tAuth("loginTitle")}
        </Link>
      </main>
    );
  }

  const documentTypes = await getActiveDocumentTypes(supabase);

  if (!locationId) {
    const tLocations = await getTranslations("locations");
    const [provinces, grouped] = await Promise.all([
      getProvinces(supabase),
      getPublishedLocationsGroupedByProvince(supabase),
    ]);
    const locations = [...grouped.values()].flat().map((l) => ({
      id: l.id,
      name: l.name,
      province_slug: l.province_slug,
      city: l.city,
    }));

    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 p-4 sm:p-6">
        <h1 className="text-2xl font-bold tracking-tight">{tReportForm("title")}</h1>
        <ShareExperienceFlow
          provinces={provinces}
          locations={locations}
          documentTypes={documentTypes}
          pickerLabels={{
            provinceLabel: tLocations("provinceLabel"),
            provincePlaceholder: tLocations("provincePlaceholder"),
            officeLabel: tLocations("officeLabel"),
            officePlaceholder: tLocations("officePlaceholder"),
          }}
          reportFormLabels={labels}
        />
      </main>
    );
  }

  const location = await getLocationById(supabase, locationId);
  if (!location || location.moderation_status !== "published") {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-3 p-4 sm:p-6">
        <p className="text-sm">{tErrors("notFound")}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 p-4 sm:p-6">
      <h1 className="text-2xl font-bold tracking-tight">{tReportForm("title")}</h1>
      <p className="text-sm text-[var(--muted)]">{location.name}</p>
      <ReportForm locationId={location.id} documentTypes={documentTypes} labels={labels} />
    </main>
  );
}
