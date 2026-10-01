/**
 * The updates channel's size and reach, for the owner's statistics.
 *
 * Size comes from the Bot API (the bot that posts there), read on demand and
 * kept once per Madrid day (channel_member_counts, 0036) so growth can be
 * shown. Views per post come from the chat watch's Telegram login, which can
 * see them; the Bot API cannot (see collectPostViews).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { TelegramClient } from "telegram";
import { callTelegram } from "@/lib/telegram/api";
import { getUpdatesChannel } from "@/lib/telegram/settings";

/** Subscribers right now, or null when the channel or bot is not set up. */
export async function getChannelMemberCount(): Promise<number | null> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const channel = await getUpdatesChannel();
  if (!token || !channel) return null;
  const res = await callTelegram<number>(token, "getChatMemberCount", { chat_id: channel });
  return res.ok && typeof res.result === "number" ? res.result : null;
}

/** Reads the current size and keeps it as the figure for `day` (Madrid). */
export async function recordChannelMembers(admin: SupabaseClient, day: string): Promise<number | null> {
  const members = await getChannelMemberCount();
  if (members === null) return null;
  const { error } = await admin
    .from("channel_member_counts")
    .upsert({ day, members, recorded_at: new Date().toISOString() });
  if (error) console.error("channel size not recorded:", error.message);
  return members;
}

/**
 * Views and forwards of the channel's posts of the last 60 days, through the
 * owner's Telegram login. Best effort: the chat watch must not fail because
 * of it.
 */
export async function collectPostViews(admin: SupabaseClient, client: TelegramClient): Promise<number> {
  const channel = await getUpdatesChannel();
  if (!channel?.startsWith("@")) return 0;
  const since = new Date(Date.now() - 60 * 86_400_000).toISOString();
  const { data: posts } = await admin
    .from("channel_posts")
    .select("id, message_id")
    .not("message_id", "is", null)
    .gte("created_at", since);
  const ids = (posts ?? []).map((p) => p.message_id as number);
  if (ids.length === 0) return 0;

  const messages = await client.getMessages(channel.slice(1), { ids });
  const byMessage = new Map(
    messages.filter((m) => m && typeof m.id === "number").map((m) => [m.id, { views: m.views ?? null, forwards: m.forwards ?? null }])
  );
  const at = new Date().toISOString();
  let updated = 0;
  for (const p of posts ?? []) {
    const seen = byMessage.get(p.message_id as number);
    if (!seen || seen.views === null) continue;
    const { error } = await admin
      .from("channel_posts")
      .update({ views: seen.views, forwards: seen.forwards, views_at: at })
      .eq("id", p.id);
    if (!error) updated++;
  }
  return updated;
}

export interface ChannelGrowth {
  /** Subscribers now (live), or the latest recorded figure. */
  members: number | null;
  /** Change since the reading closest to N days ago; null without one. */
  change7: number | null;
  change30: number | null;
  /** The first day there is a reading for — growth is known from then on. */
  since: string | null;
  byDay: { date: string; count: number }[];
}

/**
 * Growth from the daily readings. A change over N days needs a reading at
 * least N days old; until then the change since the first reading is shown
 * instead (`since`).
 */
export function channelGrowth(
  readings: { day: string; members: number }[],
  live: number | null,
  days: string[]
): ChannelGrowth {
  const sorted = [...readings].sort((a, b) => a.day.localeCompare(b.day));
  const members = live ?? sorted.at(-1)?.members ?? null;
  const today = days.at(-1)!;
  const changeOver = (n: number): number | null => {
    if (members === null) return null;
    const cutoff = days[days.length - 1 - n] ?? null;
    if (!cutoff) return null;
    const base = [...sorted].reverse().find((r) => r.day <= cutoff);
    return base ? members - base.members : null;
  };
  // Carry the last known figure over days without a reading.
  const byDay: { date: string; count: number }[] = [];
  let last: number | null = null;
  const byDate = new Map(sorted.map((r) => [r.day, r.members]));
  for (const r of sorted) if (r.day < days[0]) last = r.members;
  for (const date of days) {
    if (byDate.has(date)) last = byDate.get(date)!;
    if (date === today && live !== null) last = live;
    byDay.push({ date, count: last ?? 0 });
  }
  return { members, change7: changeOver(7), change30: changeOver(30), since: sorted[0]?.day ?? null, byDay };
}
