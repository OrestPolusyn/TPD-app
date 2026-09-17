export function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-md border border-[var(--border)] p-4" aria-hidden="true">
      <div className="h-4 w-2/3 rounded bg-[var(--border)]" />
      <div className="mt-2 h-3 w-1/2 rounded bg-[var(--border)]" />
      <div className="mt-4 h-3 w-full rounded bg-[var(--border)]" />
    </div>
  );
}
