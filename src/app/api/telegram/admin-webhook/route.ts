import { NextResponse, type NextRequest } from "next/server";
import { callTelegram } from "@/lib/telegram/api";
import { deriveWebhookSecret } from "@/lib/telegram/webhookSecret";
import { getAdminBotToken, getModeratorChatId } from "@/lib/telegram/settings";
import { performAction } from "@/lib/telegram/adminBot";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSiteStats, formatStatsMessage } from "@/lib/stats";
import { config } from "@/lib/config";
import messages from "../../../../../messages/uk.json";

export const dynamic = "force-dynamic";

interface AdminUpdate {
  message?: { chat: { id: number }; text?: string };
  callback_query?: {
    id: string;
    from: { id: number };
    data?: string;
    message?: { chat: { id: number }; message_id: number };
  };
}

/**
 * The admin bot's webhook: /start, /stats, and the buttons on its notices.
 *
 * Everything past /start is for the owner only — checked against the
 * moderator chat on every update, since anyone can find and message a bot.
 * Always answers 200 once the secret checks out: Telegram retries anything
 * else, and a retried button tap is exactly what must not happen twice.
 */
export async function POST(request: NextRequest) {
  const token = await getAdminBotToken();
  if (!token) return NextResponse.json({ ok: false }, { status: 404 });
  if (request.headers.get("x-telegram-bot-api-secret-token") !== deriveWebhookSecret(token)) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  let update: AdminUpdate;
  try {
    update = (await request.json()) as AdminUpdate;
  } catch {
    return NextResponse.json({ ok: true });
  }

  try {
    const owner = await getModeratorChatId();
    if (update.callback_query) await handleButton(token, owner, update.callback_query);
    else if (update.message) await handleMessage(token, owner, update.message);
  } catch (err) {
    console.error("admin webhook failed:", err);
  }
  return NextResponse.json({ ok: true });
}

async function handleMessage(token: string, owner: string | null, message: NonNullable<AdminUpdate["message"]>) {
  const chatId = message.chat.id;
  const command = (message.text ?? "").trim().split(/\s+/)[0].split("@")[0];

  if (command === "/start") {
    await callTelegram(token, "sendMessage", {
      chat_id: chatId,
      text: messages.telegramBot.adminBotStart.replace("{id}", String(chatId)),
    });
    return;
  }

  if (command === "/stats" && owner === String(chatId)) {
    const stats = await getSiteStats(createAdminClient());
    await callTelegram(token, "sendMessage", {
      chat_id: chatId,
      text: formatStatsMessage(stats, config.siteUrl()),
      link_preview_options: { is_disabled: true },
    });
  }
}

async function handleButton(
  token: string,
  owner: string | null,
  query: NonNullable<AdminUpdate["callback_query"]>
) {
  const actionId = Number(/^act:(\d+)$/.exec(query.data ?? "")?.[1]);
  if (!actionId || owner !== String(query.from.id)) {
    await callTelegram(token, "answerCallbackQuery", { callback_query_id: query.id });
    return;
  }

  const result = await performAction(token, actionId);
  await callTelegram(token, "answerCallbackQuery", { callback_query_id: query.id, text: result.text });

  // Replace the button with a plain "done" marker so the message itself
  // shows the outcome, not only a toast that disappears.
  if (result.done && query.message) {
    await callTelegram(token, "editMessageReplyMarkup", {
      chat_id: query.message.chat.id,
      message_id: query.message.message_id,
      reply_markup: { inline_keyboard: [[{ text: `✅ ${result.text}`, callback_data: "noop" }]] },
    });
  }
}
