import type { SupabaseClient } from "@supabase/supabase-js";
import messages from "../../messages/uk.json";
import { channelGrowth, recordChannelMembers, type ChannelGrowth } from "@/lib/channelStats";

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
  channel: ChannelStats;
  success: SuccessStats;
}

/** The updates channel: who follows it and what its posts reach. */
export interface ChannelStats extends ChannelGrowth {
  posts: number;
  posts7: number;
  /** "✅ Актуально" taps under posts. */
  votes: number;
  /** Known once the chat watch has read the posts' views; null before. */
  views: { total: number; perPost: number; posts: number } | null;
}

/** Is the project doing its job: growing, used, covering the offices. */
export interface SuccessStats {
  /** Visitors and sign-ups in the 7 days before the last 7, for the trend. */
  visitorsPrev7: number;
  signupsPrev7: number;
  /** Published reports per outcome. */
  outcomes: Record<string, number>;
  /** People who wrote at least one report. */
  reporters: number;
  offices: {
    total: number;
    /** With a report or a card note — something to read beyond the address. */
    covered: number;
    /** Card updated or reported on in the last 14 days. */
    fresh14: number;
  };
  /** Chat findings the owner approved for the site. */
  approvedFromChats: number;
  /** Stories and "changed" messages sent by channel readers. */
  readerInput: number;
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

  const twoWeeksAgo = new Date(now.getTime() - 14 * 86_400_000).toISOString();

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

  // Owner-only figures beyond the basics. Each is optional: a missing table
  // or Telegram being unreachable must not take the whole page down.
  const [liveMembers, readings, posts, votes, reportRows, officeCount, notes, actions] = await Promise.all([
    recordChannelMembers(admin, days[days.length - 1]).catch(() => null),
    admin.from("channel_member_counts").select("day, members").order("day"),
    admin.from("channel_posts").select("created_at, views").not("message_id", "is", null),
    admin.from("channel_post_votes").select("post_id", { count: "exact", head: true }),
    admin.from("reports").select("outcome, user_id, location_id, created_at").eq("moderation_status", "published"),
    admin.from("locations").select("id", { count: "exact", head: true }).eq("moderation_status", "published"),
    admin.from("community_notes").select("location_id, created_at").eq("moderation_status", "published").neq("kind", "unconfirmed"),
    admin.from("bot_actions").select("kind, source:payload->>source, done_at"),
  ]);

  const recentTimes = (recent.data ?? []).map((r) => r.created_at as string);
  const signupsByDay = countByDay(recentTimes, days);
  const sumLast = (n: number) => signupsByDay.slice(-n).reduce((s, d) => s + d.count, 0);

  const visitsByDate = new Map(
    ((visitDays.data ?? []) as { day: string; visitors: number; views: number }[]).map((r) => [r.day, r])
  );
  const visitorsByDay = days.map((date) => ({ date, count: Number(visitsByDate.get(date)?.visitors ?? 0) }));
  const sumVisitors = (n: number) => visitorsByDay.slice(-n).reduce((s, d) => s + d.count, 0);
  const sumBetween = (series: { count: number }[], from: number, to: number) =>
    series.slice(-from, -to).reduce((s, d) => s + d.count, 0);

  const postRows = (posts.data ?? []) as { created_at: string; views: number | null }[];
  const viewed = postRows.filter((p) => p.views !== null);
  const totalViews = viewed.reduce((s, p) => s + (p.views ?? 0), 0);

  const reportList = (reportRows.data ?? []) as { outcome: string; user_id: string | null; location_id: string; created_at: string }[];
  const outcomes: Record<string, number> = {};
  for (const r of reportList) outcomes[r.outcome] = (outcomes[r.outcome] ?? 0) + 1;
  const noteList = (notes.data ?? []) as { location_id: string; created_at: string }[];
  const covered = new Set([...reportList.map((r) => r.location_id), ...noteList.map((n) => n.location_id)]);
  const fresh = new Set(
    [...reportList, ...noteList].filter((r) => r.created_at >= twoWeeksAgo).map((r) => r.location_id)
  );
  const actionList = (actions.data ?? []) as { kind: string; source: string | null; done_at: string | null }[];

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
    channel: {
      ...channelGrowth((readings.data ?? []) as { day: string; members: number }[], liveMembers, days),
      posts: postRows.length,
      posts7: postRows.filter((p) => p.created_at >= weekAgo).length,
      votes: votes.count ?? 0,
      views: viewed.length > 0 ? { total: totalViews, perPost: Math.round(totalViews / viewed.length), posts: viewed.length } : null,
    },
    success: {
      visitorsPrev7: sumBetween(visitorsByDay, 14, 7),
      signupsPrev7: sumBetween(signupsByDay, 14, 7),
      outcomes,
      reporters: new Set(reportList.map((r) => r.user_id).filter(Boolean)).size,
      offices: { total: officeCount.count ?? 0, covered: covered.size, fresh14: fresh.size },
      approvedFromChats: actionList.filter((a) => a.source === "draft" && a.done_at).length,
      readerInput: actionList.filter((a) => a.kind === "publish_story" || (a.kind === "accept_change" && a.source !== "draft")).length,
    },
  };
}

/** "+3", "−2", "0"; "—" when unknown. */
export function signed(n: number | null): string {
  if (n === null) return "—";
  return n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "0";
}

/** Percent change from `before` to `after`; null when there is nothing to compare with. */
export function trend(after: number, before: number): number | null {
  return before > 0 ? Math.round(((after - before) / before) * 100) : null;
}

export function percent(part: number, whole: number): number | null {
  return whole > 0 ? Math.round((part / whole) * 100) : null;
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
    .replace("{channel}", formatChannelLines(stats))
    .replace("{success}", formatSuccessLines(stats))
    .replace("{url}", `${siteUrl.replace(/\/$/, "")}/admin/stats`);
}

function formatChannelLines({ channel: c }: SiteStats): string {
  const t = messages.telegramBot;
  if (c.members === null) return t.statsChannelUnknown;
  const lines = [t.statsChannelMembers.replace("{members}", String(c.members))];
  if (c.change7 !== null) lines.push(t.statsChannel7.replace("{n}", signed(c.change7)));
  if (c.change30 !== null) lines.push(t.statsChannel30.replace("{n}", signed(c.change30)));
  if (c.change7 === null && c.since) {
    const first = c.byDay.find((d) => d.date === c.since)?.count;
    if (first !== undefined) lines.push(t.statsChannelSince.replace("{n}", signed(c.members - first)).replace("{date}", c.since.split("-").reverse().slice(0, 2).join(".")));
  }
  lines.push(t.statsChannelPosts.replace("{posts}", String(c.posts)).replace("{posts7}", String(c.posts7)).replace("{votes}", String(c.votes)));
  if (c.views) lines.push(t.statsChannelViews.replace("{perPost}", String(c.views.perPost)).replace("{total}", String(c.views.total)));
  return lines.join("\n");
}

function formatSuccessLines(stats: SiteStats): string {
  const t = messages.telegramBot;
  const s = stats.success;
  const pct = (n: number | null) => (n === null ? "—" : `${n > 0 ? "+" : ""}${n}%`);
  const reportsTotal = Object.values(s.outcomes).reduce((a, b) => a + b, 0);
  return [
    t.statsTrendVisitors.replace("{now}", String(stats.visits.last7)).replace("{before}", String(s.visitorsPrev7)).replace("{pct}", pct(trend(stats.visits.last7, s.visitorsPrev7))),
    t.statsTrendSignups.replace("{now}", String(stats.users.last7)).replace("{before}", String(s.signupsPrev7)).replace("{pct}", pct(trend(stats.users.last7, s.signupsPrev7))),
    t.statsConversion.replace("{pct}", String(percent(stats.users.last30, stats.visits.last30) ?? "—")),
    t.statsGranted.replace("{granted}", String(s.outcomes.protection_granted ?? 0)).replace("{total}", String(reportsTotal)),
    t.statsReporters.replace("{n}", String(s.reporters)).replace("{pct}", String(percent(s.reporters, stats.users.total) ?? "—")),
    t.statsOffices.replace("{covered}", String(s.offices.covered)).replace("{total}", String(s.offices.total)).replace("{fresh}", String(s.offices.fresh14)),
    t.statsCommunity.replace("{chats}", String(s.approvedFromChats)).replace("{readers}", String(s.readerInput)),
  ].join("\n");
}
