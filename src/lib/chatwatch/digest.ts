/**
 * The digest message: what the chats said about protection since the last
 * run, grouped by city, in Telegram HTML. Pure, so it is tested without
 * Telegram.
 */
import { esc } from "@/lib/telegram/html";
import { citiesIn } from "@/lib/chatwatch/relevance";

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

/** A message naming this many cities is a city-by-city summary. */
const SUMMARY_CITIES = 3;
const MAX_MESSAGE = 3800;
const MAX_TEXT = 700;

const madridTime = (d: Date, withDay: boolean) =>
  new Intl.DateTimeFormat("uk-UA", {
    timeZone: "Europe/Madrid",
    ...(withDay ? { day: "2-digit", month: "2-digit" } : {}),
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);

function clip(text: string, max: number) {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

export function groupByCity(found: FoundMessage[]): Map<string, FoundMessage[]> {
  const groups = new Map<string, FoundMessage[]>();
  for (const m of [...found].sort((a, b) => a.date.getTime() - b.date.getTime())) {
    const cities = citiesIn(m.text);
    const key = cities.length >= SUMMARY_CITIES ? "Зведення по містах" : (cities[0] ?? "Без міста");
    groups.set(key, [...(groups.get(key) ?? []), m]);
  }
  // Summaries first, messages without a city last, the rest by volume.
  const rank = (k: string) => (k === "Зведення по містах" ? 0 : k === "Без міста" ? 2 : 1);
  return new Map([...groups.entries()].sort((a, b) => rank(a[0]) - rank(b[0]) || b[1].length - a[1].length));
}

/** Telegram messages to send, each under the 4096-character limit. */
export function formatDigest({ found, sources, hidden, errors, now }: DigestInput): string[] {
  const header = [
    `🗞 <b>Чати про захист</b> · ${esc(madridTime(now, true))}`,
    found.length > 0
      ? `Нових: ${found.length} · груп: ${sources} · сховано як не про захист: ${hidden}`
      : `Нового про захист немає · перевірено груп: ${sources}`,
  ].join("\n");

  const blocks: string[] = [];
  for (const [city, messages] of groupByCity(found)) {
    blocks.push(`\n📍 <b>${esc(city)}</b> (${messages.length})`);
    for (const m of messages) {
      blocks.push(
        `• <i>${esc(madridTime(m.date, true))} · ${esc(m.sourceTitle)}</i>\n${esc(clip(m.text, MAX_TEXT))}\n<a href="${esc(m.link)}">відкрити →</a>`
      );
    }
  }
  if (errors.length > 0) {
    blocks.push(`\n⚠️ <b>Не вдалося прочитати</b>\n${errors.map((e) => `• ${esc(e.title)}: ${esc(e.error)}`).join("\n")}`);
  }

  const out: string[] = [];
  let current = header;
  for (const block of blocks) {
    if (current.length + block.length + 1 > MAX_MESSAGE) {
      out.push(current);
      current = block.trimStart();
    } else {
      current += `\n${block}`;
    }
  }
  out.push(current);
  return out;
}

/**
 * What the owner gets after a run: not the messages themselves — those are
 * turned into ready drafts (comment or change, with buttons) by the
 * scheduled Claude pass a few minutes later — just how many there were.
 * The raw list stays one command away (/watch_raw).
 */
export function formatRunNotice({ found, sources, hidden, errors, now }: DigestInput): string {
  const lines = [`🗞 <b>Чати про захист</b> · ${esc(madridTime(now, true))}`];
  if (found.length > 0) {
    lines.push(
      `Нових повідомлень: ${found.length} · груп: ${sources} · сховано як не про захист: ${hidden}`,
      "Готові до публікації чернетки (коментар або зміна, з кнопками) прийдуть сюди після обробки — о 12:05 або 22:05.",
      "Сирий список: /watch_raw"
    );
  } else {
    lines.push(`Нового про захист немає · перевірено груп: ${sources}`);
  }
  if (errors.length > 0) {
    lines.push("", `⚠️ <b>Не вдалося прочитати</b>`, ...errors.map((e) => `• ${esc(e.title)}: ${esc(e.error)}`));
  }
  return lines.join("\n");
}
