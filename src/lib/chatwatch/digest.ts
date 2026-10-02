/**
 * The one line the owner gets about a chat-watch run, in Telegram HTML.
 *
 * Messages themselves are never sent: the scheduled Claude pass turns them
 * into ready drafts (comment or change, with buttons) a few minutes after
 * the reading, so the admin bot shows only what can be published. This is
 * for a manual /watch_run and for groups that could not be read. Pure, so
 * it is tested without Telegram.
 */
import { esc } from "@/lib/telegram/html";

export interface FoundMessage {
  sourceTitle: string;
  date: Date;
  text: string;
  link: string;
}

export interface DigestInput {
  found: FoundMessage[];
  sources: number;
  hidden: number;
  errors: { title: string; error: string }[];
  now: Date;
}

const madridTime = (d: Date) =>
  new Intl.DateTimeFormat("uk-UA", {
    timeZone: "Europe/Madrid",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);

export function formatRunNotice({ found, sources, errors, now }: DigestInput): string {
  const lines = [`🗞 <b>Чати про захист</b> · ${esc(madridTime(now))}`];
  lines.push(
    found.length > 0
      ? `Прочитано нових повідомлень: ${found.length} (груп: ${sources}). Готові до публікації чернетки прийдуть сюди о 12:05 або 22:05.`
      : `Нового про захист немає · перевірено груп: ${sources}`
  );
  if (errors.length > 0) {
    lines.push("", `⚠️ <b>Не вдалося прочитати</b>`, ...errors.map((e) => `• ${esc(e.title)}: ${esc(e.error)}`));
  }
  return lines.join("\n");
}
