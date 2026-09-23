import { getTranslations } from "next-intl/server";
import type { LocationRow } from "@/lib/matching/types";
import { formatDate, daysSince } from "@/lib/format";

/** Past this, practice has probably moved on — offices change week to week. */
const STALE_AFTER_DAYS = 45;

/**
 * What this office is actually doing right now, as reported by people who
 * went there.
 *
 * Kept visually and textually apart from the official block: this is not
 * verified against any source, it is what someone said this week, and it is
 * the most useful thing on the page precisely because official lists never
 * carry it. Always dated, because a three-month-old "they accept a stamp" is
 * worse than nothing.
 */
export async function PracticalInfo({ location }: { location: LocationRow }) {
  const t = await getTranslations("location");
  if (!location.practical_info) return null;

  const updatedAt = location.practical_info_updated_at;
  const stale = updatedAt ? daysSince(updatedAt) > STALE_AFTER_DAYS : true;

  return (
    <section className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--accent-soft)] p-4">
      <h2 className="mb-2 font-medium">{t("practicalTitle")}</h2>
      <p className="whitespace-pre-wrap text-sm">{location.practical_info}</p>
      <p className="mt-3 border-t border-[var(--border)] pt-2 text-xs text-[var(--muted)]">
        {updatedAt ? t("practicalUpdated", { date: formatDate(updatedAt) }) : t("practicalUndated")}
        {" · "}
        {t("practicalDisclaimer")}
      </p>
      {stale ? <p className="mt-1 text-xs text-[var(--warning)]">{t("practicalStale")}</p> : null}
    </section>
  );
}
