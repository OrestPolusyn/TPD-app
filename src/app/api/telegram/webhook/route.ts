import { NextResponse, type NextRequest } from "next/server";
import { callTelegram } from "@/lib/telegram/api";
import { deriveWebhookSecret } from "@/lib/telegram/webhookSecret";
import { issueLoginToken, LOGIN_TOKEN_TTL_MINUTES } from "@/lib/telegram/loginTokens";
import { config } from "@/lib/config";
import messages from "../../../../../messages/uk.json";

export const dynamic = "force-dynamic";

interface TelegramUpdate {
  message?: {
    chat: { id: number };
    from?: { id: number };
    text?: string;
  };
}

/**
 * The bot. A webhook, not a long-running process: Telegram POSTs, this answers,
 * the function ends.
 *
 * Handles /start, /help, and `/start login` — the sign-in path, which works
 * without BotFather's /setdomain or a Mini App because an update arriving here
 * is signed with a secret derived from the bot token, making its Telegram user
 * id authentic.
 *
 * Register it by opening /api/telegram/setup, or with `npm run telegram:setup`.
 */
export async function POST(request: NextRequest) {
  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (!token) {
    console.error("TELEGRAM_BOT_TOKEN is not set; ignoring webhook update.");
    return NextResponse.json({ ok: true });
  }

  // Telegram echoes the secret that setWebhook registered. Derived from the
  // token, so the two sides cannot drift apart. Without this check anyone who
  // guesses the URL could make the bot speak.
  if (request.headers.get("x-telegram-bot-api-secret-token") !== deriveWebhookSecret(token)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let update: TelegramUpdate;
  try {
    update = (await request.json()) as TelegramUpdate;
  } catch {
    return NextResponse.json({ ok: true });
  }

  const chatId = update.message?.chat.id;
  const fromId = update.message?.from?.id;
  const text = update.message?.text?.trim() ?? "";
  // Always 200: a non-2xx makes Telegram retry the same update indefinitely.
  if (!chatId || !text.startsWith("/")) {
    return NextResponse.json({ ok: true });
  }

  const [rawCommand, ...args] = text.split(/\s+/);
  const command = rawCommand.split("@")[0];
  if (command !== "/start" && command !== "/help") {
    return NextResponse.json({ ok: true });
  }

  // Messages read straight from the JSON, as src/app/error.tsx does: a bot
  // reply needs a few strings, not next-intl's runtime, and importing it here
  // pulls in a react-client build that cannot run outside a request render.
  const t = messages.telegramBot;
  const siteUrl = config.siteUrl().replace(/\/$/, "");

  const body =
    command === "/start" && args[0] === "login" && fromId
      ? await loginReply(chatId, fromId, siteUrl, t)
      : welcomeReply(chatId, siteUrl, t);

  // A throw here would surface as a 500, and Telegram retries a failed update
  // indefinitely — one unreachable API call would become a permanent loop.
  try {
    const res = await callTelegram(token, "sendMessage", body);
    if (!res.ok) {
      console.error("sendMessage failed:", res.description);
    }
  } catch (err) {
    console.error("sendMessage threw:", err);
  }

  return NextResponse.json({ ok: true });
}

type BotMessages = typeof messages.telegramBot;

function welcomeReply(chatId: number, siteUrl: string, t: BotMessages) {
  // A web_app button opens the Mini App in place; without a configured short
  // name we fall back to a normal link, which works everywhere.
  const openButton =
    config.telegramMiniAppName() && config.telegramBotUsername()
      ? { text: t.openButton, web_app: { url: siteUrl } }
      : { text: t.openButton, url: siteUrl };

  return {
    chat_id: chatId,
    text: t.startMessage,
    reply_markup: { inline_keyboard: [[openButton]] },
  };
}

async function loginReply(chatId: number, fromId: number, siteUrl: string, t: BotMessages) {
  const loginToken = await issueLoginToken(fromId);
  if (!loginToken) {
    return { chat_id: chatId, text: t.loginFailed };
  }
  return {
    chat_id: chatId,
    text: t.loginMessage.replace("{minutes}", String(LOGIN_TOKEN_TTL_MINUTES)),
    reply_markup: {
      inline_keyboard: [
        [{ text: t.loginButton, url: `${siteUrl}/auth/telegram?token=${encodeURIComponent(loginToken)}` }],
      ],
    },
  };
}
