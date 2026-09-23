import { NextResponse } from "next/server";
import { callTelegram, getMe, getWebhookInfo, type WebhookInfo } from "@/lib/telegram/api";
import { deriveWebhookSecret } from "@/lib/telegram/webhookSecret";
import { config } from "@/lib/config";
import messages from "../../../../../messages/uk.json";

export const dynamic = "force-dynamic";

/**
 * Registers the bot's webhook and command list, from the deployment itself.
 *
 * `npm run telegram:setup` does the same thing, but it needs a terminal, the
 * bot token to hand, and network access to api.telegram.org. The deployment
 * already has the token and the network, so opening this URL is enough.
 *
 * Deliberately unauthenticated, because it cannot be turned against anyone: it
 * takes no input, and its only effect is pointing the bot at this same
 * deployment's own webhook with a secret derived from the token. Calling it
 * repeatedly is a no-op — when the webhook is already correct and healthy it
 * reports that and changes nothing.
 */
export async function GET(request: Request) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return NextResponse.json({ ok: false, error: "TELEGRAM_BOT_TOKEN is not set" }, { status: 500 });
  }

  // ?notify=test — prove the moderator chat works, or say exactly why it does
  // not. Moderator notifications are silent when unconfigured (by design, so
  // they can be turned off), and silence reads the same as broken: "nothing
  // arrives anywhere", with nowhere to look. This is where to look.
  if (new URL(request.url).searchParams.get("notify") === "test") {
    return NextResponse.json(await testModeratorChat(token));
  }

  // Every call below reaches api.telegram.org. Unreachable means a thrown
  // fetch, which would otherwise surface as a blank 500 with nothing to act on.
  let bot;
  try {
    bot = await getMe(token);
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: `Could not reach api.telegram.org: ${err instanceof Error ? err.message : String(err)}` },
      { status: 502 }
    );
  }
  if (!bot) {
    return NextResponse.json({ ok: false, error: "getMe rejected the token" }, { status: 500 });
  }

  const siteUrl = config.siteUrl().replace(/\/$/, "");
  const webhookUrl = `${siteUrl}/api/telegram/webhook`;

  try {
    return await register(token, bot.username, webhookUrl);
  } catch (err) {
    return NextResponse.json(
      { ok: false, bot: bot.username, error: err instanceof Error ? err.message : String(err) },
      { status: 502 }
    );
  }
}

/**
 * Sign-in needs `callback_query`: the confirm button in the bot's login
 * message is a callback, and Telegram simply does not deliver update types
 * outside this list — a webhook registered before that button existed
 * (allowed_updates: ["message"]) makes confirming silently do nothing.
 */
const REQUIRED_UPDATES = ["message", "callback_query"];

function deliversLoginUpdates(info: WebhookInfo): boolean {
  if (!info.allowed_updates) return true;
  return REQUIRED_UPDATES.every((type) => info.allowed_updates?.includes(type));
}

async function register(token: string, botUsername: string, webhookUrl: string) {
  const before = await getWebhookInfo(token);

  if (before && before.url === webhookUrl && !before.last_error_message && deliversLoginUpdates(before)) {
    return NextResponse.json({
      ok: true,
      changed: false,
      bot: botUsername,
      webhook: webhookUrl,
      message: `Already registered and healthy. Send /start to @${botUsername}.`,
    });
  }

  const hook = await callTelegram(token, "setWebhook", {
    url: webhookUrl,
    secret_token: deriveWebhookSecret(token),
    allowed_updates: REQUIRED_UPDATES,
    drop_pending_updates: true,
  });
  if (!hook.ok) {
    return NextResponse.json(
      { ok: false, bot: botUsername, error: `setWebhook failed: ${hook.description}` },
      { status: 502 }
    );
  }

  const commands = await callTelegram(token, "setMyCommands", {
    commands: [
      { command: "start", description: "Відкрити застосунок" },
      { command: "help", description: "Що це таке" },
    ],
  });

  const after = await getWebhookInfo(token);

  return NextResponse.json({
    ok: true,
    changed: true,
    bot: botUsername,
    webhook: webhookUrl,
    commandsRegistered: commands.ok,
    previous: before ? { url: before.url || null, lastError: before.last_error_message ?? null } : null,
    current: after ? { url: after.url, pendingUpdates: after.pending_update_count } : null,
    message: `Done. Send /start to @${botUsername}.`,
  });
}

/**
 * Sends one message to the configured moderator chat and reports whatever
 * Telegram says back, verbatim.
 *
 * The answers that matter, and what each means:
 * - not configured            -> TELEGRAM_ADMIN_CHAT_ID is unset in this
 *                                environment, so nothing is ever sent.
 * - "chat not found"          -> the id is wrong, or the bot has never been
 *                                started by that user / added to that group.
 * - "bot was blocked by the user" -> exactly that.
 * - ok                        -> a message is in the chat right now.
 */
async function testModeratorChat(token: string) {
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!chatId) {
    return {
      ok: false,
      configured: false,
      message:
        "TELEGRAM_ADMIN_CHAT_ID is not set, so no submission notification is ever sent. " +
        "Send /id to the bot to get the value, set it in the deployment's environment, redeploy, then open this again.",
    };
  }

  try {
    const res = await callTelegram(token, "sendMessage", {
      chat_id: chatId,
      text: messages.telegramBot.testNotice,
    });
    return {
      ok: res.ok,
      configured: true,
      telegramSaid: res.description ?? null,
      message: res.ok
        ? "Sent. A test message should be in that chat now."
        : "Telegram refused it — see telegramSaid.",
    };
  } catch (err) {
    return {
      ok: false,
      configured: true,
      message: `Could not reach api.telegram.org: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
