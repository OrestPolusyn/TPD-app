import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getRecentReports } from "@/lib/data/reports";
import { OutcomeLabel } from "@/components/shared/OutcomeLabel";
import { Avatar } from "@/components/shared/Avatar";
import { MarkFeedSeen } from "@/components/shared/MarkFeedSeen";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * What has been added lately, across every location.
 *
 * The site is otherwise navigated by place — you have to know where to look
 * before you can see anything. This is the other direction: reports as they
 * arrive, which is also what the bell in the header counts.
 */
export default async function FeedPage() {
  const t = await getTranslations("feed");
  const supabase = await createClient();
  const reports = await getRecentReports(supabase);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 p-4 sm:p-6">
      <MarkFeedSeen />
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">{t("subtitle")}</p>
      </div>

      {reports.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">{t("empty")}</p>
      ) : (
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
