"use client";

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { BriefStance } from "@/lib/data/communityNotes";

interface Labels {
  question: string;
  confirm: string;
  deny: string;
  signIn: string;
  generic: string;
  changedTitle: string;
  changedHint: string;
  changedPlaceholder: string;
  changedSubmit: string;
  changedCancel: string;
  changedThanks: string;
}

type Counts = { stance: BriefStance | null; still: number; changed: number };

/** Counts after `from` becomes `to`, for the optimistic update. */
function moved(from: Counts, to: BriefStance | null): Counts {
  return {
    stance: to,
    still: from.still + (to === "still_true" ? 1 : 0) - (from.stance === "still_true" ? 1 : 0),
    changed: from.changed + (to === "changed" ? 1 : 0) - (from.stance === "changed" ? 1 : 0),
  };
}

/**
 * "Актуально?" under the community brief — one small row, not per bullet.
 *
 * "Так" is a plain toggle. "Змінилось" opens a short form first: a bare
 * "it changed" gives the moderator nothing to update the brief with, so the
 * vote only counts together with what is different now (which the server
 * also relays to the moderator's Telegram). Pressing "Змінилось" again when
 * you already hold it just withdraws it, no form.
 */
export function BriefConfirm({
  locationId,
  signedIn,
  stance,
  stillTrue,
  changed,
  labels,
}: {
  locationId: string;
  signedIn: boolean;
  stance: BriefStance | null;
  stillTrue: number;
  changed: number;
  labels: Labels;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const fieldId = useId();
  const [override, setOverride] = useState<Counts | null>(null);
  const [notice, setNotice] = useState<"none" | "auth" | "generic" | "thanks">("none");
  const [detail, setDetail] = useState("");
  const [sending, setSending] = useState(false);
  const [dialogError, setDialogError] = useState(false);

  // Once the server sends back real counts, the local guess gives way —
  // adjusted during render, which is the supported alternative to an effect.
  const serverSnapshot = `${stance}|${stillTrue}|${changed}`;
  const [seenSnapshot, setSeenSnapshot] = useState(serverSnapshot);
  if (seenSnapshot !== serverSnapshot) {
    setSeenSnapshot(serverSnapshot);
    setOverride(null);
  }

  const current: Counts = override ?? { stance, still: stillTrue, changed };

  function post(next: BriefStance, text?: string) {
    return fetch("/api/community-brief/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ location_id: locationId, stance: next, detail: text }),
    });
  }

  /** Toggle without a form: "Так", or taking back your own "Змінилось". */
  async function toggle(next: BriefStance) {
    const before = current;
    setOverride(moved(before, before.stance === next ? null : next));
    setNotice("none");
    try {
      const res = await post(next);
      if (!res.ok) {
        setOverride(null);
        setNotice(res.status === 401 ? "auth" : "generic");
        return;
      }
      router.refresh();
    } catch {
      setOverride(null);
      setNotice("generic");
    }
  }

  function onConfirm() {
    if (!signedIn) return setNotice("auth");
    void toggle("still_true");
  }

  function onChanged() {
    if (!signedIn) return setNotice("auth");
    if (current.stance === "changed") return void toggle("changed");
    setNotice("none");
    setDialogError(false);
    dialogRef.current?.showModal();
  }

  async function submitChange(event: React.FormEvent) {
    event.preventDefault();
    const text = detail.trim();
    if (!text) return;
    setSending(true);
    setDialogError(false);
    try {
      const res = await post("changed", text);
      if (res.status === 401) {
        dialogRef.current?.close();
        setNotice("auth");
        return;
      }
      if (!res.ok) {
        setDialogError(true);
        return;
      }
      setOverride(moved(current, "changed"));
      setDetail("");
      dialogRef.current?.close();
      setNotice("thanks");
      router.refresh();
    } catch {
      setDialogError(true);
    } finally {
      setSending(false);
    }
  }

  const base = "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors cursor-pointer";
  const idle = "border-[var(--border)] text-[var(--muted)] hover:border-[var(--border-strong)] hover:text-[var(--foreground)]";
  const activeYes = "border-[var(--accent)] bg-[var(--accent-soft)] font-medium text-[var(--accent)]";
  const activeNo = "border-[var(--warning)] bg-[var(--highlight-bg)] font-medium text-[var(--warning)]";

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-[var(--muted)]">{labels.question}</span>
      <button
        type="button"
        aria-pressed={current.stance === "still_true"}
        onClick={onConfirm}
        className={`${base} ${current.stance === "still_true" ? activeYes : idle}`}
      >
        <span aria-hidden="true">✓</span>
        {labels.confirm}
        {current.still > 0 ? <span className="tabular-nums">{current.still}</span> : null}
      </button>
      <button
        type="button"
        aria-pressed={current.stance === "changed"}
        aria-haspopup="dialog"
        onClick={onChanged}
        className={`${base} ${current.stance === "changed" ? activeNo : idle}`}
      >
        <span aria-hidden="true">↺</span>
        {labels.deny}
        {current.changed > 0 ? <span className="tabular-nums">{current.changed}</span> : null}
      </button>

      {notice === "auth" || notice === "generic" ? (
        <span role="alert" className="basis-full text-xs text-[var(--danger)]">
          {notice === "auth" ? labels.signIn : labels.generic}
        </span>
      ) : null}
      {notice === "thanks" ? (
        <span role="status" className="basis-full text-xs text-[var(--success)]">
          {labels.changedThanks}
        </span>
      ) : null}

      <dialog
        ref={dialogRef}
        aria-labelledby={`${fieldId}-title`}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-0 text-[var(--foreground)] shadow-lg backdrop:bg-black/50"
      >
        <form onSubmit={submitChange} className="flex flex-col gap-3 p-4">
          <h2 id={`${fieldId}-title`} className="text-base font-semibold">
            {labels.changedTitle}
          </h2>
          <label htmlFor={fieldId} className="text-sm text-[var(--muted)]">
            {labels.changedHint}
          </label>
          <textarea
            id={fieldId}
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            placeholder={labels.changedPlaceholder}
            required
            maxLength={1000}
            rows={4}
            className="w-full rounded-md border border-[var(--border-strong)] bg-[var(--background)] p-2 text-sm"
          />
          {dialogError ? (
            <p role="alert" className="text-xs text-[var(--danger)]">
              {labels.generic}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="rounded-full px-3 py-1.5 text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
            >
              {labels.changedCancel}
            </button>
            <button
              type="submit"
              disabled={sending || !detail.trim()}
              className="rounded-full bg-[var(--accent)] px-4 py-1.5 text-sm font-medium text-[var(--accent-contrast)] disabled:opacity-50"
            >
              {labels.changedSubmit}
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
