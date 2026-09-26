import { NextResponse } from "next/server";
import { callTelegram, getMe } from "@/lib/telegram/api";
import { ensureAdminWebhook, adminWebhookUrl } from "@/lib/telegram/adminBot";
import { getAdminBotToken, getModeratorChatId, getUpdatesChannel } from "@/lib/telegram/settings";
import messages from "../../../../../messages/uk.json";

export const dynamic = "force-dynamic";

/**
 * Health check and one-time wiring for the admin bot and the updates channel.
 *
 * Takes no input and only ever points the configured bot at this same
 * deployment, so it is safe unauthenticated (like /api/telegram/setup).
 * ?test=1 also sends one message to the owner through the admin bot — the
 * way to prove the owner has pressed /start in it, which Telegram requires
 * before a bot may write to someone.
 */
export async function GET(request: Request) {
  const token = await getAdminBotToken();
  if (!token) return NextResponse.json({ ok: false, error: "admin bot token is not set (app_settings.admin_bot_token)" });

  try {
    const bot = await getMe(token);
    if (!bot) return NextResponse.json({ ok: false, error: "Telegram rejected the admin bot token" });

    const webhook = await ensureAdminWebhook(token);

    // The command menu, shown only in the owner's chat with the bot.
    const owner = await getModeratorChatId();
    const commands = owner
      ? await callTelegram(token, "setMyCommands", {
          commands: [
            { command: "pending", description: messages.telegramBot.adminCommandPending },
            { command: "stats", description: messages.telegramBot.adminCommandStats },
            { command: "post_guide", description: messages.telegramBot.adminCommandPostGuide },
          ],
          scope: { type: "chat", chat_id: owner },
        })
      : null;
    const report: Record<string, unknown> = {
      ok: webhook.ok,
      bot: `@${bot.username}`,
      webhook: { url: adminWebhookUrl(), ...webhook },
      commands: commands ? { ok: commands.ok, error: commands.ok ? undefined : commands.description } : "no moderator chat",
    };

    // The channel is posted to by the public (login) bot — its buttons are
    // for everyone — so that is the bot whose rights are checked here.
    const channel = await getUpdatesChannel();
    const publicToken = process.env.TELEGRAM_BOT_TOKEN;
    const publicBot = publicToken ? await getMe(publicToken) : null;
    if (!channel) {
      report.channel = "not configured (app_settings.updates_channel)";
    } else if (!publicToken || !publicBot) {
      report.channel = { id: channel, error: "TELEGRAM_BOT_TOKEN (the public bot) is missing or rejected" };
    } else {
      const chat = await callTelegram<{ id: number; title?: string }>(publicToken, "getChat", { chat_id: channel });
      const member = chat.ok
        ? await callTelegram<{ status: string; can_post_messages?: boolean; can_edit_messages?: boolean }>(
            publicToken,
            "getChatMember",
            { chat_id: channel, user_id: publicBot.id }
          )
        : null;
      const isAdmin = member?.result?.status === "administrator";
      report.channel = {
        id: channel,
        postsAs: `@${publicBot.username}`,
        found: chat.ok,
        title: chat.result?.title,
        botStatus: member?.result?.status,
        canPost: isAdmin && member?.result?.can_post_messages !== false,
        canEditCounters: isAdmin && member?.result?.can_edit_messages !== false,
        error: chat.ok ? undefined : chat.description,
      };
    }

    if (new URL(request.url).searchParams.get("test") === "1") {
      const sent = owner
        ? await callTelegram(token, "sendMessage", { chat_id: owner, text: messages.telegramBot.adminSetupTest })
        : { ok: false, description: "no moderator chat configured" };
      report.test = { ok: sent.ok, error: sent.ok ? undefined : sent.description };
    }

    return NextResponse.json(report);
  } catch (err) {
    return NextResponse.json({ ok: false, error: `could not reach Telegram: ${String(err)}` });
  }
}
