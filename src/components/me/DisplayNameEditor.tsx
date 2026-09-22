"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/shared/Avatar";

/**
 * Profile header for /me: avatar + current display name, with an inline
 * editor for the self-chosen nickname override (set_own_display_name via
 * /api/me/display-name). Mirrors the edit/save/cancel pattern of
 * OwnCommentActions rather than navigating to a separate settings page.
 */
export function DisplayNameEditor({
  currentDisplayName,
  fallbackName,
  avatarUrl,
  labels,
}: {
  currentDisplayName: string | null;
  fallbackName: string;
  avatarUrl: string | null;
  labels: {
    placeholder: string;
    hint: string;
    edit: string;
    save: string;
    cancel: string;
    tooLong: string;
    generic: string;
  };
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(currentDisplayName ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<"generic" | "tooLong" | null>(null);

  const shownName = currentDisplayName ?? fallbackName;

  async function handleSave() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/me/display-name", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display_name: value.trim() || null }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error === "validation" ? "tooLong" : "generic");
        return;
      }
      setEditing(false);
      router.refresh();
    } catch {
      setError("generic");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)]">
      <Avatar name={shownName} photoUrl={avatarUrl} size={56} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {editing ? (
          <div className="flex flex-col gap-1.5">
            <input
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              maxLength={60}
              placeholder={labels.placeholder}
              className="w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-transparent px-2.5 py-1.5 text-sm"
              autoFocus
            />
            <p className="text-xs text-[var(--muted)]">{labels.hint}</p>
            {error ? (
              <p className="text-xs text-[var(--danger)]">{error === "tooLong" ? labels.tooLong : labels.generic}</p>
            ) : null}
            <div className="flex gap-3 text-xs">
              <button
                type="button"
                onClick={handleSave}
                disabled={submitting}
                className="font-medium text-[var(--accent)] underline disabled:opacity-50"
              >
                {labels.save}
              </button>
              <button
                type="button"
                onClick={() => {
                  setValue(currentDisplayName ?? "");
                  setError(null);
                  setEditing(false);
                }}
                className="text-[var(--muted)] underline"
              >
                {labels.cancel}
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="truncate text-lg font-semibold">{shownName}</p>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="w-fit text-xs font-medium text-[var(--accent)] underline"
            >
              {labels.edit}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
