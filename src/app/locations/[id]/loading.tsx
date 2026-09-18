import { LoadingIndicator } from "@/components/shared/LoadingIndicator";
import { SkeletonCard } from "@/components/shared/SkeletonCard";

export default function Loading() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-4 sm:p-6">
      <div className="h-8 w-2/3 animate-pulse rounded bg-[var(--border)]" aria-hidden="true" />
      <LoadingIndicator />
      <SkeletonCard lines={4} />
      <SkeletonCard lines={3} />
    </main>
  );
}
