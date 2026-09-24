"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { BriefStance } from "@/lib/data/communityNotes";

interface Labels {
  question: string;
  confirm: string;
  deny: string;
  signIn: string;
  generic: string;
}

/**
 * "Актуально?" under the community brief — one small row, not per bullet.
 *
 * Both buttons are toggles: pressing the one you already hold takes your
 * verdict back, pressing the other moves it. Counts update the moment you
 * press, because a refresh round-trip that shows nothing for half a second
 * reads as a dead button.
 */
export function BriefConfirm({
  locationId,
  stance,
  stillTrue,
  changed,
  labels,
}: {
  locationId: string;
  stance: BriefStance | null;
  stillTrue: number;
  changed: number;
  labels: Labels;
}) {
  const router = useRouter();
  const [override, setOverride] = useState<{ stance: BriefStance | null; still: number; changed: number } | null>(null);
  const [error, setError] = useState<"none" | "auth" | "generic">("none");

  // Once the server sends back real counts, the local guess gives way —
  // adjusted during render, which is the supported alternative to an effect.
  const serverSnapshot = `${stance}|${stillTrue}|${changed}`;
  const [seenSnapshot, setSeenSnapshot] = useState(serverSnapshot);
  if (seenSnapshot !== serverSnapshot) {
    setSeenSnapshot(serverSnapshot);
    setOverride(null);
  }

  const current = override ?? { stance, still: stillTrue, changed };

  async function vote(next: BriefStance) {
    const taken = current.stance === next ? null : next;
    setOverride({
      stance: taken,
      still: current.still + (taken === "still_true" ? 1 : 0) - (current.stance === "still_true" ? 1 : 0),
      changed: current.changed + (taken === "changed" ? 1 : 0) - (current.stance === "changed" ? 1 : 0),
    });
    setError("none");

    try {
      const res = await fetch("/api/community-brief/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location_id: locationId, stance: next }),
      });
      if (!res.ok) {
        setOverride(null);
        setError(res.status === 401 ? "auth" : "generic");
        return;
      }
      router.refresh();
    } catch {
      setOverride(null);
      setError("generic");
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
        <span role="alert" className="basis-full text-xs text-[var(--danger)]">
          {error === "auth" ? labels.signIn : labels.generic}
        </span>
      ) : null}
    </div>
  );
}
