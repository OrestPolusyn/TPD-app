import { NextResponse, type NextRequest } from "next/server";
import { getTranslations } from "next-intl/server";
import { callTelegram } from "@/lib/telegram/api";
import { config } from "@/lib/config";

export const dynamic = "force-dynamic";

interface TelegramUpdate {
  message?: {
    chat: { id: number };
    text?: string;
  };
}

/**
 * The bot itself. Until now the project had none: docs/BOTFATHER.md said to
 * lean on BotFather's menu button because "this repo does not include a
 * long-running bot process". A webhook needs no long-running process — Telegram
 * POSTs here, we answer, the function ends.
 *
 * It replies to /start and /help with a button that opens the app: as a
 * `web_app` button when a Mini App short name is configured, otherwise as a
 * plain link, so the bot is useful before the Mini App is wired up.
 *
 * Register it with `npm run telegram:setup`.
 */
export async function POST(request: NextRequest) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;

  if (!token) {
    console.error("TELEGRAM_BOT_TOKEN is not set; ignoring webhook update.");
    return NextResponse.json({ ok: true });
  }

  // Telegram echoes the secret set via setWebhook. Without this check anyone
  // who guesses the URL can make the bot speak.
  if (!secret || request.headers.get("x-telegram-bot-api-secret-token") !== secret) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let update: TelegramUpdate;
  try {
    update = (await request.json()) as TelegramUpdate;
  } catch {
    return NextResponse.json({ ok: true });
  }

  const chatId = update.message?.chat.id;
  const text = update.message?.text?.trim() ?? "";
  // Always 200: a non-2xx makes Telegram retry the same update indefinitely.
  if (!chatId || !text.startsWith("/")) {
    return NextResponse.json({ ok: true });
  }

  const command = text.split(/[\s@]/)[0];
  if (command !== "/start" && command !== "/help") {
    return NextResponse.json({ ok: true });
  }

  const t = await getTranslations("telegramBot");
  const siteUrl = config.siteUrl();
  const miniAppName = config.telegramMiniAppName();
  const botUsername = config.telegramBotUsername();

  // A web_app button opens the Mini App in place; without a configured short
  // name we fall back to a normal link, which works everywhere.
  const button =
    miniAppName && botUsername
      ? { text: t("openButton"), web_app: { url: siteUrl } }
      : { text: t("openButton"), url: siteUrl };

  // A throw here would surface as a 500, and Telegram retries a failed update
  // indefinitely — one unreachable API call would become a permanent loop.
  try {
    const res = await callTelegram(token, "sendMessage", {
      chat_id: chatId,
      text: t("startMessage"),
      reply_markup: { inline_keyboard: [[button]] },
    });
    if (!res.ok) {
      console.error("sendMessage failed:", res.description);
    }
  } catch (err) {
    console.error("sendMessage threw:", err);
  }

  return NextResponse.json({ ok: true });
}
