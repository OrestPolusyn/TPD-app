import Link from "next/link";

/**
 * Always-visible primary action, pinned to the bottom of the viewport.
 *
 * The "share your experience" call sat at the bottom of the page, below every
 * report, so on a location with any content it was never on screen — which is
 * the one thing this app needs people to do.
 *
 * Room for it is reserved at the very end of the page (globals.css,
 * `body:has([data-sticky-action])`), not on <main>: the site footer comes
 * after <main>, so padding there only showed up as an empty band above the
 * footer while the bar went on covering the footer itself.
 */
export function StickyActionBar({ href, label }: { href: string; label: string }) {
  return (
    <div data-sticky-action className="fixed inset-x-0 bottom-0 z-[1090] border-t border-[var(--border)] bg-[var(--background)]/95 p-3 backdrop-blur">
      <div className="mx-auto w-full max-w-2xl">
        <Link
          href={href}
          className="block rounded-full bg-[var(--accent)] px-4 py-3 text-center font-medium text-[var(--accent-contrast)] no-underline"
        >
          {label}
        </Link>
      </div>
    </div>
  );
}
