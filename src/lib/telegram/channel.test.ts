import { afterEach, describe, expect, it, vi } from "vitest";
import { experienceUrl, postKeyboard } from "./channel";
import { guidePostText } from "@/lib/guide";

afterEach(() => vi.unstubAllEnvs());

function setBot(app: string | null) {
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://tp.example");
  vi.stubEnv("NEXT_PUBLIC_TELEGRAM_BOT_USERNAME", "tpspain_bot");
  if (app) vi.stubEnv("NEXT_PUBLIC_TELEGRAM_MINI_APP_NAME", app);
  else vi.stubEnv("NEXT_PUBLIC_TELEGRAM_MINI_APP_NAME", "");
}

describe("channel post buttons", () => {
  it("has confirm + changed on the first row, experience + details on the second", () => {
    setBot("app");
    const kb = postKeyboard({ postId: 42, locationId: "comisaria-alicante", votes: 0 });
    const [first, second] = kb.inline_keyboard;
    expect(first[0]).toEqual({ text: "✅ Актуально", callback_data: "v:42" });
    expect(first[1].url).toBe("https://t.me/tpspain_bot?start=chg_42");
    expect(second[0].url).toBe("https://t.me/tpspain_bot/app?startapp=report_comisaria-alicante");
    expect(second[1].url).toBe("https://tp.example/locations/comisaria-alicante");
  });

  it("invites the reader's own story on its own row, through the bot", () => {
    setBot("app");
    const kb = postKeyboard({ postId: 42, locationId: "comisaria-alicante", votes: 0 });
    const last = kb.inline_keyboard[kb.inline_keyboard.length - 1];
    expect(last).toEqual([{ text: "💬 Моя історія", url: "https://t.me/tpspain_bot?start=story_42" }]);
  });

  it("shows the running count once someone has confirmed", () => {
    setBot("app");
    const kb = postKeyboard({ postId: 42, locationId: "comisaria-alicante", votes: 12 });
    expect(kb.inline_keyboard[0][0].text).toBe("✅ Актуально · 12");
  });

  it("keeps every callback within Telegram's 64-byte limit", () => {
    setBot("app");
    const kb = postKeyboard({ postId: 9_999_999_999, locationId: "comisaria-castellon-de-la-plana", votes: 0 });
    for (const row of kb.inline_keyboard) {
      for (const button of row) {
        if (button.callback_data) expect(Buffer.byteLength(button.callback_data)).toBeLessThanOrEqual(64);
      }
    }
    // /start payloads: same 64-char limit.
    expect("report_comisaria-castellon-de-la-plana".length).toBeLessThanOrEqual(64);
  });

  it("falls back to the site's report form when there is no Mini App", () => {
    setBot(null);
    expect(experienceUrl("comisaria-alicante")).toBe("https://tp.example/reports/new?location=comisaria-alicante");
  });

  it("links a guide post to the guide page instead of an office", () => {
    setBot("app");
    const kb = postKeyboard({ postId: 1, locationId: null, votes: 0, detailUrl: "https://tp.example/guide/dovidka" });
    const buttons = kb.inline_keyboard.flat();
    expect(buttons.some((b) => b.text === "➕ Мій досвід")).toBe(false);
    expect(buttons.find((b) => b.text === "🔎 Детальніше")?.url).toBe("https://tp.example/guide/dovidka");
  });
});

describe("guide post", () => {
  it("names the cities by requirement and stays short", () => {
    const post = guidePostText();
    expect(post).toContain("<b>Мокра печатка:</b> Малага");
    expect(post).toContain("<b>Не визнають (потрібен штамп):</b> Мадрид, Більбао");
    expect(post).toContain("#довідки");
    expect(post.length).toBeLessThan(1000);
  });
});
