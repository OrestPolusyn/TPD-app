/**
 * The admin bot's chat-watch commands. Owner only — the caller checks.
 *
 *   /tg_api <api_id> <api_hash>   keys from my.telegram.org (message deleted)
 *   /tg_login                     QR code to connect the server's Telegram
 *   /tg_password <password>       two-step verification, if asked (deleted)
 *   /tg_logout                    forget the server's login
 *   /watch_add <link>             a group or a topic to read
 *   /watch_list                   what is read, and how it went
 *   /watch_remove <n>             stop reading one
 *   /watch_run                    read now instead of waiting for the schedule
 *
 * Login and reading take longer than a webhook should, so they run in
 * after(): Telegram gets its 200 at once and does not retry the update.
 */
import { after } from "next/server";
import QRCode from "qrcode";
import { callTelegram, sendPhoto } from "@/lib/telegram/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { esc } from "@/lib/telegram/html";
import {
  completePasswordLogin,
  getApiCredentials,
  getSession,
  qrLogin,
  resolveSource,
  saveSetting,
  withClient,
} from "@/lib/chatwatch/telegram";
import { parseSourceRef, SourceRefError } from "@/lib/chatwatch/sources";
import { runChatWatch } from "@/lib/chatwatch/run";

export const CHAT_WATCH_COMMANDS = [
  "/tg_api",
  "/tg_login",
  "/tg_password",
  "/tg_logout",
  "/watch_add",
  "/watch_list",
  "/watch_remove",
  "/watch_run",
] as const;

/** Leave the webhook function (60 s) a margin to report the outcome. */
const LOGIN_WINDOW_MS = 48_000;

function say(token: string, chatId: number, text: string) {
  return callTelegram(token, "sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
  });
}

function errorText(err: unknown): string {
  return (err as { errorMessage?: string }).errorMessage ?? (err instanceof Error ? err.message : String(err));
}

export async function handleChatWatchCommand(
  token: string,
  chatId: number,
  messageId: number | undefined,
  command: string,
  args: string
): Promise<boolean> {
  if (!(CHAT_WATCH_COMMANDS as readonly string[]).includes(command)) return false;

  // Secrets typed into the chat do not stay in its history.
  if ((command === "/tg_api" || command === "/tg_password") && messageId) {
    await callTelegram(token, "deleteMessage", { chat_id: chatId, message_id: messageId });
  }

  switch (command) {
    case "/tg_api": {
      const [id, hash] = args.split(/\s+/);
      if (!/^\d+$/.test(id ?? "") || !/^[0-9a-f]{32}$/i.test(hash ?? "")) {
        await say(token, chatId, "Формат: <code>/tg_api 1234567 0123456789abcdef0123456789abcdef</code> — з my.telegram.org → API development tools.");
        return true;
      }
      await saveSetting("tg_api_id", id);
      await saveSetting("tg_api_hash", hash);
      await say(token, chatId, "Ключі збережено ✅ (ваше повідомлення з ними видалено).\nДалі: /tg_login");
      return true;
    }

    case "/tg_login": {
      const creds = await getApiCredentials();
      if (!creds) {
        await say(token, chatId, "Спершу ключі: <code>/tg_api &lt;api_id&gt; &lt;api_hash&gt;</code> з my.telegram.org.");
        return true;
      }
      await say(
        token,
        chatId,
        "Зараз прийде QR-код. На телефоні: <b>Telegram → Налаштування → Пристрої → Підключити пристрій</b> — і наведіть камеру. Є ~45 секунд."
      );
      after(async () => {
        let lastPhoto: number | undefined;
        try {
          const result = await qrLogin(creds, Date.now() + LOGIN_WINDOW_MS, async (url) => {
            const png = await QRCode.toBuffer(url, { width: 512, margin: 2 });
            if (lastPhoto) await callTelegram(token, "deleteMessage", { chat_id: chatId, message_id: lastPhoto });
            const sent = await sendPhoto(token, chatId, png, "Скануйте в Telegram → Пристрої → Підключити пристрій");
            lastPhoto = sent.result?.message_id;
          });
          if (lastPhoto) await callTelegram(token, "deleteMessage", { chat_id: chatId, message_id: lastPhoto });
          if (result.status === "ok") {
            await say(token, chatId, `✅ Сервер підключено до Telegram як <b>${esc(result.name)}</b>.\nДодайте групи: <code>/watch_add посилання</code>`);
          } else if (result.status === "password") {
            await say(
              token,
              chatId,
              `Увімкнена двоетапна перевірка. Надішліть: <code>/tg_password ваш_пароль</code>${result.hint ? ` (підказка: ${esc(result.hint)})` : ""} — повідомлення одразу видалю.`
            );
          } else {
            await say(token, chatId, "Час вийшов. Надішліть /tg_login ще раз, коли телефон буде під рукою.");
          }
        } catch (err) {
          if (lastPhoto) await callTelegram(token, "deleteMessage", { chat_id: chatId, message_id: lastPhoto });
          await say(token, chatId, `Не вдалося підключитись: ${esc(errorText(err))}`);
        }
      });
      return true;
    }

    case "/tg_password": {
      const creds = await getApiCredentials();
      if (!creds || !args) {
        await say(token, chatId, "Формат: <code>/tg_password ваш_пароль</code> (після /tg_login).");
        return true;
      }
      try {
        const name = await completePasswordLogin(creds, args);
        await say(token, chatId, `✅ Сервер підключено до Telegram як <b>${esc(name)}</b>.\nДодайте групи: <code>/watch_add посилання</code>`);
      } catch (err) {
        const reason = errorText(err);
        await say(
          token,
          chatId,
          reason === "no_pending_login"
            ? "Спершу /tg_login."
            : reason.includes("PASSWORD_HASH_INVALID")
              ? "Невірний пароль. Спробуйте ще раз: <code>/tg_password …</code>"
              : `Не вдалося: ${esc(reason)}`
        );
      }
      return true;
    }

    case "/tg_logout": {
      await saveSetting("tg_session", null);
      await saveSetting("tg_session_pending", null);
      await say(token, chatId, "Вхід сервера забуто. Сеанс «TP Spain server» можна також завершити в Telegram → Пристрої.");
      return true;
    }

    case "/watch_add": {
      const [creds, session] = await Promise.all([getApiCredentials(), getSession()]);
      if (!creds || !session) {
        await say(token, chatId, "Спершу підключіть сервер: /tg_login");
        return true;
      }
      // Several links at once — one per line or space-separated — so a whole
      // list from the desktop collector goes in one message.
      const inputs = args.split(/\s+/).filter(Boolean);
      if (inputs.length === 0) {
        await say(token, chatId, "Формат: <code>/watch_add t.me/spain_useful/74767</code> (група або тема), можна кілька посилань — кожне з нового рядка.");
        return true;
      }
      if (inputs.length > 1) await say(token, chatId, `Додаю ${inputs.length} джерел…`);
      after(async () => {
        const lines: string[] = [];
        try {
          await withClient(session, creds, async (client) => {
            for (const input of inputs) {
              let ref;
              try {
                ref = parseSourceRef(input);
              } catch (err) {
                const why = err instanceof SourceRefError ? err.message : "";
                lines.push(`❌ ${esc(input)} — ${why === "invite" ? "посилання-запрошення: вступіть у групу й додайте її звичайним посиланням" : "не схоже на посилання Telegram"}`);
                continue;
              }
              try {
                const resolved = await resolveSource(client, ref);
                const { error } = await createAdminClient().from("chatwatch_sources").insert(resolved);
                if (error) lines.push(error.code === "23505" ? `• ${esc(resolved.title)} — вже є` : `❌ ${esc(resolved.title)} — ${esc(error.message)}`);
                else lines.push(`✅ ${esc(resolved.title)}`);
              } catch (err) {
                const reason = errorText(err);
                lines.push(`❌ ${esc(input)} — ${reason === "not_found" ? "не знайшов серед чатів акаунта (акаунт сервера має бути учасником)" : esc(reason)}`);
              }
            }
          });
        } catch (err) {
          lines.push(`❌ Не вдалося підключитись до Telegram: ${esc(errorText(err))}`);
        }
        lines.push("", "Перший прохід візьме останні 24 години. /watch_list — список, /watch_run — прочитати зараз.");
        await say(token, chatId, lines.join("\n"));
      });
      return true;
    }

    case "/watch_list": {
      const [{ data }, session] = await Promise.all([
        createAdminClient().from("chatwatch_sources").select("id, title, enabled, last_run_at, last_error").order("id"),
        getSession(),
      ]);
      const lines = [`<b>Групи, які читає сервер</b> · вхід у Telegram: ${session ? "✅" : "❌ /tg_login"}`, ""];
      for (const s of data ?? []) {
        const when = s.last_run_at
          ? new Intl.DateTimeFormat("uk-UA", { timeZone: "Europe/Madrid", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(s.last_run_at as string))
          : "ще не читали";
        lines.push(`${s.id}. ${esc(s.title as string)} — ${when}${s.last_error ? ` ⚠️ ${esc(s.last_error as string)}` : ""}`);
      }
      if ((data ?? []).length === 0) lines.push("Поки порожньо. <code>/watch_add посилання</code>");
      lines.push("", "Прибрати: <code>/watch_remove номер</code> · прочитати зараз: /watch_run\nАвтоматично — щодня о 9:00 і 19:00 (Мадрид).");
      await say(token, chatId, lines.join("\n"));
      return true;
    }

    case "/watch_remove": {
      const id = Number(args);
      if (!Number.isInteger(id) || id <= 0) {
        await say(token, chatId, "Формат: <code>/watch_remove 3</code> — номер з /watch_list");
        return true;
      }
      const { data } = await createAdminClient().from("chatwatch_sources").delete().eq("id", id).select("title");
      await say(token, chatId, data?.length ? `Прибрано: ${esc(data[0].title as string)}` : "Такого номера немає — див. /watch_list");
      return true;
    }

    case "/watch_run": {
      await say(token, chatId, "Читаю групи… дайджест прийде за хвилину.");
      after(async () => {
        try {
          const result = await runChatWatch({ notifyWhenEmpty: true });
          if (result.status === "not_connected") await say(token, chatId, "Сервер не підключений до Telegram: /tg_login");
          if (result.status === "no_sources") await say(token, chatId, "Немає груп для читання: <code>/watch_add посилання</code>");
        } catch (err) {
          await say(token, chatId, `Не вдалося прочитати групи: ${esc(errorText(err))}`);
        }
      });
      return true;
    }
  }
  return false;
}
