"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import type { DocumentTypeRow } from "@/lib/data/documentTypes";
import type { DocumentCode } from "@/lib/matching/types";
import { EARLIEST_EVENT_DATE } from "@/lib/validation/reportSchema";
import { MainButtonBridge } from "@/components/telegram/MainButtonBridge";

/**
 * Only the two statuses the simplified form collects: the exhaustive
 * "documents NOT requested" tracking that used to pair with this (and the "do
 * you remember everything you were asked" question that qualified it) is
 * gone — reported per feedback as confusing rather than useful.
 */
type DocStatus = "requested" | "requested_missing";

interface DocumentRowValue {
  document_code: DocumentCode | "";
  status: DocStatus;
}

interface FormValues {
  event_date: string;
  outcome: string;
  documents: DocumentRowValue[];
  appointment_type: string;
  earliest_appointment_offered: string;
  time_at_office: string;
  people_count: string;
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
const DOC_STATUSES = ["requested", "requested_missing"] as const;

export interface ReportFormLabels {
  eventDateLabel: string;
  requiredField: string;
  outcomeLabel: string;
  outcomeRequired: string;
  outcomes: Record<(typeof OUTCOMES)[number], string>;
  documentsSectionTitle: string;
  documentSelectLabel: string;
  documentSelectPlaceholder: string;
  documentStatusLabel: string;
  docStatus: Record<(typeof DOC_STATUSES)[number], string>;
  addDocumentButton: string;
  removeDocumentButton: string;
  otherDocumentHint: string;
  appointmentTypeLabel: string;
  appointmentTypes: Record<(typeof APPOINTMENT_TYPES)[number], string>;
  earliestAppointmentLabel: string;
  timeAtOfficeLabel: string;
  timeAtOffice: Record<(typeof TIME_AT_OFFICE)[number], string>;
  peopleCountLabel: string;
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
  /** Shown instead of submitButton when reportId is set (editing). */
  saveButton: string;
  submitting: string;
}

const EMPTY_ROW: DocumentRowValue = { document_code: "", status: "requested" };

export function ReportForm({
  locationId,
  documentTypes,
  labels,
  initialValues,
  reportId,
}: {
  locationId: string;
  documentTypes: DocumentTypeRow[];
  labels: ReportFormLabels;
  /** Present when editing an existing report; prefills the form. */
  initialValues?: Partial<FormValues>;
  /** Present when editing: PATCHes this report and returns to it instead of POSTing a new one. */
  reportId?: string;
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
      documents: [EMPTY_ROW],
      appointment_type: "",
      earliest_appointment_offered: "",
      time_at_office: "",
      people_count: "",
      military_obligations_apply: "",
      comment: "",
      ...initialValues,
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "documents" });
  const documentValues = watch("documents");
  const pickedElsewhere = (index: number) =>
    new Set(documentValues.filter((_, i) => i !== index).map((d) => d.document_code).filter(Boolean));

  async function onSubmit(values: FormValues) {
    setSubmitError(null);
    setDuplicateLink(null);
    setSubmitting(true);
    try {
      const documents = values.documents
        .filter((d): d is { document_code: DocumentCode; status: DocStatus } => d.document_code !== "")
        .map((d) => ({ document_code: d.document_code, status: d.status }));

      const res = await fetch(reportId ? `/api/reports/${reportId}` : "/api/reports", {
        method: reportId ? "PATCH" : "POST",
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
          // No longer asked: the exhaustive checklist this used to qualify is
          // gone, so there is nothing left for "complete" to be relative to.
          requested_list_complete: true,
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

      router.push(reportId ? `/locations/${locationId}#report-${reportId}` : `/locations/${locationId}`);
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
          <p id={`${idPrefix}-event_date-error`} role="alert" className="mt-1 text-sm text-[var(--danger)]">
            {labels.requiredField}
          </p>
        ) : null}
      </div>

      <fieldset aria-describedby={errors.outcome ? `${idPrefix}-outcome-error` : undefined}>
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
          <p id={`${idPrefix}-outcome-error`} role="alert" className="mt-1 text-sm text-[var(--danger)]">
            {labels.outcomeRequired}
          </p>
        ) : null}
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-medium">{labels.documentsSectionTitle}</legend>
        {fields.map((field, index) => {
          const taken = pickedElsewhere(index);
          const rowStatus = documentValues[index]?.status;
          const rowCode = documentValues[index]?.document_code;
          return (
            <div key={field.id} className="flex flex-col gap-2 rounded-md border border-[var(--border)] p-3">
              <div className="flex items-start gap-2">
                <div className="flex-1">
                  <label htmlFor={`${idPrefix}-doc-${index}`} className="mb-1 block text-xs font-medium text-[var(--muted)]">
                    {labels.documentSelectLabel}
                  </label>
                  <select
                    id={`${idPrefix}-doc-${index}`}
                    className="w-full rounded-md border border-[var(--border)] bg-transparent p-2"
                    {...register(`documents.${index}.document_code` as const)}
                  >
                    <option value="">{labels.documentSelectPlaceholder}</option>
                    {documentTypes
                      .filter((d) => d.code === rowCode || !taken.has(d.code))
                      .map((d) => (
                        <option key={d.code} value={d.code}>
                          {d.label_uk}
                        </option>
                      ))}
                  </select>
                </div>
                {fields.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => remove(index)}
                    aria-label={labels.removeDocumentButton}
                    className="mt-5 shrink-0 rounded-md border border-[var(--border)] px-2 py-2 text-sm text-[var(--muted)]"
                  >
                    ✕
                  </button>
                ) : null}
              </div>

              {rowCode ? (
                <div>
                  <span className="mb-1 block text-xs font-medium text-[var(--muted)]">{labels.documentStatusLabel}</span>
                  <div className="flex flex-wrap gap-3 text-sm">
                    {DOC_STATUSES.map((status) => (
                      <label key={status} className="flex items-center gap-1">
                        <input type="radio" value={status} {...register(`documents.${index}.status` as const)} />
                        {labels.docStatus[status]}
                      </label>
                    ))}
                  </div>
                  {rowCode === "other" && rowStatus ? (
                    <p className="mt-1 text-xs text-[var(--muted)]">{labels.otherDocumentHint}</p>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
        <button
          type="button"
          onClick={() => append(EMPTY_ROW)}
          className="self-start rounded-full border border-[var(--border)] px-3 py-1.5 text-sm font-medium"
        >
          {labels.addDocumentButton}
        </button>
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
        <p role="alert" className="text-sm text-[var(--danger)]">
          {labels.duplicateNotice}{" "}
          {duplicateLink ? (
            <a href={duplicateLink} className="underline">
              {labels.duplicateNoticeLink}
            </a>
          ) : null}
        </p>
      ) : submitError === "daily_limit" ? (
        <p role="alert" className="text-sm text-[var(--danger)]">
          {labels.dailyLimitReached}
        </p>
      ) : submitError === "generic" ? (
        <p role="alert" className="text-sm text-[var(--danger)]">
          {labels.errorGeneric}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-[var(--accent)] px-4 py-2 font-medium text-[var(--accent-contrast)] disabled:opacity-50"
      >
        {submitting ? labels.submitting : reportId ? labels.saveButton : labels.submitButton}
      </button>
      <MainButtonBridge formId="report-form" text={reportId ? labels.saveButton : labels.submitButton} />
    </form>
  );
}
