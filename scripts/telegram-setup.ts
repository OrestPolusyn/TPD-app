/**
 * Registers the bot webhook and its command list, and — first of all — prints
 * which bot the token actually belongs to.
 *
 * Usage:
 *   TELEGRAM_BOT_TOKEN=... NEXT_PUBLIC_SITE_URL=https://your-host \
 *     npx tsx scripts/telegram-setup.ts
 *
 * The deployment can do this to itself instead: open /api/telegram/setup.
 *
 * Idempotent: re-running overwrites the same webhook and command list.
 */
import { callTelegram, getMe } from "../src/lib/telegram/api";
import { deriveWebhookSecret } from "../src/lib/telegram/webhookSecret";

interface WebhookInfo {
  url: string;
  pending_update_count: number;
  last_error_date?: number;
  last_error_message?: string;
}

async function main() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!token || !siteUrl) {
    console.error("Missing TELEGRAM_BOT_TOKEN and/or NEXT_PUBLIC_SITE_URL.");
    process.exit(1);
  }
  const me = await getMe(token);
  if (!me) {
    console.error("getMe failed — TELEGRAM_BOT_TOKEN is not a valid bot token.");
    process.exit(1);
  }
  console.log(`Token belongs to: @${me.username} (id ${me.id})`);
  console.log("");
  console.log("This must be the SAME bot that owns the Mini App and that you ran");
  console.log("/setdomain on. A mismatch makes every login fail with bad_hash.");
  console.log("");

  const webhookUrl = `${siteUrl.replace(/\/$/, "")}/api/telegram/webhook`;
  const hook = await callTelegram(token, "setWebhook", {
    url: webhookUrl,
    secret_token: deriveWebhookSecret(token),
    // callback_query too: the login confirm button is a callback, and Telegram
    // delivers nothing outside this list.
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: true,
  });
  console.log(hook.ok ? `Webhook set: ${webhookUrl}` : `setWebhook failed: ${hook.description}`);
  if (!hook.ok) process.exit(1);

  const commands = await callTelegram(token, "setMyCommands", {
    commands: [
      { command: "start", description: "Відкрити застосунок" },
      { command: "help", description: "Що це таке" },
    ],
  });
  console.log(commands.ok ? "Commands registered." : `setMyCommands failed: ${commands.description}`);

  const info = await callTelegram<WebhookInfo>(token, "getWebhookInfo");
  if (info.ok && info.result) {
    console.log("");
    console.log("Webhook info:", JSON.stringify(info.result, null, 2));
  }

  console.log("");
  console.log(`Now open https://t.me/${me.username} and send /start.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
