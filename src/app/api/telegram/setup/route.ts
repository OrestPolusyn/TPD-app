import { NextResponse } from "next/server";
import { callTelegram, getMe, getWebhookInfo } from "@/lib/telegram/api";
import { deriveWebhookSecret } from "@/lib/telegram/webhookSecret";
import { config } from "@/lib/config";

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
export async function GET() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return NextResponse.json({ ok: false, error: "TELEGRAM_BOT_TOKEN is not set" }, { status: 500 });
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

async function register(token: string, botUsername: string, webhookUrl: string) {
  const before = await getWebhookInfo(token);

  if (before && before.url === webhookUrl && !before.last_error_message) {
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
    allowed_updates: ["message"],
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
