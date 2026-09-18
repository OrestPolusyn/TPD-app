import { LoadingIndicator } from "@/components/shared/LoadingIndicator";
import { SkeletonCard } from "@/components/shared/SkeletonCard";

/**
 * Default fallback for every route that does not define its own. All data
 * routes are `force-dynamic` and query Supabase before returning any JSX, so
 * without this a navigation showed the previous page frozen with no feedback
 * until the query came back — the reported "нічого не зрозуміло" on mobile.
 *
 * It also makes those routes prefetchable: a dynamic route is not prefetched at
 * all unless it has a loading boundary, so this shortens the taps as well as
 * explaining them.
 *
 * Trap worth knowing: if the root layout (or NavBar/Footer) ever reaches for
 * cookies(), headers() or an uncached fetch, Next stops rendering loading
 * fallbacks app-wide and navigation goes back to blocking. Today they only
 * await getTranslations, which resolves from a static import.
 */
export default function Loading() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-4 sm:p-6">
      <div className="h-8 w-1/2 animate-pulse rounded bg-[var(--border)]" aria-hidden="true" />
      <LoadingIndicator />
      <div className="flex flex-col gap-3">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard lines={1} />
      </div>
    </main>
  );
}
