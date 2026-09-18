import { getTranslations } from "next-intl/server";
import { Spinner } from "@/components/shared/Spinner";

/**
 * Visible "Завантаження…" row for route-level loading.tsx fallbacks.
 *
 * Deliberately visible text rather than a bare skeleton: on a phone a pulsing
 * grey block reads as "the page is broken" just as easily as "the page is
 * loading", which is exactly the feedback we got.
 */
export async function LoadingIndicator({ className = "" }: { className?: string }) {
  const t = await getTranslations("common");
  return (
    <p role="status" aria-live="polite" className={`flex items-center gap-2 text-sm text-[var(--muted)] ${className}`}>
      <Spinner />
      {t("loading")}
    </p>
  );
}
