"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { NoteStance } from "@/lib/data/communityNotes";

interface Labels {
  confirm: string;
  deny: string;
  signIn: string;
  generic: string;
}

/**
 * The "чи це ще так?" control under a community note.
 *
 * Both buttons are toggles: pressing the one you already hold takes your
 * verdict back, pressing the other moves it. The counts update locally the
 * moment you press — a router.refresh() round-trip is several hundred
 * milliseconds, and a button that appears to do nothing for that long reads
 * as broken (this exact complaint already cost a round on the login button).
 */
export function NoteConfirm({
  noteId,
  stance,
  stillTrue,
  changed,
  labels,
}: {
  noteId: string;
  stance: NoteStance | null;
  stillTrue: number;
  changed: number;
  labels: Labels;
}) {
  const router = useRouter();
  const [override, setOverride] = useState<{ stance: NoteStance | null; still: number; changed: number } | null>(null);
  const [error, setError] = useState<"none" | "auth" | "generic">("none");

  // Adjusting state during render rather than in an effect: once the server
  // sends back the real counts, the local guess has to give way, and this is
  // the supported way to react to changed props without an effect.
  const serverSnapshot = `${stance}|${stillTrue}|${changed}`;
  const [seenSnapshot, setSeenSnapshot] = useState(serverSnapshot);
  if (seenSnapshot !== serverSnapshot) {
    setSeenSnapshot(serverSnapshot);
    setOverride(null);
  }

  const current = override ?? { stance, still: stillTrue, changed };

  async function vote(next: NoteStance) {
    const taken = current.stance === next ? null : next;
    setOverride({
      stance: taken,
      still: current.still + (taken === "still_true" ? 1 : 0) - (current.stance === "still_true" ? 1 : 0),
      changed: current.changed + (taken === "changed" ? 1 : 0) - (current.stance === "changed" ? 1 : 0),
    });
    setError("none");

    try {
      const res = await fetch("/api/community-notes/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note_id: noteId, stance: next }),
      });
      if (res.status === 401) {
        setOverride(null);
        setError("auth");
        return;
      }
      if (!res.ok) {
        setOverride(null);
        setError("generic");
        return;
      }
      router.refresh();
    } catch {
      setOverride(null);
      setError("generic");
    }
  }

  const base =
    "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors cursor-pointer";
  const idle = "border-[var(--border)] text-[var(--muted)] hover:border-[var(--border-strong)] hover:text-[var(--fg)]";
  const activeYes = "border-[var(--accent)] bg-[var(--accent-soft)] font-medium text-[var(--accent)]";
  const activeNo = "border-[var(--warning)] bg-[var(--highlight-bg)] font-medium text-[var(--warning)]";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        aria-pressed={current.stance === "still_true"}
        onClick={() => vote("still_true")}
        className={`${base} ${current.stance === "still_true" ? activeYes : idle}`}
      >
        <span aria-hidden="true">✓</span>
        {labels.confirm}
        {current.still > 0 ? <span className="tabular-nums">{current.still}</span> : null}
      </button>

      <button
        type="button"
        aria-pressed={current.stance === "changed"}
        onClick={() => vote("changed")}
        className={`${base} ${current.stance === "changed" ? activeNo : idle}`}
      >
        <span aria-hidden="true">↺</span>
        {labels.deny}
        {current.changed > 0 ? <span className="tabular-nums">{current.changed}</span> : null}
      </button>

      {error !== "none" ? (
        <span role="alert" className="text-xs text-[var(--danger)]">
          {error === "auth" ? labels.signIn : labels.generic}
        </span>
      ) : null}
    </div>
  );
}
