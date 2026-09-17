"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";

export function CommentForm({
  reportId,
  labels,
}: {
  reportId: string;
  labels: { placeholder: string; submit: string; submitting: string; generic: string };
}) {
  const router = useRouter();
  const id = useId();
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim()) return;
    setSubmitting(true);
    setError(false);
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report_id: reportId, body: value.trim() }),
      });
      if (!res.ok) {
        setError(true);
        return;
      }
      setValue("");
      router.refresh();
    } catch {
      setError(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-2 flex flex-col gap-1">
      <label htmlFor={id} className="sr-only">
        {labels.placeholder}
      </label>
      <textarea
        id={id}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={labels.placeholder}
        maxLength={1000}
        rows={2}
        className="w-full rounded-md border border-[var(--border)] bg-transparent p-1.5 text-sm"
      />
      {error ? (
        <p role="alert" className="text-xs text-red-600">
          {labels.generic}
        </p>
      ) : null}
      <button type="submit" disabled={submitting} className="self-start text-xs underline disabled:opacity-50">
        {submitting ? labels.submitting : labels.submit}
      </button>
    </form>
  );
}
