import { callTelegram } from "@/lib/telegram/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { config } from "@/lib/config";
import messages from "../../../messages/uk.json";

const MODERATOR_CHAT_SETTING = "moderator_chat_id";

/**
 * Which chat hears about submissions.
 *
 * TELEGRAM_ADMIN_CHAT_ID wins when set, so a self-hosted deployment can
 * configure this the ordinary way. Otherwise it comes from app_settings
 * (0014), which is there because the env var route means "open the hosting
 * dashboard, add a variable, redeploy" — three steps, all silent if skipped,
 * and skipping them is exactly what made notifications look broken.
 *
 * Null means nobody is configured, and nothing is sent.
 */
export async function getModeratorChatId(): Promise<string | null> {
  const fromEnv = process.env.TELEGRAM_ADMIN_CHAT_ID?.trim();
  if (fromEnv) return fromEnv;

  try {
    const { data, error } = await createAdminClient()
      .from("app_settings")
      .select("value")
      .eq("key", MODERATOR_CHAT_SETTING)
      .maybeSingle();
    if (error) {
      console.error("could not read the moderator chat setting:", error.message);
      return null;
    }
    return data?.value?.trim() || null;
  } catch (err) {
    console.error("could not read the moderator chat setting:", err);
    return null;
  }
}

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
async function notify(text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;

  const chatId = await getModeratorChatId();
  if (!chatId) return;

  try {
    const res = await callTelegram(token, "sendMessage", {
      chat_id: chatId,
      text,
      link_preview_options: { is_disabled: true },
    });
    if (!res.ok) console.error("moderator notification failed:", res.description);
  } catch (err) {
    console.error("moderator notification threw:", err);
  }
}

function locationUrl(locationId: string): string {
  return `${config.siteUrl().replace(/\/$/, "")}/locations/${locationId}`;
}

export interface NewReportNotice {
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
      .replace("{url}", locationUrl(notice.locationId))
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
      .replace("{url}", locationUrl(notice.locationId))
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
