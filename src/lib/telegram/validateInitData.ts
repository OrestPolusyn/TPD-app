import { createHmac, timingSafeEqual } from "node:crypto";

const MAX_AUTH_AGE_SECONDS = 24 * 60 * 60; // 24h, per docs/SPEC.md

export interface TelegramUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
}

export interface ValidatedTelegramIdentity {
  telegramUserId: number;
  authDate: number;
}

export type ValidationResult =
  | { ok: true; identity: ValidatedTelegramIdentity }
  | { ok: false; reason: "bad_hash" | "expired" | "malformed" };

/**
 * Validates Telegram Mini App `initData` per:
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 *
 * Algorithm (distinct from the Login Widget's — see validateLoginWidget.ts):
 *   secret_key = HMAC_SHA256(key="WebAppData", data=<bot_token>)
 *   data_check_string = all initData fields except `hash`, sorted by key,
 *                        joined as "key=value" with "\n"
 *   computed_hash = hex(HMAC_SHA256(key=secret_key, data=data_check_string))
 *   valid iff computed_hash === hash (timing-safe) AND now - auth_date <= 24h
 */
export function validateInitData(initData: string, botToken: string): ValidationResult {
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(initData);
  } catch {
    return { ok: false, reason: "malformed" };
  }

  const hash = params.get("hash");
  const authDateRaw = params.get("auth_date");
  const userRaw = params.get("user");
  if (!hash || !authDateRaw || !userRaw) {
    return { ok: false, reason: "malformed" };
  }

  const pairs: string[] = [];
  for (const [key, value] of params.entries()) {
    if (key === "hash") continue;
    pairs.push(`${key}=${value}`);
  }
  pairs.sort();
  const dataCheckString = pairs.join("\n");

  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
  const computedHash = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  if (!timingSafeEqualHex(computedHash, hash)) {
    return { ok: false, reason: "bad_hash" };
  }

  const authDate = Number.parseInt(authDateRaw, 10);
  if (!Number.isFinite(authDate)) {
    return { ok: false, reason: "malformed" };
  }
  const ageSeconds = Math.floor(Date.now() / 1000) - authDate;
  if (ageSeconds > MAX_AUTH_AGE_SECONDS) {
    return { ok: false, reason: "expired" };
  }

  let user: TelegramUser;
  try {
    user = JSON.parse(userRaw);
  } catch {
    return { ok: false, reason: "malformed" };
  }
  if (typeof user.id !== "number") {
    return { ok: false, reason: "malformed" };
  }

  return { ok: true, identity: { telegramUserId: user.id, authDate } };
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}
