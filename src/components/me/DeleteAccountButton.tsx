"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DeleteAccountButton({
  labels,
}: {
  labels: { button: string; confirmTitle: string; confirmBody: string; confirmButton: string; cancel: string; success: string; generic: string };
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(false);

  async function handleDelete() {
    setSubmitting(true);
    setError(false);
    try {
      const res = await fetch("/api/me/delete", { method: "POST" });
      if (!res.ok) {
        setError(true);
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError(true);
    } finally {
      setSubmitting(false);
    }
  }

  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className="rounded-md border border-red-600 px-3 py-1.5 text-sm font-medium text-red-600">
        {labels.button}
      </button>
    );
  }

  return (
    <div role="alertdialog" aria-label={labels.confirmTitle} className="rounded-md border border-red-600 p-3 text-sm">
      <p className="font-medium">{labels.confirmTitle}</p>
      <p className="mt-1">{labels.confirmBody}</p>
      {error ? <p className="mt-1 text-red-600">{labels.generic}</p> : null}
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={handleDelete}
          disabled={submitting}
          className="rounded-md bg-red-600 px-3 py-1.5 font-medium text-white disabled:opacity-50"
        >
          {labels.confirmButton}
        </button>
        <button type="button" onClick={() => setConfirming(false)} className="rounded-md border border-[var(--border)] px-3 py-1.5 font-medium">
          {labels.cancel}
        </button>
      </div>
    </div>
  );
}
