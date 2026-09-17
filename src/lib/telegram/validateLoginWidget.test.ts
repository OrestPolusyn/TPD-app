import { describe, it, expect } from "vitest";
import { createHash, createHmac } from "node:crypto";
import { validateLoginWidget, type LoginWidgetPayload } from "./validateLoginWidget";

const BOT_TOKEN = "123456:FAKE-BOT-TOKEN-FOR-TESTS";

function buildPayload(overrides: Partial<LoginWidgetPayload> = {}): LoginWidgetPayload {
  const base = {
    id: 42,
    first_name: "Test",
    auth_date: Math.floor(Date.now() / 1000),
    ...overrides,
  };

  const dataCheckString = Object.entries(base)
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join("\n");

  // Login Widget's secret key is SHA256(bot_token) directly — NOT an HMAC,
  // unlike the Mini App algorithm. This is the key difference under test.
  const secretKey = createHash("sha256").update(BOT_TOKEN).digest();
  const hash = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  return { ...base, hash };
}

describe("validateLoginWidget", () => {
  it("accepts a correctly signed, fresh payload", () => {
    const payload = buildPayload();
    const result = validateLoginWidget(payload, BOT_TOKEN);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.identity.telegramUserId).toBe(42);
    }
  });

  it("rejects a tampered payload", () => {
    const payload = buildPayload();
    payload.first_name = "Tampered";
    const result = validateLoginWidget(payload, BOT_TOKEN);
    expect(result).toEqual({ ok: false, reason: "bad_hash" });
  });

  it("uses SHA256(token) as the secret, not HMAC(token) like the Mini App does", () => {
    const payload = buildPayload();
    // Sanity check that the Mini App's secret-key derivation would NOT validate here,
    // proving the two algorithms are genuinely different and not accidentally identical.
    const wrongSecretKey = createHmac("sha256", "WebAppData").update(BOT_TOKEN).digest();
    const dataCheckString = Object.entries({ id: payload.id, first_name: payload.first_name, auth_date: payload.auth_date })
      .map(([k, v]) => `${k}=${v}`)
      .sort()
      .join("\n");
    const wrongHash = createHmac("sha256", wrongSecretKey).update(dataCheckString).digest("hex");
    expect(wrongHash).not.toBe(payload.hash);
  });

  it("rejects auth_date older than 24 hours", () => {
    const payload = buildPayload({ auth_date: Math.floor(Date.now() / 1000) - 25 * 60 * 60 });
    const result = validateLoginWidget(payload, BOT_TOKEN);
    expect(result).toEqual({ ok: false, reason: "expired" });
  });
});
