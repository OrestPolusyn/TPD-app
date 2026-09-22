import { callTelegram } from "@/lib/telegram/api";
import { config } from "@/lib/config";
import messages from "../../../messages/uk.json";

export interface NewReportNotice {
  locationId: string;
  locationName: string;
  /** Already-translated outcome label; the caller has the translator. */
  outcome: string;
  eventDate: string;
  author: string;
}

/**
 * Tells the admin chat that a report just came in.
 *
 * Best effort by design: a report is submitted the moment the database
 * accepts it, and a bot that is rate-limited, misconfigured or simply down
 * must not turn a saved report into an error on the person's screen. Every
 * failure here is logged and swallowed.
 *
 * Silent when TELEGRAM_ADMIN_CHAT_ID is unset, which is also how you turn it
 * off.
 */
export async function notifyNewReport(notice: NewReportNotice): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!token || !chatId) return;

  const t = messages.telegramBot;
  const url = `${config.siteUrl().replace(/\/$/, "")}/locations/${notice.locationId}`;
  const text = t.newReportNotice
    .replace("{location}", notice.locationName)
    .replace("{outcome}", notice.outcome)
    .replace("{date}", notice.eventDate)
    .replace("{author}", notice.author)
    .replace("{url}", url);

  try {
    const res = await callTelegram(token, "sendMessage", {
      chat_id: chatId,
      text,
      link_preview_options: { is_disabled: true },
    });
    if (!res.ok) console.error("notifyNewReport failed:", res.description);
  } catch (err) {
    console.error("notifyNewReport threw:", err);
  }
}
