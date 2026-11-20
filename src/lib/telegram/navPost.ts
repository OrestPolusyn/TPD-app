import { callTelegram } from "@/lib/telegram/api";
import { getUpdatesChannel } from "@/lib/telegram/settings";
import { createAdminClient } from "@/lib/supabase/admin";
import { cityHashtagUk } from "@/lib/cityNames";
import { config } from "@/lib/config";
import messages from "../../../messages/uk.json";

/** app_settings key holding the navigation post's message id in the channel. */
const NAV_MESSAGE_KEY = "nav_post_message_id";
/** Cities are listed by how often the channel wrote about them lately. */
const NAV_WINDOW_DAYS = 60;
const NAV_TOP = 10;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * The channel's pinned "navigation" post: every post already ends with its
 * city's hashtag, so a list of those hashtags is a filter by city — a tap
 * shows that city's posts only. `cities` are locations.city values, most
 * written-about first. Telegram HTML.
 */
export function navPostText(cities: string[]): string {
  const t = messages.telegramBot;
  const tags = [...new Set(cities.map(cityHashtagUk))];
  const top = tags.slice(0, NAV_TOP);
  const rest = tags.slice(NAV_TOP).sort((a, b) => a.localeCompare(b, "uk"));
  const lines = ["🧭 <b>Навігація по каналу</b>", "", "Натисніть на місто — побачите лише його оновлення."];
  if (top.length > 0) lines.push("", "<b>Найчастіше:</b>", esc(top.join(" ")));
  if (rest.length > 0) lines.push("", "<b>Інші міста:</b>", esc(rest.join(" ")));
  lines.push(
    "",
    "<b>За типом:</b>",
    `#${esc(t.postRuleTag)} — правила, що змінилися`,
    `#${esc(t.postUnconfirmedTag)} — поодинокі повідомлення з чатів`,
    "#довідки — довідка ДПСУ",
    "",
    "Вимоги всіх відділків — на сайті, кнопка нижче."
  );
  return lines.join("\n");
}

function navKeyboard() {
  const site = config.siteUrl().replace(/\/$/, "");
  return {
    inline_keyboard: [
      [
        { text: "🔎 Усі відділки", url: `${site}/locations` },
        { text: "🆕 Що нового", url: `${site}/feed` },
      ],
    ],
  };
}

export interface NavPostResult {
  ok: boolean;
  updated?: boolean;
  pinned?: boolean;
  cities?: number;
  error?: string;
}

/**
 * Publishes the navigation post and pins it, or brings the existing one up
 * to date in place (cities come and go). Through the public bot, like every
 * channel post. Pinning needs the bot's right to edit messages in the
 * channel; without it the post still goes out and `pinned` says so.
 */
export async function publishNavPost(): Promise<NavPostResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const channel = await getUpdatesChannel();
  if (!token || !channel) return { ok: false, error: "no_channel" };

  const admin = createAdminClient();
  const since = new Date(Date.now() - NAV_WINDOW_DAYS * 86_400_000).toISOString();
  const { data: posts, error } = await admin
    .from("channel_posts")
    .select("locations!inner(city)")
    .not("message_id", "is", null)
    .gte("created_at", since)
    .limit(5000);
  if (error) return { ok: false, error: error.message };
  const counts = new Map<string, number>();
  for (const p of (posts ?? []) as unknown as { locations: { city: string } }[]) {
    counts.set(p.locations.city, (counts.get(p.locations.city) ?? 0) + 1);
  }
  const cities = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([city]) => city);
  const text = navPostText(cities);

  const { data: saved } = await admin.from("app_settings").select("value").eq("key", NAV_MESSAGE_KEY).maybeSingle();
  const savedId = Number(saved?.value);
  if (Number.isInteger(savedId) && savedId > 0) {
    const res = await callTelegram(token, "editMessageText", {
      chat_id: channel,
      message_id: savedId,
      text,
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
      reply_markup: navKeyboard(),
    });
    if (res.ok || res.description?.includes("message is not modified")) return { ok: true, updated: true, cities: cities.length };
    // Deleted by hand in the channel: post it anew below.
    if (!res.description?.includes("message to edit not found")) return { ok: false, error: res.description };
  }

  const sent = await callTelegram<{ message_id: number }>(token, "sendMessage", {
    chat_id: channel,
    text,
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
    disable_notification: true,
    reply_markup: navKeyboard(),
  });
  if (!sent.ok || !sent.result) return { ok: false, error: sent.description };
  await admin
    .from("app_settings")
    .upsert({ key: NAV_MESSAGE_KEY, value: String(sent.result.message_id), updated_at: new Date().toISOString() });

  const pin = await callTelegram(token, "pinChatMessage", { chat_id: channel, message_id: sent.result.message_id, disable_notification: true });
  return { ok: true, updated: false, pinned: pin.ok, cities: cities.length, error: pin.ok ? undefined : pin.description };
}
