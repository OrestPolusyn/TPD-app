"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function FlagButton({
  targetType,
  targetId,
  labels,
}: {
  targetType: "report" | "comment";
  targetId: string;
  labels: { flag: string; confirm: string; success: string; already: string; generic: string };
}) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "sending" | "done" | "already" | "error">("idle");

  async function handleClick() {
    if (!window.confirm(labels.confirm)) return;
    setState("sending");
    try {
      const res = await fetch("/api/flags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_type: targetType, target_id: targetId }),
      });
      if (res.status === 409) {
        setState("already");
        return;
      }
      if (!res.ok) {
        setState("error");
        return;
      }
      setState("done");
      router.refresh();
    } catch {
      setState("error");
    }
  }

  if (state === "done") return <span className="text-xs text-[var(--muted)]">{labels.success}</span>;
  if (state === "already") return <span className="text-xs text-[var(--muted)]">{labels.already}</span>;

  return (
    <button type="button" onClick={handleClick} disabled={state === "sending"} className="text-xs underline">
      {state === "error" ? labels.generic : labels.flag}
    </button>
  );
}
