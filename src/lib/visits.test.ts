import { describe, expect, it } from "vitest";
import { isBot, normalizePath, visitorHash } from "./visits";

describe("visitorHash", () => {
  it("is stable within a day and unrelated across days", () => {
    const a = visitorHash("k", "2026-09-24", "1.2.3.4", "Safari");
    expect(visitorHash("k", "2026-09-24", "1.2.3.4", "Safari")).toBe(a);
    expect(visitorHash("k", "2026-09-25", "1.2.3.4", "Safari")).not.toBe(a);
  });

  it("never contains the IP", () => {
    expect(visitorHash("k", "2026-09-24", "1.2.3.4", "Safari")).not.toContain("1.2.3.4");
  });
});

describe("isBot", () => {
  it("skips crawlers and Telegram's link preview", () => {
    expect(isBot("TelegramBot (like TwitterBot)")).toBe(true);
    expect(isBot("Mozilla/5.0 (compatible; Googlebot/2.1)")).toBe(true);
    expect(isBot("")).toBe(true);
  });

  it("counts an ordinary phone browser", () => {
    expect(isBot("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1")).toBe(false);
  });
});

describe("normalizePath", () => {
  it("drops the query string and a trailing slash", () => {
    expect(normalizePath("/results?docs=international_passport")).toBe("/results");
    expect(normalizePath("/locations/comisaria-alicante/")).toBe("/locations/comisaria-alicante");
    expect(normalizePath("/")).toBe("/");
  });

  it("ignores API calls, the stats page and anything that is not a path", () => {
    expect(normalizePath("/api/visit")).toBeNull();
    expect(normalizePath("/admin/stats")).toBeNull();
    expect(normalizePath("https://evil.example/")).toBeNull();
    expect(normalizePath(42)).toBeNull();
  });
});
