import { LoadingIndicator } from "@/components/shared/LoadingIndicator";
import { SkeletonCard } from "@/components/shared/SkeletonCard";

/** /results runs the fn_search_results RPC, the slowest query in the app. */
export default function Loading() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-4 sm:p-6">
      <div className="h-8 w-3/4 animate-pulse rounded bg-[var(--border)]" aria-hidden="true" />
      <LoadingIndicator />
      <ul className="flex flex-col gap-3">
        {[0, 1, 2, 3].map((i) => (
          <li key={i}>
            <SkeletonCard lines={3} />
          </li>
        ))}
      </ul>
    </main>
  );
}
