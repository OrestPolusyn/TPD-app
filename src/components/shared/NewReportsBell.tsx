"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export const FEED_SEEN_KEY = "feedLastSeen";

/** Reads the mark without ever throwing: private mode blocks the whole API. */
export function readFeedSeen(): string | null {
  try {
    return localStorage.getItem(FEED_SEEN_KEY);
  } catch {
    return null;
  }
}

export function markFeedSeen(): void {
  try {
    localStorage.setItem(FEED_SEEN_KEY, new Date().toISOString());
  } catch {
    // Nothing to do: the bell simply keeps counting from the old mark.
  }
}

/** How far back a first-time visitor's bell looks. */
const FIRST_VISIT_WINDOW_MS = 7 * 86_400_000;

/**
 * "Anything new?" in the header.
 *
 * The mark for "last looked" is kept in the visitor's own browser, so this
 * needs no account, no table and no notification permission — it works signed
 * out, which is how most people read this site.
 *
 * Counts everything /feed shows as new — reports, rule changes and offices
 * whose card changed — not just reports: most news here is "Madrid now wants
 * only the stamp", which is a card update, not somebody's report.
 *
 * A first visit counts the last week, without storing a mark: a newcomer
 * should see that the site is alive, and the mark is set when they actually
 * open /feed.
 */
export function NewReportsBell({ label }: { label: string }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    // On a timer so the fetch does not cascade a render from the effect body.
    const timer = setTimeout(async () => {
      const since = readFeedSeen() ?? new Date(Date.now() - FIRST_VISIT_WINDOW_MS).toISOString();
      try {
        const res = await fetch(`/api/feed/new-count?since=${encodeURIComponent(since)}`);
        if (!res.ok) return;
        const body = (await res.json()) as { count?: number };
        setCount(typeof body.count === "number" ? body.count : 0);
      } catch {
        // Offline or blocked: no badge, no noise.
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Link
      href="/feed"
      aria-label={count > 0 ? `${label} (${count})` : label}
      title={label}
      className="relative flex h-9 w-9 items-center justify-center rounded-full text-[var(--muted)] no-underline transition-colors hover:text-[var(--foreground)]"
    >
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path d="M18 8.5a6 6 0 1 0-12 0c0 6-2 7.5-2 7.5h16s-2-1.5-2-7.5Z" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M10.3 20a2 2 0 0 0 3.4 0" strokeLinecap="round" />
      </svg>
      {count > 0 ? (
        <span className="absolute -right-0.5 -top-0.5 min-w-[18px] rounded-full bg-[var(--danger)] px-1 text-center text-[11px] font-semibold leading-[18px] text-white">
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </Link>
  );
}
