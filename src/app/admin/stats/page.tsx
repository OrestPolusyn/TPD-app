import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSiteStats, madridDate, type SiteStats } from "@/lib/stats";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Статистика — TP Spain", robots: { index: false } };

/** "2026-09-24" → "24.09" for the chart's axis. */
function shortDate(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}.${m}`;
}

function Tile({ label, value, accent = false }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-3 shadow-[var(--shadow-sm)]">
      <p className="text-xs text-[var(--muted)]">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${accent ? "text-[var(--accent)]" : ""}`}>{value}</p>
    </div>
  );
}

/**
 * A per-day count as thin bars — one series, so one colour and no legend;
 * the title names it. Plain HTML rather than a chart library: this page is
 * for one person and the bundle budget is shared with pages that are not.
 * Each bar carries its own hover tooltip and aria-label, and the same numbers
 * sit in a visually hidden table for screen readers.
 */
async function DailyBars({ title, data }: { title: string; data: SiteStats["signupsByDay"] }) {
  const t = await getTranslations("adminStats");
  const max = Math.max(1, ...data.map((d) => d.count));
  const middle = data[Math.floor(data.length / 2)];

  return (
    <section className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)]">
      <h2 className="mb-3 text-sm font-medium">{title}</h2>

      <div className="flex h-32 items-end gap-[2px] border-b border-[var(--border)]" aria-hidden="true">
        {data.map((d) => (
          <div key={d.date} className="group relative flex h-full flex-1 items-end justify-center">
            <div
              className="w-full max-w-3 rounded-t-[4px] bg-[var(--accent)] transition-opacity group-hover:opacity-80"
              style={{ height: d.count === 0 ? "0" : `${Math.max(4, (d.count / max) * 100)}%` }}
            />
            <span className="pointer-events-none absolute bottom-full z-10 mb-1 hidden whitespace-nowrap rounded bg-[var(--foreground)] px-1.5 py-0.5 text-xs text-[var(--background)] group-hover:block">
              {t("chartBar", { date: shortDate(d.date), count: d.count })}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-xs text-[var(--muted)]" aria-hidden="true">
        <span>{shortDate(data[0].date)}</span>
        <span>{shortDate(middle.date)}</span>
        <span>{shortDate(data[data.length - 1].date)}</span>
      </div>

      <table className="sr-only">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th scope="col">{t("tableDate")}</th>
            <th scope="col">{t("tableCount")}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.date}>
              <td>{shortDate(d.date)}</td>
              <td>{d.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

const PAGE_NAMES: Record<string, string> = {
  "/": "Головна",
  "/results": "Результати пошуку",
  "/locations": "Усі локації",
  "/feed": "Нові звіти",
  "/faq": "Питання",
  "/me": "Мій кабінет",
  "/reports/new": "Новий звіт",
  "/about": "Про проєкт",
  "/privacy": "Приватність",
};

/** Readable names for the top pages: fixed ones by path, offices by name. */
async function namePaths(admin: ReturnType<typeof createAdminClient>, paths: string[]): Promise<Map<string, string>> {
  const names = new Map(paths.filter((p) => p in PAGE_NAMES).map((p) => [p, PAGE_NAMES[p]]));
  const officeIds = paths.map((p) => /^\/locations\/([^/]+)$/.exec(p)?.[1]).filter((id): id is string => !!id);
  if (officeIds.length > 0) {
    const { data } = await admin.from("locations").select("id, city, type").in("id", officeIds);
    for (const loc of data ?? []) {
      names.set(`/locations/${loc.id}`, `${loc.type === "creade" ? "CREADE" : "Поліція"} — ${loc.city}`);
    }
  }
  return names;
}

export default async function AdminStatsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  // Own row only (profiles_select_own); a 404 rather than "forbidden", so the
  // page's existence is not advertised to anyone who stumbles on the URL.
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (me?.role !== "moderator") notFound();

  const t = await getTranslations("adminStats");
  const admin = createAdminClient();
  const stats = await getSiteStats(admin);
  const pageNames = await namePaths(admin, stats.visits.topPaths.map((p) => p.path));

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">{t("subtitle")}</p>
      </div>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-sm font-medium">{t("visitorsTitle")}</h2>
          <p className="text-xs text-[var(--muted)]">{t("visitorsHint")}</p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tile label={t("visitorsToday")} value={stats.visits.today} accent />
          <Tile label={t("visitors7")} value={stats.visits.last7} />
          <Tile label={t("visitors30")} value={stats.visits.last30} />
          <Tile label={t("views30")} value={stats.visits.views30} />
        </div>
        <DailyBars title={t("visitorsChartTitle")} data={stats.visits.byDay} />
        {stats.visits.topPaths.length > 0 ? (
          <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)]">
            <h3 className="mb-2 text-sm font-medium">{t("topPagesTitle")}</h3>
            <ul className="flex flex-col divide-y divide-[var(--border)] text-sm">
              {stats.visits.topPaths.map((p) => (
                <li key={p.path} className="flex items-baseline justify-between gap-3 py-1.5">
                  <a href={p.path} className="min-w-0 truncate underline">
                    {pageNames.get(p.path) ?? p.path}
                  </a>
                  <span className="shrink-0 text-xs tabular-nums text-[var(--muted)]">
                    {t("topPagesViews", { views: p.views, visitors: p.visitors })}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <h2 className="-mb-2 text-sm font-medium">{t("usersTitle")}</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label={t("usersTotal")} value={stats.users.total} accent />
        <Tile label={t("usersToday")} value={stats.users.today} />
        <Tile label={t("users7")} value={stats.users.last7} />
        <Tile label={t("users30")} value={stats.users.last30} />
      </div>

      <DailyBars title={t("chartTitle")} data={stats.signupsByDay} />

      <section>
        <h2 className="mb-2 text-sm font-medium">{t("activityTitle")}</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Tile label={t("reports")} value={stats.reports.total} />
          <Tile label={t("reports7")} value={stats.reports.last7} />
          <Tile label={t("comments")} value={stats.comments} />
          <Tile label={t("briefVotes")} value={stats.briefVotes} />
          <Tile label={t("pendingSuggestions")} value={stats.pendingSuggestions} />
        </div>
      </section>

      <section className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)]">
        <h2 className="mb-2 text-sm font-medium">{t("latestTitle")}</h2>
        <ul className="flex flex-col divide-y divide-[var(--border)] text-sm">
          {stats.latestUsers.map((u, i) => (
            <li key={`${u.createdAt}-${i}`} className="flex items-baseline justify-between gap-3 py-1.5">
              <span className="min-w-0 truncate">
                {u.name}
                {u.username ? <span className="text-[var(--muted)]"> @{u.username}</span> : null}
              </span>
              <span className="shrink-0 text-xs text-[var(--muted)]">{formatDate(madridDate(new Date(u.createdAt)))}</span>
            </li>
          ))}
        </ul>
      </section>

      <p className="text-xs text-[var(--muted)]">{t("botHint")}</p>
    </main>
  );
}
