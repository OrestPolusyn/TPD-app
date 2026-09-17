"use client";

import { useEffect } from "react";
import messages from "../../messages/uk.json";

/**
 * Root error boundary. Next.js routes any uncaught error from a Server
 * Component (e.g. a failed Supabase call) here instead of a raw stack trace,
 * per docs/SPEC.md: "human-readable message plus a retry button. Raw error
 * text is never shown."
 *
 * Reads messages/uk.json directly (not via next-intl's useTranslations)
 * deliberately: this is the one unavoidable client component on every route,
 * and pulling in next-intl's client runtime + provider just for two short
 * strings would reintroduce the client-JS weight this file exists to avoid.
 * The strings still live only in messages/uk.json, per that same spec rule.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="mx-auto flex w-full max-w-md flex-1 flex-col items-start gap-3 p-4">
      <p className="text-sm">{messages.common.errorGeneric}</p>
      <button
        type="button"
        onClick={reset}
        className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm font-medium"
      >
        {messages.common.retry}
      </button>
    </div>
  );
}
