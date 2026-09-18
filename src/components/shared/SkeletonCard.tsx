/**
 * Placeholder in the shape of a <Card>. Decorative only — the surrounding
 * loading.tsx announces progress via <LoadingIndicator>, so these blocks stay
 * aria-hidden instead of being read out as a wall of empty boxes.
 */
export function SkeletonCard({ lines = 2 }: { lines?: number }) {
  return (
    <div
      aria-hidden="true"
      className="animate-pulse rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm"
    >
      <div className="h-4 w-2/3 rounded bg-[var(--border)]" />
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="mt-2 h-3 rounded bg-[var(--border)]" style={{ width: `${85 - i * 20}%` }} />
      ))}
    </div>
  );
}
