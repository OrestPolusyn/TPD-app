"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Inline edit (single value) + confirm-then-delete for one of the caller's
 * own pending suggestions on /me. Only rendered by the caller while
 * status === "pending" — RLS enforces the same rule server-side, so a request
 * against a reviewed suggestion 404s rather than silently doing nothing.
 */
export function OwnSuggestionActions({
  suggestionId,
  initialValue,
  labels,
}: {
  suggestionId: string;
  initialValue: string;
  labels: {
    edit: string;
    delete: string;
    save: string;
    cancel: string;
    confirmDelete: string;
    generic: string;
  };
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"view" | "edit" | "confirmDelete">("view");
  const [value, setValue] = useState(initialValue);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(false);

  async function handleSave() {
    const proposed_value = value.trim();
    if (!proposed_value) return;
    setSubmitting(true);
    setError(false);
    try {
      const res = await fetch(`/api/suggestions/${suggestionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposed_value }),
      });
      if (!res.ok) {
        setError(true);
        return;
      }
      setMode("view");
      router.refresh();
    } catch {
      setError(true);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    setSubmitting(true);
    setError(false);
    try {
      const res = await fetch(`/api/suggestions/${suggestionId}`, { method: "DELETE" });
      if (!res.ok) {
        setError(true);
        return;
      }
      router.refresh();
    } catch {
      setError(true);
    } finally {
      setSubmitting(false);
    }
  }

  if (mode === "edit") {
    return (
      <div className="mt-1 flex flex-col gap-1">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={500}
          className="w-full rounded-md border border-[var(--border-strong)] bg-[var(--surface)] p-1.5 text-sm"
        />
        {error ? <p className="text-xs text-[var(--danger)]">{labels.generic}</p> : null}
        <div className="flex gap-3 text-xs">
          <button type="button" onClick={handleSave} disabled={submitting} className="underline disabled:opacity-50">
            {labels.save}
          </button>
          <button
            type="button"
            onClick={() => {
              setValue(initialValue);
              setMode("view");
            }}
            className="underline"
          >
            {labels.cancel}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-1 flex items-center gap-3 text-xs">
      <button type="button" onClick={() => setMode("edit")} className="underline">
        {labels.edit}
      </button>
      {mode === "confirmDelete" ? (
        <>
          <span>{labels.confirmDelete}</span>
          <button type="button" onClick={handleDelete} disabled={submitting} className="text-[var(--danger)] underline disabled:opacity-50">
            {labels.delete}
          </button>
          <button type="button" onClick={() => setMode("view")} className="underline">
            {labels.cancel}
          </button>
        </>
      ) : (
        <button type="button" onClick={() => setMode("confirmDelete")} className="text-[var(--danger)] underline">
          {labels.delete}
        </button>
      )}
      {error && mode === "view" ? <span className="text-[var(--danger)]">{labels.generic}</span> : null}
    </div>
  );
}
