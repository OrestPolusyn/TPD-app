"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import type { LocationRow } from "@/lib/matching/types";

type Field = "address" | "postal_code" | "phone" | "appointment_url";

interface FormValues {
  field: Field;
  proposed_value: string;
}

export interface SuggestFormLabels {
  fieldLabel: string;
  fieldNames: Record<Field, string>;
  currentValueLabel: string;
  proposedValueLabel: string;
  submitButton: string;
  submitting: string;
  successMessage: string;
  errorGeneric: string;
}

function currentValueFor(location: LocationRow, field: Field): string {
  if (field === "address") return location.address ?? "";
  if (field === "postal_code") return location.postal_code ?? "";
  if (field === "phone") return location.phones.join(";");
  return location.appointment_url ?? "";
}

export function SuggestForm({ location, labels }: { location: LocationRow; labels: SuggestFormLabels }) {
  const router = useRouter();
  const idPrefix = useId();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(false);
  const [success, setSuccess] = useState(false);

  const { register, handleSubmit, watch } = useForm<FormValues>({
    defaultValues: { field: "address", proposed_value: "" },
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

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div>
        <label htmlFor={`${idPrefix}-field`} className="mb-1 block text-sm font-medium">
          {labels.fieldLabel}
        </label>
        <select id={`${idPrefix}-field`} className="w-full rounded-md border border-[var(--border-strong)] bg-[var(--surface)] p-2" {...register("field")}>
          {(Object.keys(labels.fieldNames) as Field[]).map((f) => (
            <option key={f} value={f}>
              {labels.fieldNames[f]}
            </option>
          ))}
        </select>
      </div>

      <p className="text-sm text-[var(--muted)]">
        {labels.currentValueLabel}: {currentValueFor(location, field) || "—"}
      </p>

      <div>
        <label htmlFor={`${idPrefix}-value`} className="mb-1 block text-sm font-medium">
          {labels.proposedValueLabel}
        </label>
        <input id={`${idPrefix}-value`} className="w-full rounded-md border border-[var(--border-strong)] bg-[var(--surface)] p-2" {...register("proposed_value", { required: true })} />
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
