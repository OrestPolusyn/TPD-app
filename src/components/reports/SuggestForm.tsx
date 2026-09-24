"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import type { AppointmentMethod, LocationRow } from "@/lib/matching/types";
import type { SuggestionField } from "@/lib/validation/suggestionSchema";

interface FormValues {
  field: SuggestionField;
  proposed_value: string;
}

export interface SuggestFormLabels {
  fieldLabel: string;
  fieldNames: Record<SuggestionField, string>;
  currentValueLabel: string;
  proposedValueLabel: string;
  /** Replaces proposedValueLabel for "other", where there is no value to replace. */
  otherValueLabel: string;
  appointmentMethodNames: Record<AppointmentMethod, string>;
  submitButton: string;
  submitting: string;
  successMessage: string;
  errorGeneric: string;
}

function currentValueFor(location: LocationRow, field: SuggestionField, labels: SuggestFormLabels): string {
  switch (field) {
    case "address":
      return location.address ?? "";
    case "postal_code":
      return location.postal_code ?? "";
    case "phone":
      return location.phones.join(";");
    case "email":
      return location.email ?? "";
    case "appointment_method":
      return labels.appointmentMethodNames[location.appointment_method] ?? location.appointment_method;
    case "appointment_url":
      return location.appointment_url ?? "";
    case "other":
      return "";
  }
}

export function SuggestForm({
  location,
  labels,
  initialField = "address",
}: {
  location: LocationRow;
  labels: SuggestFormLabels;
  initialField?: SuggestionField;
}) {
  const router = useRouter();
  const idPrefix = useId();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(false);
  const [success, setSuccess] = useState(false);

  const { register, handleSubmit, watch, setValue } = useForm<FormValues>({
    defaultValues: { field: initialField, proposed_value: "" },
  });
  const field = watch("field");

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    setError(false);
    try {
      const res = await fetch("/api/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location_id: location.id, field: values.field, proposed_value: values.proposed_value }),
      });
      if (!res.ok) {
        setError(true);
        return;
      }
      setSuccess(true);
      router.refresh();
    } catch {
      setError(true);
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return <p className="text-sm">{labels.successMessage}</p>;
  }

  const inputClass = "w-full rounded-md border border-[var(--border-strong)] bg-[var(--surface)] p-2";
  const valueId = `${idPrefix}-value`;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div>
        <label htmlFor={`${idPrefix}-field`} className="mb-1 block text-sm font-medium">
          {labels.fieldLabel}
        </label>
        <select
          id={`${idPrefix}-field`}
          className={inputClass}
          {...register("field", { onChange: () => setValue("proposed_value", "") })}
        >
          {(Object.keys(labels.fieldNames) as SuggestionField[]).map((f) => (
            <option key={f} value={f}>
              {labels.fieldNames[f]}
            </option>
          ))}
        </select>
      </div>

      {field !== "other" ? (
        <p className="text-sm text-[var(--muted)]">
          {labels.currentValueLabel}: {currentValueFor(location, field, labels) || "—"}
        </p>
      ) : null}

      <div>
        <label htmlFor={valueId} className="mb-1 block text-sm font-medium">
          {field === "other" ? labels.otherValueLabel : labels.proposedValueLabel}
        </label>
        {field === "appointment_method" ? (
          // A fixed set of methods: picking one is quicker and gives the
          // moderator an unambiguous value to copy.
          <select id={valueId} className={inputClass} {...register("proposed_value", { required: true })}>
            <option value="">—</option>
            {Object.values(labels.appointmentMethodNames).map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        ) : field === "other" ? (
          <textarea id={valueId} rows={4} maxLength={500} className={inputClass} {...register("proposed_value", { required: true })} />
        ) : (
          <input id={valueId} maxLength={500} className={inputClass} {...register("proposed_value", { required: true })} />
        )}
      </div>

      {error ? (
        <p role="alert" className="text-sm text-[var(--danger)]">
          {labels.errorGeneric}
        </p>
      ) : null}

      <button type="submit" disabled={submitting} className="rounded-md bg-[var(--accent)] px-4 py-2 font-medium text-[var(--accent-contrast)] disabled:opacity-50">
        {submitting ? labels.submitting : labels.submitButton}
      </button>
    </form>
  );
}
