"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";

export interface NewLocationFormLabels {
  descriptionLabel: string;
  descriptionHint: string;
  submitButton: string;
  submitting: string;
  successMessage: string;
  pendingNotice: string;
  errorGeneric: string;
}

/**
 * One free-text field. Replaces a structured form (name/type/region/province/
 * city/address/...) that asked a visitor to fill in exactly the fields a
 * moderator would otherwise verify against an official source anyway — the
 * text goes straight to that moderator (locations.notes), who turns it into a
 * real listing. Per feedback: "просто текстове поле".
 */
export function NewLocationForm({ labels }: { labels: NewLocationFormLabels }) {
  const router = useRouter();
  const id = useId();
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const description = value.trim();
    if (description.length < 10) return;
    setSubmitting(true);
    setError(false);
    try {
      const res = await fetch("/api/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description }),
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div>
        <label htmlFor={id} className="mb-1 block text-sm font-medium">
          {labels.descriptionLabel}
        </label>
        <p className="mb-2 text-xs text-[var(--muted)]">{labels.descriptionHint}</p>
        <textarea
          id={id}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          minLength={10}
          maxLength={2000}
          rows={8}
          required
          className="w-full rounded-md border border-[var(--border)] bg-transparent p-2"
        />
      </div>

      {error ? (
        <p role="alert" className="text-sm text-red-600">
          {labels.errorGeneric}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        className="self-start rounded-md bg-[var(--accent)] px-4 py-2 font-medium text-[var(--accent-contrast)] disabled:opacity-50"
      >
        {submitting ? labels.submitting : labels.submitButton}
      </button>
    </form>
  );
}
