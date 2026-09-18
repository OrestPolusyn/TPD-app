/**
 * Pure-CSS spinner with no hooks and no "use client", so the same component
 * works inside server-rendered loading.tsx fallbacks and inside client islands
 * that track a pending submit (see SubmitButton).
 */
export function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block shrink-0 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--accent)] ${className}`}
    />
  );
}
