import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getLocationById, getProvinces, getPublishedLocationsGroupedByProvince } from "@/lib/data/locations";
import { getActiveDocumentTypes } from "@/lib/data/documentTypes";
import { ReportForm, type ReportFormLabels } from "@/components/reports/ReportForm";
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
    tCommon,
    tOutcomes,
    tAppointmentTypes,
    tTimeAtOffice,
    tDocStatus,
    tAuth,
    tHome,
    tErrors,
  ] = await Promise.all([
    supabase.auth.getUser(),
    getTranslations("reportForm"),
    getTranslations("common"),
    getTranslations("outcomes"),
    getTranslations("appointmentTypes"),
    getTranslations("timeAtOffice"),
    getTranslations("documentStatus"),
    getTranslations("auth"),
    getTranslations("home"),
    getTranslations("errors"),
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

  const labels: ReportFormLabels = {
    eventDateLabel: tReportForm("eventDateLabel"),
    requiredField: tCommon("requiredField"),
    outcomeLabel: tReportForm("outcomeLabel"),
    outcomeRequired: tReportForm("validation.outcomeRequired"),
    outcomes: {
      protection_granted: tOutcomes("protection_granted"),
      application_accepted_pending: tOutcomes("application_accepted_pending"),
      turned_away: tOutcomes("turned_away"),
      could_not_get_appointment: tOutcomes("could_not_get_appointment"),
    },
    documentsSectionTitle: tReportForm("documentsSectionTitle"),
    documentSelectLabel: tReportForm("documentSelectLabel"),
    documentSelectPlaceholder: tReportForm("documentSelectPlaceholder"),
    documentStatusLabel: tReportForm("documentStatusLabel"),
    addDocumentButton: tReportForm("addDocumentButton"),
    removeDocumentButton: tReportForm("removeDocumentButton"),
    otherDocumentHint: tReportForm("otherDocumentHint"),
    docStatus: {
      requested: tDocStatus("requested"),
      requested_missing: tDocStatus("requested_missing"),
    },
    appointmentTypeLabel: tReportForm("appointmentTypeLabel"),
    appointmentTypes: {
      booked_online_icp: tAppointmentTypes("booked_online_icp"),
      booked_by_email_or_phone: tAppointmentTypes("booked_by_email_or_phone"),
      walk_in: tAppointmentTypes("walk_in"),
    },
    earliestAppointmentLabel: tReportForm("earliestAppointmentLabel"),
    timeAtOfficeLabel: tReportForm("timeAtOfficeLabel"),
    timeAtOffice: {
      under_1h: tTimeAtOffice("under_1h"),
      "1_to_3h": tTimeAtOffice("1_to_3h"),
      over_3h: tTimeAtOffice("over_3h"),
      multiple_visits: tTimeAtOffice("multiple_visits"),
    },
    peopleCountLabel: tReportForm("peopleCountLabel"),
    militaryQuestionLabel: tReportForm("militaryQuestionLabel"),
    militaryOptionYes: tHome("militaryOptionYes"),
    militaryOptionNo: tHome("militaryOptionNo"),
    militaryOptionPreferNotToSay: tHome("militaryOptionPreferNotToSay"),
    commentLabel: tReportForm("commentLabel"),
    commentHint: tReportForm("commentHint"),
    duplicateNotice: tReportForm("duplicateNotice"),
    duplicateNoticeLink: tReportForm("duplicateNoticeLink"),
    dailyLimitReached: tReportForm("dailyLimitReached"),
    errorGeneric: tCommon("errorGeneric"),
    submitButton: tReportForm("submitButton"),
    submitting: tCommon("submitting"),
  };

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
