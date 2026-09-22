import Link from "next/link";

/**
 * Always-visible primary action, pinned to the bottom of the viewport.
 *
 * The "share your experience" call sat at the bottom of the page, below every
 * report, so on a location with any content it was never on screen — which is
 * the one thing this app needs people to do.
 *
 * The page must reserve room for it: pages using this add `pb-24` to their
 * <main>, otherwise the bar covers the last element.
 */
export function StickyActionBar({ href, label }: { href: string; label: string }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-[1090] border-t border-[var(--border)] bg-[var(--background)]/95 p-3 backdrop-blur">
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
