import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import { validateInitData } from "./validateInitData";

const BOT_TOKEN = "123456:FAKE-BOT-TOKEN-FOR-TESTS";

function buildInitData(overrides: Partial<{ authDate: number; userId: number }> = {}): string {
  const authDate = overrides.authDate ?? Math.floor(Date.now() / 1000);
  const userId = overrides.userId ?? 42;
  const user = JSON.stringify({ id: userId, first_name: "Test" });

  const params: [string, string][] = [
    ["auth_date", String(authDate)],
    ["query_id", "AAH123"],
    ["user", user],
  ];
  const dataCheckString = [...params].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join("\n");

  const secretKey = createHmac("sha256", "WebAppData").update(BOT_TOKEN).digest();
  const hash = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  const search = new URLSearchParams([...params, ["hash", hash]]);
  return search.toString();
}

describe("validateInitData", () => {
  it("accepts a correctly signed, fresh payload", () => {
    const initData = buildInitData();
    const result = validateInitData(initData, BOT_TOKEN);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.identity.telegramUserId).toBe(42);
    }
  });

  it("rejects a tampered payload (hash no longer matches)", () => {
    const initData = buildInitData().replace("query_id=AAH123", "query_id=TAMPERED");
    const result = validateInitData(initData, BOT_TOKEN);
    expect(result).toEqual({ ok: false, reason: "bad_hash" });
  });

  it("rejects a payload signed with a different bot token", () => {
    const initData = buildInitData();
    const result = validateInitData(initData, "999999:different-token");
    expect(result).toEqual({ ok: false, reason: "bad_hash" });
  });

  it("rejects auth_date older than 24 hours", () => {
    const initData = buildInitData({ authDate: Math.floor(Date.now() / 1000) - 25 * 60 * 60 });
    const result = validateInitData(initData, BOT_TOKEN);
    expect(result).toEqual({ ok: false, reason: "expired" });
  });

  it("accepts auth_date just under 24 hours old", () => {
    const initData = buildInitData({ authDate: Math.floor(Date.now() / 1000) - 23 * 60 * 60 });
    const result = validateInitData(initData, BOT_TOKEN);
    expect(result.ok).toBe(true);
  });

  it("rejects malformed input missing required fields", () => {
    const result = validateInitData("foo=bar", BOT_TOKEN);
    expect(result).toEqual({ ok: false, reason: "malformed" });
  });
});
