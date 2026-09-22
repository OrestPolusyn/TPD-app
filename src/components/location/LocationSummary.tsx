import { getTranslations } from "next-intl/server";
import type { ReportDetail } from "@/lib/data/reports";
import type { ReportOutcome } from "@/lib/matching/types";
import { formatDate, daysSince } from "@/lib/format";

/** "They took the application" — the question people actually come here with.
 * A pending decision counts: the applicant was received and filed. */
const ACCEPTED: ReportOutcome[] = ["protection_granted", "application_accepted_pending"];

/** Past this, the newest report is old enough that it may no longer describe
 * the place. Offices change practice quietly and nothing here would say so. */
const STALE_AFTER_DAYS = 180;

const TOP_DOCUMENTS = 3;

/**
 * The answer at a glance, above the reports themselves.
 *
 * Everything below it is a chronological list someone has to read and total up
 * in their head: how many people got in, what was asked for, whether any of it
 * is recent. The numbers are already in the page's data — this just does the
 * arithmetic the reader would otherwise do.
 */
export async function LocationSummary({
  reports,
  documentLabels,
}: {
  reports: ReportDetail[];
  documentLabels: Map<string, string>;
}) {
  const t = await getTranslations("location");
  // CommunityBlock already says "nobody has reported this place yet", and a row
  // of zeroes says it worse.
  if (reports.length === 0) return null;

  const accepted = reports.filter((r) => ACCEPTED.includes(r.outcome)).length;
  const latest = reports.reduce((newest, r) => (r.event_date > newest ? r.event_date : newest), reports[0].event_date);

  const requestCounts = new Map<string, number>();
  for (const report of reports) {
    for (const doc of report.documents) {
      if (doc.status !== "requested") continue;
      requestCounts.set(doc.document_code, (requestCounts.get(doc.document_code) ?? 0) + 1);
    }
  }
  const topDocuments = [...requestCounts.entries()]
    .sort(([, a], [, b]) => b - a)
    .slice(0, TOP_DOCUMENTS)
    .map(([code]) => documentLabels.get(code) ?? code);

  const ageDays = daysSince(latest);

  return (
    <section
      aria-label={t("summaryTitle")}
      className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)]"
    >
      <dl className="grid grid-cols-3 gap-3 text-center">
        <div>
          <dd className="text-2xl font-bold tabular-nums">{reports.length}</dd>
          <dt className="text-xs text-[var(--muted)]">{t("summaryReports")}</dt>
        </div>
        <div>
          <dd className="text-2xl font-bold tabular-nums text-[var(--success)]">
            {accepted}
            <span className="text-base font-medium text-[var(--muted)]">/{reports.length}</span>
          </dd>
          <dt className="text-xs text-[var(--muted)]">{t("summaryAccepted")}</dt>
        </div>
        <div>
          <dd className="text-sm font-semibold">{formatDate(latest)}</dd>
          <dt className="text-xs text-[var(--muted)]">{t("summaryLatest")}</dt>
        </div>
      </dl>

      {topDocuments.length > 0 ? (
        <p className="mt-3 border-t border-[var(--border)] pt-3 text-sm">
          <span className="text-[var(--muted)]">{t("summaryTopDocs")}: </span>
          {topDocuments.join(", ")}
        </p>
      ) : null}

      {ageDays > STALE_AFTER_DAYS ? (
        <p className="mt-2 text-xs text-[var(--warning)]">{t("summaryStale")}</p>
      ) : null}
    </section>
  );
}
