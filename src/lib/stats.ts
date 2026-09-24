import type { SupabaseClient } from "@supabase/supabase-js";
import messages from "../../messages/uk.json";

/** Days shown in the sign-ups chart and counted as "last 30 days". */
export const STATS_WINDOW_DAYS = 30;

export interface SiteStats {
  /** Anonymous visitors, signed in or not (0027). A person counts once per
   * day, so 7/30-day figures are sums of daily visitors, not unique people. */
  visits: {
    today: number;
    last7: number;
    last30: number;
    views30: number;
    byDay: { date: string; count: number }[];
    topPaths: { path: string; views: number; visitors: number }[];
  };
  users: { total: number; today: number; last7: number; last30: number };
  /** One entry per Madrid calendar day, oldest first, zero-filled. */
  signupsByDay: { date: string; count: number }[];
  latestUsers: { name: string; username: string | null; createdAt: string }[];
  reports: { total: number; last7: number };
  comments: number;
  briefVotes: number;
  pendingSuggestions: number;
}

/** YYYY-MM-DD in Spain's time zone — "today" means the users' today, not UTC's. */
export function madridDate(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(d);
}

/** The `days` Madrid dates ending at `now`, oldest first. */
export function lastDays(now: Date, days: number): string[] {
  const out: string[] = [];
  for (let i = days - 1; i >= 0; i--) out.push(madridDate(new Date(now.getTime() - i * 86_400_000)));
  return out;
}

/** Zero-filled per-day counts for `days`, from row timestamps. */
export function countByDay(timestamps: string[], days: string[]): { date: string; count: number }[] {
  const counts = new Map(days.map((d) => [d, 0]));
  for (const ts of timestamps) {
    const day = madridDate(new Date(ts));
    if (counts.has(day)) counts.set(day, counts.get(day)! + 1);
  }
  return days.map((date) => ({ date, count: counts.get(date)! }));
}

async function count(query: PromiseLike<{ count: number | null; error: unknown }>): Promise<number> {
  const { count: n, error } = await query;
  if (error) throw error;
  return n ?? 0;
}

/**
 * Who has joined and what they have done, for the owner only.
 *
 * Takes the service-role client: these are totals across every user, which
 * no user's RLS can see (profiles are owner-only). Callers must check who is
 * asking before calling — the /admin/stats page (moderator role) and the
 * bot's /stats (moderator chat only) both do.
 */
export async function getSiteStats(admin: SupabaseClient, now: Date = new Date()): Promise<SiteStats> {
  const days = lastDays(now, STATS_WINDOW_DAYS);
  // A little wider than 30 days so the oldest Madrid day is complete whatever
  // the UTC offset; countByDay drops anything outside `days`.
  const since = new Date(now.getTime() - (STATS_WINDOW_DAYS + 1) * 86_400_000).toISOString();
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000).toISOString();

  const [visitDays, topPaths, recent, latest, totalUsers, reports, reports7, comments, briefVotes, pending] = await Promise.all([
    admin.rpc("visit_stats", { p_since: days[0] }),
    admin.rpc("top_paths", { p_since: days[0], p_limit: 8 }),
    admin.from("profiles").select("created_at").gte("created_at", since),
    admin
      .from("profiles")
      .select("display_name, telegram_first_name, telegram_username, created_at")
      .order("created_at", { ascending: false })
      .limit(10),
    count(admin.from("profiles").select("id", { count: "exact", head: true })),
    count(admin.from("reports").select("id", { count: "exact", head: true })),
    count(admin.from("reports").select("id", { count: "exact", head: true }).gte("created_at", weekAgo)),
    count(admin.from("comments").select("id", { count: "exact", head: true })),
    count(admin.from("location_brief_confirmations").select("user_id", { count: "exact", head: true })),
    count(admin.from("location_suggestions").select("id", { count: "exact", head: true }).eq("status", "pending")),
  ]);
  if (visitDays.error) throw visitDays.error;
  if (topPaths.error) throw topPaths.error;
  if (recent.error) throw recent.error;
  if (latest.error) throw latest.error;

  const recentTimes = (recent.data ?? []).map((r) => r.created_at as string);
  const signupsByDay = countByDay(recentTimes, days);
  const sumLast = (n: number) => signupsByDay.slice(-n).reduce((s, d) => s + d.count, 0);

  const visitsByDate = new Map(
    ((visitDays.data ?? []) as { day: string; visitors: number; views: number }[]).map((r) => [r.day, r])
  );
  const visitorsByDay = days.map((date) => ({ date, count: Number(visitsByDate.get(date)?.visitors ?? 0) }));
  const sumVisitors = (n: number) => visitorsByDay.slice(-n).reduce((s, d) => s + d.count, 0);

  return {
    visits: {
      today: sumVisitors(1),
      last7: sumVisitors(7),
      last30: sumVisitors(STATS_WINDOW_DAYS),
      views30: [...visitsByDate.values()].reduce((s, r) => s + Number(r.views), 0),
      byDay: visitorsByDay,
      topPaths: ((topPaths.data ?? []) as { path: string; views: number; visitors: number }[]).map((r) => ({
        path: r.path,
        views: Number(r.views),
        visitors: Number(r.visitors),
      })),
    },
    users: { total: totalUsers, today: sumLast(1), last7: sumLast(7), last30: sumLast(STATS_WINDOW_DAYS) },
    signupsByDay,
    latestUsers: (latest.data ?? []).map((u) => ({
      name: (u.display_name as string | null)?.trim() || (u.telegram_first_name as string | null)?.trim() || "—",
      username: (u.telegram_username as string | null) ?? null,
      createdAt: u.created_at as string,
    })),
    reports: { total: reports, last7: reports7 },
    comments,
    briefVotes,
    pendingSuggestions: pending,
  };
}

/** The bot's /stats reply. */
export function formatStatsMessage(stats: SiteStats, siteUrl: string): string {
  return messages.telegramBot.statsNotice
    .replace("{vToday}", String(stats.visits.today))
    .replace("{v7}", String(stats.visits.last7))
    .replace("{v30}", String(stats.visits.last30))
    .replace("{views30}", String(stats.visits.views30))
    .replace("{total}", String(stats.users.total))
    .replace("{today}", String(stats.users.today))
    .replace("{last7}", String(stats.users.last7))
    .replace("{last30}", String(stats.users.last30))
    .replace("{reports}", String(stats.reports.total))
    .replace("{reports7}", String(stats.reports.last7))
    .replace("{comments}", String(stats.comments))
    .replace("{votes}", String(stats.briefVotes))
    .replace("{pending}", String(stats.pendingSuggestions))
    .replace("{url}", `${siteUrl.replace(/\/$/, "")}/admin/stats`);
}
