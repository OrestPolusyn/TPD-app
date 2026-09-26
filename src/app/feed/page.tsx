import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getRecentReports } from "@/lib/data/reports";
import { getRecentOfficeUpdates } from "@/lib/data/communityNotes";
import { getRuleChanges } from "@/lib/data/ruleChanges";
import { madridDate } from "@/lib/stats";
import { FEED_OFFICE_UPDATES, FEED_RULE_CHANGES } from "@/lib/data/feedCount";
import { OutcomeLabel } from "@/components/shared/OutcomeLabel";
import { Avatar } from "@/components/shared/Avatar";
import { MarkFeedSeen } from "@/components/shared/MarkFeedSeen";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * What has been added lately, across every location.
 *
 * The site is otherwise navigated by place — you have to know where to look
 * before you can see anything. This is the other direction: what changed
 * lately, newest first — rule changes, then fresh card updates per office,
 * then reports (which is also what the bell in the header counts).
 */
export default async function FeedPage() {
  const t = await getTranslations("feed");
  const supabase = await createClient();
  const [reports, updates, ruleChanges] = await Promise.all([
    getRecentReports(supabase),
    getRecentOfficeUpdates(supabase, 14, FEED_OFFICE_UPDATES),
    getRuleChanges(supabase, { limit: FEED_RULE_CHANGES }),
  ]);
  const today = madridDate(new Date());

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 p-4 sm:p-6">
      <MarkFeedSeen />
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">{t("subtitle")}</p>
      </div>

      {ruleChanges.length > 0 ? (
        <section className="rounded-[var(--radius-md)] border border-[var(--highlight-border)] bg-[var(--highlight-bg)] p-4 text-sm">
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <h2 className="font-medium">⚠️ {t("rulesTitle")}</h2>
            <Link href="/changes" className="text-xs underline">
              {t("rulesAll")}
            </Link>
          </div>
          <ul className="flex flex-col gap-1">
            {ruleChanges.map((c) => (
              <li key={c.id} className="leading-snug">
                <span className="font-medium">
                  {c.effective_date > today && !c.title.startsWith("Очікується")
                    ? t("upcoming", { date: formatDate(c.effective_date) })
                    : formatDate(c.effective_date)}
                </span>
                {c.location_id ? (
                  <>
                    {" · "}
                    <Link href={`/locations/${c.location_id}`} className="underline">
                      {c.city}
                    </Link>
                  </>
                ) : null}
                {": "}
                {c.title}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {updates.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-[var(--muted)]">{t("updatesTitle")}</h2>
          <ul className="flex flex-col gap-2">
            {updates.map((u) => (
              <li
                key={u.location_id}
                className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-4 text-sm shadow-[var(--shadow-sm)]"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <Link href={`/locations/${u.location_id}`} className="font-medium no-underline hover:underline">
                    📍 {u.city}
                  </Link>
                  <span className="text-xs text-[var(--muted)]">{t("addedOn", { date: formatDate(madridDate(new Date(u.added_at))) })}</span>
                </div>
                <ul className="mt-1.5 flex flex-col gap-0.5">
                  {u.bullets.slice(0, 3).map((b) => (
                    <li key={b} className="flex gap-1.5 leading-snug">
                      <span aria-hidden="true" className="text-[var(--muted)]">
                        •
                      </span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
                {u.bullets.length > 3 ? (
                  <Link href={`/locations/${u.location_id}`} className="mt-1 inline-block text-xs underline">
                    {t("moreBullets", { count: u.bullets.length - 3 })}
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {reports.length > 0 ? <h2 className="-mb-2 text-sm font-medium text-[var(--muted)]">{t("reportsTitle")}</h2> : null}

      {reports.length === 0 && updates.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">{t("empty")}</p>
      ) : reports.length === 0 ? null : (
        <ul className="flex flex-col gap-3">
          {reports.map((report) => (
            <li
              key={report.id}
              className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)]"
            >
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Avatar name={report.author_name} photoUrl={report.author_avatar_url} size={28} />
                <span className="font-medium">{report.author_name}</span>
                <span className="text-[var(--muted)]">·</span>
                <span className="text-[var(--muted)]">{formatDate(report.event_date)}</span>
              </div>

              <Link
                href={`/locations/${report.location_id}#report-${report.id}`}
                className="mt-2 block font-medium no-underline hover:underline"
              >
                {report.location_name}
              </Link>

              <div className="mt-2">
                <OutcomeLabel outcome={report.outcome} />
              </div>

              {report.comment ? <p className="mt-2 whitespace-pre-wrap text-sm">{report.comment}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
