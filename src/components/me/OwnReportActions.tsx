"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

/** Edit link + confirm-then-delete for one of the caller's own reports on /me. */
export function OwnReportActions({
  reportId,
  labels,
}: {
  reportId: string;
  labels: { edit: string; delete: string; confirm: string; cancel: string; generic: string };
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(false);

  async function handleDelete() {
    setSubmitting(true);
    setError(false);
    try {
      const res = await fetch(`/api/reports/${reportId}`, { method: "DELETE" });
      if (!res.ok) {
        setError(true);
        return;
      }
      router.refresh();
    } catch {
      setError(true);
    } finally {
      setSubmitting(false);
      setConfirming(false);
    }
  }

  return (
    <div className="mt-1 flex items-center gap-3 text-xs">
      <Link href={`/reports/${reportId}/edit`} className="underline">
        {labels.edit}
      </Link>
      {confirming ? (
        <>
          <span>{labels.confirm}</span>
          <button type="button" onClick={handleDelete} disabled={submitting} className="text-red-600 underline disabled:opacity-50">
            {labels.delete}
          </button>
          <button type="button" onClick={() => setConfirming(false)} className="underline">
            {labels.cancel}
          </button>
        </>
      ) : (
        <button type="button" onClick={() => setConfirming(true)} className="text-red-600 underline">
          {labels.delete}
        </button>
      )}
      {error ? <span className="text-red-600">{labels.generic}</span> : null}
    </div>
  );
}
