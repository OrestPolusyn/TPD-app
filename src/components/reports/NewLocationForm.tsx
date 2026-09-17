"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { createClient } from "@/lib/supabase/browser";
import { slugify } from "@/lib/slugify";

interface FormValues {
  name: string;
  type: "creade" | "police_station";
  region: string;
  province: string;
  city: string;
  address: string;
  postal_code: string;
  phone: string;
  appointment_method: "phone" | "email" | "phone_or_email" | "icp_online";
  appointment_url: string;
}

interface DuplicateCandidate {
  id: string;
  name: string;
  address: string | null;
  moderation_status: string;
}

export interface NewLocationFormLabels {
  nameLabel: string;
  typeLabel: string;
  provinceLabel: string;
  regionLabel: string;
  cityLabel: string;
  addressLabel: string;
  postalCodeLabel: string;
  phoneLabel: string;
  appointmentMethodLabel: string;
  appointmentUrlLabel: string;
  submitButton: string;
  submitting: string;
  duplicateWarning: string;
  successMessage: string;
  pendingNotice: string;
  errorGeneric: string;
  appointmentMethods: Record<FormValues["appointment_method"], string>;
  locationTypes: Record<FormValues["type"], string>;
}

export function NewLocationForm({ labels }: { labels: NewLocationFormLabels }) {
  const router = useRouter();
  const idPrefix = useId();
  const [duplicates, setDuplicates] = useState<DuplicateCandidate[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(false);
  const [success, setSuccess] = useState(false);

  const { register, handleSubmit, watch } = useForm<FormValues>({
    defaultValues: {
      name: "",
      type: "police_station",
      region: "",
      province: "",
      city: "",
      address: "",
      postal_code: "",
      phone: "",
      appointment_method: "phone",
      appointment_url: "",
    },
  });

  async function checkDuplicates() {
    const values = watch();
    if (!values.name || !values.province) return;
    const supabase = createClient();
    const { data } = await supabase.rpc("check_duplicate_location", {
      p_province_slug: slugify(values.province),
      p_name: values.name,
      p_address: values.address || null,
    });
    setDuplicates((data ?? []) as DuplicateCandidate[]);
  }

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    setError(false);
    try {
      const res = await fetch("/api/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          address: values.address || null,
          postal_code: values.postal_code || null,
          phone: values.phone || null,
          appointment_url: values.appointment_url || null,
        }),
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
    return (
      <div className="text-sm">
        <p>{labels.successMessage}</p>
        <p className="mt-1 text-[var(--muted)]">{labels.pendingNotice}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} onBlur={checkDuplicates} className="flex flex-col gap-4">
      <div>
        <label htmlFor={`${idPrefix}-name`} className="mb-1 block text-sm font-medium">
          {labels.nameLabel}
        </label>
        <input id={`${idPrefix}-name`} className="w-full rounded-md border border-[var(--border)] bg-transparent p-2" {...register("name", { required: true })} />
      </div>

      <div>
        <label htmlFor={`${idPrefix}-type`} className="mb-1 block text-sm font-medium">
          {labels.typeLabel}
        </label>
        <select id={`${idPrefix}-type`} className="w-full rounded-md border border-[var(--border)] bg-transparent p-2" {...register("type")}>
          <option value="police_station">{labels.locationTypes.police_station}</option>
          <option value="creade">{labels.locationTypes.creade}</option>
        </select>
      </div>

      <div>
        <label htmlFor={`${idPrefix}-region`} className="mb-1 block text-sm font-medium">
          {labels.regionLabel}
        </label>
        <input id={`${idPrefix}-region`} className="w-full rounded-md border border-[var(--border)] bg-transparent p-2" {...register("region", { required: true })} />
      </div>

      <div>
        <label htmlFor={`${idPrefix}-province`} className="mb-1 block text-sm font-medium">
          {labels.provinceLabel}
        </label>
        <input id={`${idPrefix}-province`} className="w-full rounded-md border border-[var(--border)] bg-transparent p-2" {...register("province", { required: true })} />
      </div>

      <div>
        <label htmlFor={`${idPrefix}-city`} className="mb-1 block text-sm font-medium">
          {labels.cityLabel}
        </label>
        <input id={`${idPrefix}-city`} className="w-full rounded-md border border-[var(--border)] bg-transparent p-2" {...register("city", { required: true })} />
      </div>

      <div>
        <label htmlFor={`${idPrefix}-address`} className="mb-1 block text-sm font-medium">
          {labels.addressLabel}
        </label>
        <input id={`${idPrefix}-address`} className="w-full rounded-md border border-[var(--border)] bg-transparent p-2" {...register("address")} />
      </div>

      {duplicates.length > 0 ? (
        <div role="alert" className="rounded-md border border-[var(--highlight-border)] bg-[var(--highlight-bg)] p-2 text-sm">
          <p>{labels.duplicateWarning}</p>
          <ul className="mt-1 list-inside list-disc">
            {duplicates.map((d) => (
              <li key={d.id}>
                <a href={`/locations/${d.id}`} className="underline" target="_blank" rel="noopener noreferrer">
                  {d.name} {d.address ? `— ${d.address}` : ""}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div>
        <label htmlFor={`${idPrefix}-postal`} className="mb-1 block text-sm font-medium">
          {labels.postalCodeLabel}
        </label>
        <input id={`${idPrefix}-postal`} className="w-full rounded-md border border-[var(--border)] bg-transparent p-2" {...register("postal_code")} />
      </div>

      <div>
        <label htmlFor={`${idPrefix}-phone`} className="mb-1 block text-sm font-medium">
          {labels.phoneLabel}
        </label>
        <input id={`${idPrefix}-phone`} className="w-full rounded-md border border-[var(--border)] bg-transparent p-2" {...register("phone")} />
      </div>

      <div>
        <label htmlFor={`${idPrefix}-method`} className="mb-1 block text-sm font-medium">
          {labels.appointmentMethodLabel}
        </label>
        <select id={`${idPrefix}-method`} className="w-full rounded-md border border-[var(--border)] bg-transparent p-2" {...register("appointment_method")}>
          {(Object.keys(labels.appointmentMethods) as FormValues["appointment_method"][]).map((k) => (
            <option key={k} value={k}>
              {labels.appointmentMethods[k]}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor={`${idPrefix}-url`} className="mb-1 block text-sm font-medium">
          {labels.appointmentUrlLabel}
        </label>
        <input id={`${idPrefix}-url`} type="url" className="w-full rounded-md border border-[var(--border)] bg-transparent p-2" {...register("appointment_url")} />
      </div>

      {error ? (
        <p role="alert" className="text-sm text-red-600">
          {labels.errorGeneric}
        </p>
      ) : null}

      <button type="submit" disabled={submitting} className="rounded-md bg-[var(--accent)] px-4 py-2 font-medium text-[var(--accent-contrast)] disabled:opacity-50">
        {submitting ? labels.submitting : labels.submitButton}
      </button>
    </form>
  );
}
