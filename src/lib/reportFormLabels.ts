import { getTranslations } from "next-intl/server";
import type { ReportFormLabels } from "@/components/reports/ReportForm";

/** Shared between /reports/new and /reports/[id]/edit so both stay in sync. */
export async function buildReportFormLabels(): Promise<ReportFormLabels> {
  const [tReportForm, tCommon, tOutcomes, tAppointmentTypes, tTimeAtOffice, tDocStatus, tHome] = await Promise.all([
    getTranslations("reportForm"),
    getTranslations("common"),
    getTranslations("outcomes"),
    getTranslations("appointmentTypes"),
    getTranslations("timeAtOffice"),
    getTranslations("documentStatus"),
    getTranslations("home"),
  ]);

  return {
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
    saveButton: tReportForm("saveButton"),
    submitting: tCommon("submitting"),
  };
}
