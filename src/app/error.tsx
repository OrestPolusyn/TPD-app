"use client";

import { useEffect } from "react";
import { errorCopy } from "./errorCopy";

/**
 * Root error boundary. Next.js routes any uncaught error from a Server
 * Component (e.g. a failed Supabase call) here instead of a raw stack trace,
 * per docs/SPEC.md: "human-readable message plus a retry button. Raw error
 * text is never shown."
 *
 * Takes its strings from ./errorCopy (not via next-intl's useTranslations)
 * deliberately: this is the one unavoidable client component on every route,
 * and pulling in next-intl's client runtime + provider — or all of
 * messages/uk.json — for three short strings would put that weight on every
 * page. errorCopy.test.ts keeps them identical to messages/uk.json.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="mx-auto flex w-full max-w-md flex-1 flex-col items-start gap-3 p-4">
      <p className="text-sm">{errorCopy.errorGeneric}</p>
      <button
        type="button"
        onClick={reset}
        className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm font-medium"
      >
        {errorCopy.retry}
      </button>

      {/* Collapsed by default, so the spec's "no raw error text" holds for
          ordinary visitors — but a production failure is otherwise invisible
          without devtools. React strips the message for server errors and
          gives only `digest`, which matches the Vercel log line. */}
      {error.digest || error.message ? (
        <details className="w-full text-xs text-[var(--muted)]">
          <summary className="cursor-pointer">{errorCopy.errorDetails}</summary>
          <p className="mt-1 break-all font-mono">
            {error.digest ? `digest: ${error.digest}` : null}
            {error.digest && error.message ? " — " : null}
            {error.message}
          </p>
        </details>
      ) : null}
    </div>
  );
}
