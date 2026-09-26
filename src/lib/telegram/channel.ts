import { callTelegram } from "@/lib/telegram/api";
import { getUpdatesChannel } from "@/lib/telegram/settings";
import { createAdminClient } from "@/lib/supabase/admin";
import { config } from "@/lib/config";
import messages from "../../../messages/uk.json";

export type ChannelPostKind = "report" | "change" | "rule" | "guide";

/** callback_data of the "✅ Актуально" button: `v:<postId>`. */
export const VOTE_PREFIX = "v:";
/** /start payload that opens "what changed?" for a post: `chg_<postId>`. */
export const CHANGE_START_PREFIX = "chg_";

function siteUrl(): string {
  return config.siteUrl().replace(/\/$/, "");
}

export function locationUrl(locationId: string): string {
  return `${siteUrl()}/locations/${locationId}`;
}

/**
 * "➕ Мій досвід": the report form for this office. Inside Telegram as the
 * Mini App when one is configured — the person is signed in by Telegram
 * itself, no login step — else the site's form in the browser.
 */
export function experienceUrl(locationId: string): string {
  const bot = config.telegramBotUsername();
  const app = config.telegramMiniAppName();
  if (bot && app) return `https://t.me/${bot}/${app}?startapp=report_${locationId}`;
  return `${siteUrl()}/reports/new?location=${encodeURIComponent(locationId)}`;
}

interface KeyboardInput {
  postId: number;
  locationId: string | null;
  votes: number;
  detailUrl?: string;
}

/**
 * The buttons under every channel post. Only "✅ Актуально" is a callback —
 * the rest are links, so they work for anyone reading the channel, bot or no
 * bot, and "✏️ Змінилось" opens a private chat with the bot where the
 * person can say what changed without posting it publicly.
 */
export function postKeyboard({ postId, locationId, votes, detailUrl }: KeyboardInput) {
  const t = messages.telegramBot;
  const bot = config.telegramBotUsername();
  const first: Record<string, string>[] = [
    { text: votes > 0 ? `${t.channelConfirm} · ${votes}` : t.channelConfirm, callback_data: `${VOTE_PREFIX}${postId}` },
  ];
  if (bot) first.push({ text: t.channelChanged, url: `https://t.me/${bot}?start=${CHANGE_START_PREFIX}${postId}` });

  const second: Record<string, string>[] = [];
  if (locationId) second.push({ text: t.channelExperience, url: experienceUrl(locationId) });
  const more = detailUrl ?? (locationId ? locationUrl(locationId) : null);
  if (more) second.push({ text: t.channelMore, url: more });

  return { inline_keyboard: second.length > 0 ? [first, second] : [first] };
}

/**
 * Publishes to the updates channel through the public (login) bot.
 *
 * The public bot rather than the admin one because the buttons are for
 * everyone: taps on "✅ Актуально" are delivered to whichever bot posted,
 * and "✏️ Змінилось" has to open a bot people are meant to talk to. The row
 * is created first so its id can go into the buttons.
 */
export async function publishChannelPost(input: {
  kind: ChannelPostKind;
  locationId: string | null;
  text: string;
  detailUrl?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const channel = await getUpdatesChannel();
  if (!token || !channel) return { ok: false, error: "no_channel" };

  const admin = createAdminClient();
  const { data: post, error } = await admin
    .from("channel_posts")
    .insert({ kind: input.kind, location_id: input.locationId, chat_id: channel })
    .select("id")
    .single();
  if (error || !post) return { ok: false, error: error?.message ?? "could not store post" };

  const res = await callTelegram<{ message_id: number; chat: { id: number } }>(token, "sendMessage", {
    chat_id: channel,
    text: input.text,
    link_preview_options: { is_disabled: true },
    reply_markup: postKeyboard({ postId: post.id, locationId: input.locationId, votes: 0, detailUrl: input.detailUrl }),
  });
  if (!res.ok || !res.result) {
    await admin.from("channel_posts").delete().eq("id", post.id);
    return { ok: false, error: res.description };
  }

  await admin
    .from("channel_posts")
    .update({ message_id: res.result.message_id, chat_id: String(res.result.chat.id) })
    .eq("id", post.id);
  return { ok: true };
}

/**
 * A tap on "✅ Актуально": adds this Telegram account's vote, or takes it
 * back if it was already there, then redraws the button with the new count.
 */
export async function toggleChannelVote(
  token: string,
  query: { id: string; from: { id: number }; data?: string; message?: { chat: { id: number }; message_id: number } }
): Promise<void> {
  const t = messages.telegramBot;
  const postId = Number((query.data ?? "").slice(VOTE_PREFIX.length));
  const admin = createAdminClient();

  const { data: post } = postId
    ? await admin.from("channel_posts").select("id, location_id, kind").eq("id", postId).maybeSingle()
    : { data: null };
  if (!post) {
    await callTelegram(token, "answerCallbackQuery", { callback_query_id: query.id });
    return;
  }

  const { data: existing } = await admin
    .from("channel_post_votes")
    .select("post_id")
    .eq("post_id", postId)
    .eq("tg_user_id", query.from.id)
    .maybeSingle();

  if (existing) {
    await admin.from("channel_post_votes").delete().eq("post_id", postId).eq("tg_user_id", query.from.id);
  } else {
    await admin.from("channel_post_votes").insert({ post_id: postId, tg_user_id: query.from.id });
  }

  const { count } = await admin.from("channel_post_votes").select("post_id", { count: "exact", head: true }).eq("post_id", postId);

  await callTelegram(token, "answerCallbackQuery", {
    callback_query_id: query.id,
    text: existing ? t.channelVoteRemoved : t.channelVoteThanks,
  });

  if (query.message) {
    await callTelegram(token, "editMessageReplyMarkup", {
      chat_id: query.message.chat.id,
      message_id: query.message.message_id,
      reply_markup: postKeyboard({
        postId,
        locationId: post.location_id as string | null,
        votes: count ?? 0,
        detailUrl: post.kind === "guide" ? `${siteUrl()}/guide/dovidka` : undefined,
      }),
    });
  }
}

/**
 * Brings an already-published post up to date — its text changes, its
 * buttons (and their vote count) stay. Used for the pinned guide post, which
 * must not be re-posted every time a city's requirement changes.
 */
export async function updateChannelPost(postId: number, text: string, detailUrl?: string): Promise<{ ok: boolean; error?: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { ok: false, error: "no_token" };
  const admin = createAdminClient();
  const { data: post } = await admin
    .from("channel_posts")
    .select("id, chat_id, message_id, location_id")
    .eq("id", postId)
    .maybeSingle();
  if (!post?.chat_id || !post.message_id) return { ok: false, error: "post_not_found" };

  const { count } = await admin.from("channel_post_votes").select("post_id", { count: "exact", head: true }).eq("post_id", postId);
  const res = await callTelegram(token, "editMessageText", {
    chat_id: post.chat_id,
    message_id: post.message_id,
    text,
    link_preview_options: { is_disabled: true },
    reply_markup: postKeyboard({ postId, locationId: post.location_id as string | null, votes: count ?? 0, detailUrl }),
  });
  // Telegram refuses an edit that changes nothing; for us that means "already current".
  if (!res.ok && res.description?.includes("message is not modified")) return { ok: true };
  return { ok: res.ok, error: res.description };
}
