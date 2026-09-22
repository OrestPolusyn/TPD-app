import { NextResponse, type NextRequest } from "next/server";
import { callTelegram } from "@/lib/telegram/api";
import { deriveWebhookSecret } from "@/lib/telegram/webhookSecret";
import { approveLoginRequest, findPendingLoginRequest } from "@/lib/telegram/loginRequests";
import { config } from "@/lib/config";
import messages from "../../../../../messages/uk.json";

export const dynamic = "force-dynamic";

interface TelegramFrom {
  id: number;
  first_name?: string;
  username?: string;
}

interface TelegramUpdate {
  message?: {
    chat: { id: number };
    from?: TelegramFrom;
    text?: string;
  };
  callback_query?: {
    id: string;
    from: TelegramFrom;
    data?: string;
    message?: { chat: { id: number }; message_id: number };
  };
}

/** Prefix of the inline button's callback_data: `login:<requestId>`. */
const LOGIN_CALLBACK_PREFIX = "login:";
/** Prefix of the bot's deep-link payload: `/start login_<requestId>`. */
const LOGIN_START_PREFIX = "login_";

/**
 * The bot. A webhook, not a long-running process: Telegram POSTs, this answers,
 * the function ends.
 *
 * Handles /start, /help, and the sign-in confirmation — which works without
 * BotFather's /setdomain or a Mini App because an update arriving here is
 * signed with a secret derived from the bot token, making its Telegram user id
 * (and name) authentic.
 *
 * The chat's role in signing in is to *approve*, never to carry the session:
 * the browser mints the request and redeems the approval itself (see
 * src/app/api/auth/telegram/{start,poll}). A login link in a chat cannot work
 * on a phone — Telegram opens it in its own in-app browser, which signs in a
 * WebView the person is not browsing from.
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

  // Always 200 from here on: a non-2xx makes Telegram retry the same update
  // indefinitely, so one unreachable API call would become a permanent loop.
  try {
    if (update.callback_query) {
      await handleCallback(token, update.callback_query);
      return NextResponse.json({ ok: true });
    }
    await handleMessage(token, update);
  } catch (err) {
    console.error("webhook handler threw:", err);
  }

  return NextResponse.json({ ok: true });
}

type BotMessages = typeof messages.telegramBot;

async function handleMessage(token: string, update: TelegramUpdate) {
  const chatId = update.message?.chat.id;
  const text = update.message?.text?.trim() ?? "";
  if (!chatId || !text.startsWith("/")) return;

  const [rawCommand, ...args] = text.split(/\s+/);
  const command = rawCommand.split("@")[0];
  if (command !== "/start" && command !== "/help") return;

  // Messages read straight from the JSON, as src/app/error.tsx does: a bot
  // reply needs a few strings, not next-intl's runtime, and importing it here
  // pulls in a react-client build that cannot run outside a request render.
  const t = messages.telegramBot;
  const siteUrl = config.siteUrl().replace(/\/$/, "");
  const payload = command === "/start" ? (args[0] ?? "") : "";

  const body = payload.startsWith(LOGIN_START_PREFIX)
    ? await loginConfirmReply(chatId, payload.slice(LOGIN_START_PREFIX.length), t)
    : welcomeReply(chatId, siteUrl, t);

  await send(token, "sendMessage", body);
}

/**
 * The confirm button. Approval happens here, not on /start, so that a link
 * someone was sent ("just open this bot") cannot sign that person's account
 * into a stranger's browser without a visible, code-matched confirmation.
 */
async function handleCallback(token: string, query: NonNullable<TelegramUpdate["callback_query"]>) {
  const t = messages.telegramBot;
  const data = query.data ?? "";
  if (!data.startsWith(LOGIN_CALLBACK_PREFIX)) {
    await send(token, "answerCallbackQuery", { callback_query_id: query.id });
    return;
  }

  const approved = await approveLoginRequest(data.slice(LOGIN_CALLBACK_PREFIX.length), query.from);

  await send(token, "answerCallbackQuery", {
    callback_query_id: query.id,
    text: approved ? t.loginApprovedToast : t.loginExpiredToast,
  });

  // Rewriting the message drops the button with it, so a stale confirmation
  // cannot sit in the chat inviting a second tap.
  if (query.message) {
    await send(token, "editMessageText", {
      chat_id: query.message.chat.id,
      message_id: query.message.message_id,
      text: approved ? t.loginApproved : t.loginExpired,
    });
  }
}

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

async function loginConfirmReply(chatId: number, requestId: string, t: BotMessages) {
  const pending = await findPendingLoginRequest(requestId);
  if (!pending) {
    return { chat_id: chatId, text: t.loginExpired };
  }
  return {
    chat_id: chatId,
    text: t.loginConfirmMessage.replace("{code}", pending.code),
    reply_markup: {
      inline_keyboard: [[{ text: t.loginConfirmButton, callback_data: `${LOGIN_CALLBACK_PREFIX}${requestId}` }]],
    },
  };
}

async function send(token: string, method: string, body: Record<string, unknown>) {
  const res = await callTelegram(token, method, body);
  if (!res.ok) console.error(`${method} failed:`, res.description);
}
