import { describe, expect, it } from "vitest";
import { formatDigest, groupByCity, type FoundMessage } from "./digest";

const at = (h: number) => new Date(Date.UTC(2026, 8, 29, h, 0));
const msg = (text: string, h = 8): FoundMessage => ({
  sourceTitle: "ИСПАНИЯ · Защита",
  date: at(h),
  text,
  link: "https://t.me/spain_useful/1",
});

describe("chat digest", () => {
  it("puts city summaries first and messages without a city last", () => {
    const groups = groupByCity([
      msg("без міста, але про Резерв+ і штамп", 7),
      msg("Сарагоса — справка с хурадо", 8),
      msg("Мадрид, Бильбао, Малага — зведення", 9),
      msg("Сарагоса — живой очереди нет", 10),
    ]);
    expect([...groups.keys()]).toEqual(["Зведення по містах", "Сарагоса", "Без міста"]);
    expect(groups.get("Сарагоса")).toHaveLength(2);
  });

  it("escapes what people wrote and links every message", () => {
    const [text] = formatDigest({
      found: [msg("Бильбао <b>штамп</b> & Резерв+")],
      sources: 2,
      hidden: 40,
      errors: [],
      now: at(17),
    });
    expect(text).toContain("📍 <b>Більбао</b> (1)");
    expect(text).toContain("&lt;b&gt;штамп&lt;/b&gt; &amp; Резерв+");
    expect(text).toContain('<a href="https://t.me/spain_useful/1">відкрити →</a>');
    expect(text).toContain("Нових: 1 · груп: 2 · сховано як не про захист: 40");
  });

  it("says so when there is nothing new, and reports sources it could not read", () => {
    const [text] = formatDigest({ found: [], sources: 3, hidden: 12, errors: [{ title: "Аліканте", error: "CHANNEL_PRIVATE" }], now: at(17) });
    expect(text).toContain("Нового про захист немає · перевірено груп: 3");
    expect(text).toContain("• Аліканте: CHANNEL_PRIVATE");
  });

  it("splits a long digest into messages Telegram accepts", () => {
    const found = Array.from({ length: 30 }, (_, i) => msg(`Сарагоса ${i}: справка с хурадо. ${"текст ".repeat(120)}`, 8));
    const parts = formatDigest({ found, sources: 1, hidden: 0, errors: [], now: at(17) });
    expect(parts.length).toBeGreaterThan(1);
    for (const part of parts) expect(part.length).toBeLessThanOrEqual(4096);
  });
});
