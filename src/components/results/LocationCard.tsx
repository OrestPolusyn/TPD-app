import { getTranslations } from "next-intl/server";
import Link from "next/link";
import type { LocationRow } from "@/lib/matching/types";
import type { LocationPageData } from "@/lib/matching/types";
import { formatDate, formatMonthYear } from "@/lib/format";

export async function LocationCard({
  location,
  data,
  searchQuery,
}: {
  location: LocationRow;
  data: LocationPageData;
  /** docs/mil from the current /results URL, carried over so the location page keeps the same U. */
  searchQuery?: string;
}) {
  const t = await getTranslations("results.card");
  const tMethod = await getTranslations("appointmentMethods");

  return (
    <li className="rounded-md border border-[var(--border)] p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-medium">{location.name}</h3>
          <p className="text-sm text-[var(--muted)]">{location.city}</p>
        </div>
      </div>

      <p className="mt-2 text-sm">{location.address ?? t("addressUnknown")}</p>

      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm">
        <span>{tMethod(location.appointment_method)}</span>
        {data.walk_in_count > 0 ? (
          <span
            className={
              data.walk_in_highlighted
                ? "rounded bg-[var(--highlight-bg)] px-1.5 py-0.5 font-medium border border-[var(--highlight-border)]"
                : ""
            }
          >
            {t("walkIn", { count: data.walk_in_count })}
          </span>
        ) : null}
      </div>

      {data.earliest_appointment ? (
        <p className="mt-1 text-sm">
          {t("earliestAppointment", {
            month: formatMonthYear(data.earliest_appointment.earliest_appointment_offered),
            count: data.earliest_appointment.user_count,
          })}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <span className="font-medium">{t("freshMatches", { count: data.fresh_matching_count })}</span>
        {data.latest_matching_date ? <span>{t("latestReport", { date: formatDate(data.latest_matching_date) })}</span> : null}
        {data.fresh_unsuccessful_count > 0 ? <span>{t("unsuccessfulCount", { count: data.fresh_unsuccessful_count })}</span> : null}
      </div>

      <Link
        href={`/locations/${location.id}${searchQuery ? `?${searchQuery}` : ""}`}
        className="mt-3 inline-block text-sm font-medium underline"
      >
        {t("openLocation")}
      </Link>
    </li>
  );
}
