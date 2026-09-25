import { callTelegram } from "@/lib/telegram/api";
import { config } from "@/lib/config";
import messages from "../../../messages/uk.json";

import { getAdminBotToken, getModeratorChatId, getUpdatesChannel } from "@/lib/telegram/settings";
import { createActionButtons, ensureAdminWebhook, type ActionButton, type NoticeAction } from "@/lib/telegram/adminBot";

export { getModeratorChatId };

/**
 * Tells the moderator chat that something arrived that needs a human.
 *
 * This repo has no admin UI on purpose (docs/SPEC.md — moderation happens in
 * the Supabase dashboard), which left submissions sitting in a table nobody
 * had a reason to open. These messages are the missing half of that decision:
 * the dashboard stays the place to act, the chat is what says there is
 * something to act on.
 *
 * Best effort throughout. A submission is accepted the moment the database
 * has it, and a bot that is rate-limited, misconfigured or down must never
 * turn a saved submission into an error on the person's screen — so every
 * failure here is logged and swallowed.
 *
 * Silent when TELEGRAM_ADMIN_CHAT_ID is unset, which is also how you turn it
 * off.
 */
async function notify(text: string, action?: { action: NoticeAction; buttons: ActionButton[] }): Promise<void> {
  // The separate admin bot when configured; the login bot otherwise, which is
  // how every notice was sent before the admin bot existed.
  const adminToken = await getAdminBotToken();
  const token = adminToken ?? process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;

  const chatId = await getModeratorChatId();
  if (!chatId) return;

  try {
    if (adminToken) await ensureAdminWebhook(adminToken);
    // Buttons only through the admin bot: its webhook is what answers them.
    const replyMarkup = action && adminToken ? await createActionButtons(action.action, action.buttons) : undefined;
    const res = await callTelegram(token, "sendMessage", {
      chat_id: chatId,
      text,
      link_preview_options: { is_disabled: true },
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    });
    if (res.ok) return;
    console.error("moderator notification failed:", res.description);

    // A bot may not write to someone who has never pressed Start in it, so a
    // freshly configured admin bot fails until the owner opens it. Rather than
    // lose the notice, send it the old way.
    const loginToken = process.env.TELEGRAM_BOT_TOKEN;
    if (adminToken && loginToken && loginToken !== adminToken) {
      const fallback = await callTelegram(loginToken, "sendMessage", {
        chat_id: chatId,
        text,
        link_preview_options: { is_disabled: true },
      });
      if (!fallback.ok) console.error("moderator notification fallback failed:", fallback.description);
    }
  } catch (err) {
    console.error("moderator notification threw:", err);
  }
}

function locationUrl(locationId: string): string {
  return `${config.siteUrl().replace(/\/$/, "")}/locations/${locationId}`;
}

export interface NewReportNotice {
  reportId: string;
  locationId: string;
  locationName: string;
  /** Already-translated outcome label; the caller has the translator. */
  outcome: string;
  eventDate: string;
  author: string;
}

export async function notifyNewReport(notice: NewReportNotice): Promise<void> {
  await notify(
    messages.telegramBot.newReportNotice
      .replace("{location}", notice.locationName)
      .replace("{outcome}", notice.outcome)
      .replace("{date}", notice.eventDate)
      .replace("{author}", notice.author)
      .replace("{url}", locationUrl(notice.locationId)),
    // Offered only when there is a channel to publish to.
    (await getUpdatesChannel())
      ? {
          action: { kind: "publish_report", payload: { report_id: notice.reportId } },
          buttons: [{ label: messages.telegramBot.publishButton }],
        }
      : undefined
  );
}

export interface NewSuggestionNotice {
  locationId: string;
  locationName: string;
  /** Already-translated field label. */
  field: string;
  currentValue: string | null;
  proposedValue: string;
  author: string;
}

export async function notifyNewSuggestion(notice: NewSuggestionNotice): Promise<void> {
  await notify(
    messages.telegramBot.newSuggestionNotice
      .replace("{location}", notice.locationName)
      .replace("{field}", notice.field)
      .replace("{current}", notice.currentValue?.trim() || "—")
      .replace("{proposed}", notice.proposedValue)
      .replace("{author}", notice.author)
      .replace("{url}", locationUrl(notice.locationId))
  );
}

export interface NewLocationNotice {
  locationId: string;
  description: string;
  author: string;
}

export async function notifyNewLocation(notice: NewLocationNotice): Promise<void> {
  // No link: a submitted location is `pending`, so its page 404s until a
  // moderator fills in the real fields and publishes it. The id is what the
  // dashboard needs.
  await notify(
    messages.telegramBot.newLocationNotice
      .replace("{description}", notice.description)
      .replace("{author}", notice.author)
      .replace("{id}", notice.locationId)
  );
}

export interface BriefChangedNotice {
  locationId: string;
  userId: string;
  locationName: string;
  detail: string;
  author: string;
}

/** Someone says an office's community brief is out of date, and how. */
export async function notifyBriefChanged(notice: BriefChangedNotice): Promise<void> {
  await notify(
    messages.telegramBot.briefChangedNotice
      .replace("{location}", notice.locationName)
      .replace("{detail}", notice.detail)
      .replace("{author}", notice.author)
      .replace("{url}", locationUrl(notice.locationId)),
    await changeButtons({ location_id: notice.locationId, user_id: notice.userId, detail: notice.detail, source: "site" })
  );
}

/** "Add", "add as a rule change", "reject" — the three answers to a reported change. */
async function changeButtons(payload: { location_id: string; detail: string; user_id?: string; source: string }) {
  const t = messages.telegramBot;
  const channel = await getUpdatesChannel();
  return {
    action: { kind: "accept_change" as const, payload },
    buttons: [
      { label: channel ? t.acceptChangeButton : t.acceptChangeSiteOnlyButton, variant: "a" as const },
      { label: t.acceptRuleButton, variant: "r" as const },
      { label: t.rejectButton, variant: "x" as const },
    ],
  };
}

export interface TelegramChangeNotice {
  /** Null when the suggestion is about something with no office, e.g. the guide. */
  locationId: string | null;
  locationName: string;
  detail: string;
  fromName: string;
  fromUsername: string | null;
}

/** Someone tapped "✏️ Змінилось" under a channel post and said what changed. */
export async function notifyTelegramChange(notice: TelegramChangeNotice): Promise<void> {
  const text = messages.telegramBot.telegramChangeNotice
    .replace("{location}", notice.locationName)
    .replace("{detail}", notice.detail)
    .replace("{author}", notice.fromName + (notice.fromUsername ? ` (@${notice.fromUsername})` : ""))
    .replace("{url}", notice.locationId ? locationUrl(notice.locationId) : config.siteUrl());
  await notify(
    text,
    notice.locationId
      ? await changeButtons({ location_id: notice.locationId, detail: notice.detail, source: "telegram" })
      : undefined
  );
}

export interface NewUserNotice {
  name: string;
  username: string | null;
  total: number;
}

/** Someone signed in for the first time. */
export async function notifyNewUser(notice: NewUserNotice): Promise<void> {
  await notify(
    messages.telegramBot.newUserNotice
      .replace("{name}", notice.name)
      .replace("{username}", notice.username ? ` (@${notice.username})` : "")
      .replace("{total}", String(notice.total))
  );
}
