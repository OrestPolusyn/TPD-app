import { LoadingIndicator } from "@/components/shared/LoadingIndicator";
import { SkeletonCard } from "@/components/shared/SkeletonCard";

export default function Loading() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-4 sm:p-6">
      <div className="h-8 w-1/2 animate-pulse rounded bg-[var(--border)]" aria-hidden="true" />
      <LoadingIndicator />
      <div className="h-10 w-full animate-pulse rounded-md bg-[var(--surface)]" aria-hidden="true" />
      <div className="flex flex-col gap-2">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <SkeletonCard key={i} lines={0} />
        ))}
      </div>
    </main>
  );
}
