"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Inline edit (textarea) + confirm-then-delete for one of the caller's own
 * comments on /me. No page navigation: comments are short enough to edit
 * in place, unlike a full report.
 */
export function OwnCommentActions({
  commentId,
  initialBody,
  labels,
}: {
  commentId: string;
  initialBody: string;
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
  const [value, setValue] = useState(initialBody);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(false);

  async function handleSave() {
    const body = value.trim();
    if (!body) return;
    setSubmitting(true);
    setError(false);
    try {
      const res = await fetch(`/api/comments/${commentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
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
      const res = await fetch(`/api/comments/${commentId}`, { method: "DELETE" });
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
      <div className="flex flex-col gap-1">
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={1000}
          rows={2}
          className="w-full rounded-md border border-[var(--border)] bg-transparent p-1.5 text-sm"
        />
        {error ? <p className="text-xs text-[var(--danger)]">{labels.generic}</p> : null}
        <div className="flex gap-3 text-xs">
          <button type="button" onClick={handleSave} disabled={submitting} className="underline disabled:opacity-50">
            {labels.save}
          </button>
          <button
            type="button"
            onClick={() => {
              setValue(initialBody);
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
    <div className="flex items-center gap-3 text-xs">
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
