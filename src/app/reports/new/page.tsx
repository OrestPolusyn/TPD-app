import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getLocationById } from "@/lib/data/locations";
import { getActiveDocumentTypes } from "@/lib/data/documentTypes";
import { ReportForm, type ReportFormLabels } from "@/components/reports/ReportForm";

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
    tNav,
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
    getTranslations("nav"),
    getTranslations("errors"),
  ]);

  if (!locationId) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-3 p-4">
        <p className="text-sm">{tReportForm("chooseLocationFirst")}</p>
        <Link href="/locations" className="underline text-sm">
          {tNav("locations")}
        </Link>
      </main>
    );
  }

  const location = await getLocationById(supabase, locationId);
  if (!location || location.moderation_status !== "published") {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-3 p-4">
        <p className="text-sm">{tErrors("notFound")}</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-3 p-4">
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
    documentsQuestionCombined: tReportForm("documentsQuestionCombined"),
    documentsHint: tReportForm("documentsHint"),
    otherDocumentHint: tReportForm("otherDocumentHint"),
    docStatusUnknown: tDocStatus("unknown"),
    docStatus: {
      requested: tDocStatus("requested"),
      requested_missing: tDocStatus("requested_missing"),
      not_requested: tDocStatus("not_requested"),
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
    requestedListCompleteLabel: tReportForm("requestedListCompleteLabel"),
    requestedListCompleteRequired: tReportForm("validation.requestedListCompleteRequired"),
    yes: tCommon("yes"),
    no: tCommon("no"),
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

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 p-4">
      <h1 className="text-xl font-semibold">{tReportForm("title")}</h1>
      <p className="text-sm text-[var(--muted)]">{location.name}</p>
      <ReportForm locationId={location.id} documentTypes={documentTypes} labels={labels} />
    </main>
  );
}
