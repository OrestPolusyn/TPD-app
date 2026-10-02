import { describe, expect, it } from "vitest";
import { formatRunNotice, type FoundMessage } from "./digest";

const at = (h: number) => new Date(Date.UTC(2026, 8, 29, h, 0));
const msg = (text: string): FoundMessage => ({
  sourceTitle: "ИСПАНИЯ · Защита",
  date: at(8),
  text,
  link: "https://t.me/spain_useful/1",
});

describe("run notice", () => {
  it("counts what was read and never pastes the messages themselves", () => {
    const text = formatRunNotice({ found: [msg("Бильбао - справку не признают"), msg("Луго - дали")], sources: 17, hidden: 240, errors: [], now: at(20) });
    expect(text).toContain("Прочитано нових повідомлень: 2 (груп: 17)");
    expect(text).toContain("чернетки прийдуть");
    expect(text).not.toContain("Бильбао");
    expect(text).not.toContain("t.me");
  });

  it("says so when there is nothing new, and reports groups it could not read", () => {
    const text = formatRunNotice({ found: [], sources: 3, hidden: 0, errors: [{ title: "Аліканте <x>", error: "CHANNEL_PRIVATE" }], now: at(20) });
    expect(text).toContain("Нового про захист немає · перевірено груп: 3");
    expect(text).toContain("• Аліканте &lt;x&gt;: CHANNEL_PRIVATE");
  });
});
