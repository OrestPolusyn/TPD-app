"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import type { DocumentTypeRow } from "@/lib/data/documentTypes";
import type { DocumentCode, DocumentStatus } from "@/lib/matching/types";
import { EARLIEST_EVENT_DATE } from "@/lib/validation/reportSchema";
import { MainButtonBridge } from "@/components/telegram/MainButtonBridge";

type DocState = "" | DocumentStatus;

interface FormValues {
  event_date: string;
  outcome: string;
  documents: Record<string, DocState>;
  appointment_type: string;
  earliest_appointment_offered: string;
  time_at_office: string;
  people_count: string;
  requested_list_complete: "" | "true" | "false";
  military_obligations_apply: string;
  comment: string;
}

const OUTCOMES = [
  "protection_granted",
  "application_accepted_pending",
  "turned_away",
  "could_not_get_appointment",
] as const;

const APPOINTMENT_TYPES = ["booked_online_icp", "booked_by_email_or_phone", "walk_in"] as const;
const TIME_AT_OFFICE = ["under_1h", "1_to_3h", "over_3h", "multiple_visits"] as const;
const DOC_STATUSES = ["requested", "requested_missing", "not_requested"] as const;

export interface ReportFormLabels {
  eventDateLabel: string;
  requiredField: string;
  outcomeLabel: string;
  outcomeRequired: string;
  outcomes: Record<(typeof OUTCOMES)[number], string>;
  documentsQuestionCombined: string;
  documentsHint: string;
  otherDocumentHint: string;
  docStatusUnknown: string;
  docStatus: Record<(typeof DOC_STATUSES)[number], string>;
  appointmentTypeLabel: string;
  appointmentTypes: Record<(typeof APPOINTMENT_TYPES)[number], string>;
  earliestAppointmentLabel: string;
  timeAtOfficeLabel: string;
  timeAtOffice: Record<(typeof TIME_AT_OFFICE)[number], string>;
  peopleCountLabel: string;
  requestedListCompleteLabel: string;
  requestedListCompleteRequired: string;
  yes: string;
  no: string;
  militaryQuestionLabel: string;
  militaryOptionYes: string;
  militaryOptionNo: string;
  militaryOptionPreferNotToSay: string;
  commentLabel: string;
  commentHint: string;
  duplicateNotice: string;
  duplicateNoticeLink: string;
  dailyLimitReached: string;
  errorGeneric: string;
  submitButton: string;
  submitting: string;
}

export function ReportForm({
  locationId,
  documentTypes,
  labels,
}: {
  locationId: string;
  documentTypes: DocumentTypeRow[];
  labels: ReportFormLabels;
}) {
  const router = useRouter();
  const idPrefix = useId();
  const [submitError, setSubmitError] = useState<"duplicate" | "daily_limit" | "generic" | null>(null);
  const [duplicateLink, setDuplicateLink] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      event_date: "",
      outcome: "",
      documents: Object.fromEntries(documentTypes.map((d) => [d.code, ""])),
      appointment_type: "",
      earliest_appointment_offered: "",
      time_at_office: "",
      people_count: "",
      requested_list_complete: "",
      military_obligations_apply: "",
      comment: "",
    },
  });

  const otherStatus = watch(`documents.other` as const);

  async function onSubmit(values: FormValues) {
    setSubmitError(null);
    setDuplicateLink(null);
    setSubmitting(true);
    try {
      const documents = Object.entries(values.documents)
        .filter(([, status]) => status !== "")
        .map(([document_code, status]) => ({ document_code: document_code as DocumentCode, status: status as DocumentStatus }));

      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location_id: locationId,
          event_date: values.event_date,
          outcome: values.outcome,
          documents,
          appointment_type: values.appointment_type || null,
          earliest_appointment_offered: values.earliest_appointment_offered || null,
          time_at_office: values.time_at_office || null,
          people_count: values.people_count ? Number(values.people_count) : null,
          requested_list_complete: values.requested_list_complete === "true",
          military_obligations_apply: values.military_obligations_apply || null,
          comment: values.comment.trim() || null,
        }),
      });

      if (res.status === 409) {
        const body = await res.json();
        setDuplicateLink(body.existingReportId ? `/locations/${locationId}#report-${body.existingReportId}` : null);
        setSubmitError("duplicate");
        return;
      }
      if (res.status === 429) {
        setSubmitError("daily_limit");
        return;
      }
      if (!res.ok) {
        setSubmitError("generic");
        return;
      }

      router.push(`/locations/${locationId}`);
      router.refresh();
    } catch {
      setSubmitError("generic");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form id="report-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5" noValidate>
      <div>
        <label htmlFor={`${idPrefix}-event_date`} className="mb-1 block text-sm font-medium">
          {labels.eventDateLabel}
        </label>
        <input
          id={`${idPrefix}-event_date`}
          type="date"
          min={EARLIEST_EVENT_DATE}
          max={new Date().toISOString().slice(0, 10)}
          aria-describedby={errors.event_date ? `${idPrefix}-event_date-error` : undefined}
          className="w-full rounded-md border border-[var(--border)] bg-transparent p-2"
          {...register("event_date", { required: true })}
        />
        {errors.event_date ? (
          <p id={`${idPrefix}-event_date-error`} role="alert" className="mt-1 text-sm text-red-600">
            {labels.requiredField}
          </p>
        ) : null}
      </div>

      <fieldset>
        <legend className="mb-1 text-sm font-medium">{labels.outcomeLabel}</legend>
        <div className="flex flex-col gap-1">
          {OUTCOMES.map((o) => (
            <label key={o} className="flex items-center gap-2 text-sm">
              <input type="radio" value={o} {...register("outcome", { required: true })} />
              {labels.outcomes[o]}
            </label>
          ))}
        </div>
        {errors.outcome ? (
          <p role="alert" className="mt-1 text-sm text-red-600">
            {labels.outcomeRequired}
          </p>
        ) : null}
      </fieldset>

      <fieldset>
        <legend className="mb-1 text-sm font-medium">{labels.documentsQuestionCombined}</legend>
        <p className="mb-2 text-xs text-[var(--muted)]">{labels.documentsHint}</p>
        <div className="flex flex-col gap-3">
          {documentTypes.map((d) => (
            <div key={d.code} className="flex flex-col gap-1 border-b border-[var(--border)] pb-2 text-sm">
              <span>{d.label_uk}</span>
              <div className="flex flex-wrap gap-3">
                <label className="flex items-center gap-1">
                  <input type="radio" value="" {...register(`documents.${d.code}` as const)} defaultChecked />
                  {labels.docStatusUnknown}
                </label>
                {DOC_STATUSES.map((status) => (
                  <label key={status} className="flex items-center gap-1">
                    <input type="radio" value={status} {...register(`documents.${d.code}` as const)} />
                    {labels.docStatus[status]}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
        {otherStatus === "requested" || otherStatus === "requested_missing" ? (
          <p className="mt-1 text-xs text-[var(--muted)]">{labels.otherDocumentHint}</p>
        ) : null}
      </fieldset>

      <div>
        <label htmlFor={`${idPrefix}-appointment_type`} className="mb-1 block text-sm font-medium">
          {labels.appointmentTypeLabel}
        </label>
        <select
          id={`${idPrefix}-appointment_type`}
          className="w-full rounded-md border border-[var(--border)] bg-transparent p-2"
          {...register("appointment_type")}
        >
          <option value="">—</option>
          {APPOINTMENT_TYPES.map((k) => (
            <option key={k} value={k}>
              {labels.appointmentTypes[k]}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor={`${idPrefix}-earliest`} className="mb-1 block text-sm font-medium">
          {labels.earliestAppointmentLabel}
        </label>
        <input
          id={`${idPrefix}-earliest`}
          type="date"
          className="w-full rounded-md border border-[var(--border)] bg-transparent p-2"
          {...register("earliest_appointment_offered")}
        />
      </div>

      <div>
        <label htmlFor={`${idPrefix}-time`} className="mb-1 block text-sm font-medium">
          {labels.timeAtOfficeLabel}
        </label>
        <select id={`${idPrefix}-time`} className="w-full rounded-md border border-[var(--border)] bg-transparent p-2" {...register("time_at_office")}>
          <option value="">—</option>
          {TIME_AT_OFFICE.map((k) => (
            <option key={k} value={k}>
              {labels.timeAtOffice[k]}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor={`${idPrefix}-people`} className="mb-1 block text-sm font-medium">
          {labels.peopleCountLabel}
        </label>
        <input
          id={`${idPrefix}-people`}
          type="number"
          min={1}
          max={10}
          className="w-24 rounded-md border border-[var(--border)] bg-transparent p-2"
          {...register("people_count")}
        />
      </div>

      <fieldset>
        <legend className="mb-1 text-sm font-medium">{labels.requestedListCompleteLabel}</legend>
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-1">
            <input type="radio" value="true" {...register("requested_list_complete", { required: true })} />
            {labels.yes}
          </label>
          <label className="flex items-center gap-1">
            <input type="radio" value="false" {...register("requested_list_complete", { required: true })} />
            {labels.no}
          </label>
        </div>
        {errors.requested_list_complete ? (
          <p role="alert" className="mt-1 text-sm text-red-600">
            {labels.requestedListCompleteRequired}
          </p>
        ) : null}
      </fieldset>

      <fieldset>
        <legend className="mb-1 text-sm font-medium">{labels.militaryQuestionLabel}</legend>
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-1">
            <input type="radio" value="yes" {...register("military_obligations_apply")} />
            {labels.militaryOptionYes}
          </label>
          <label className="flex items-center gap-1">
            <input type="radio" value="no" {...register("military_obligations_apply")} />
            {labels.militaryOptionNo}
          </label>
          <label className="flex items-center gap-1">
            <input type="radio" value="prefer_not_to_say" {...register("military_obligations_apply")} />
            {labels.militaryOptionPreferNotToSay}
          </label>
        </div>
      </fieldset>

      <div>
        <label htmlFor={`${idPrefix}-comment`} className="mb-1 block text-sm font-medium">
          {labels.commentLabel}
        </label>
        <p className="mb-1 text-xs text-[var(--muted)]">{labels.commentHint}</p>
        <Controller
          control={control}
          name="comment"
          render={({ field }) => (
            <textarea
              id={`${idPrefix}-comment`}
              maxLength={1000}
              rows={4}
              className="w-full rounded-md border border-[var(--border)] bg-transparent p-2"
              {...field}
            />
          )}
        />
      </div>

      {submitError === "duplicate" ? (
        <p role="alert" className="text-sm text-red-600">
          {labels.duplicateNotice}{" "}
          {duplicateLink ? (
            <a href={duplicateLink} className="underline">
              {labels.duplicateNoticeLink}
            </a>
          ) : null}
        </p>
      ) : submitError === "daily_limit" ? (
        <p role="alert" className="text-sm text-red-600">
          {labels.dailyLimitReached}
        </p>
      ) : submitError === "generic" ? (
        <p role="alert" className="text-sm text-red-600">
          {labels.errorGeneric}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-[var(--accent)] px-4 py-2 font-medium text-[var(--accent-contrast)] disabled:opacity-50"
      >
        {submitting ? labels.submitting : labels.submitButton}
      </button>
      <MainButtonBridge formId="report-form" text={labels.submitButton} />
    </form>
  );
}
