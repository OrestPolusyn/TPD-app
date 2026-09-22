import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { ValidationResult } from "./validateInitData";

const MAX_AUTH_AGE_SECONDS = 24 * 60 * 60; // 24h, per docs/SPEC.md

export interface LoginWidgetPayload {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

/**
 * Validates a Telegram Login Widget payload per:
 * https://core.telegram.org/widgets/login#checking-authorization
 *
 * Algorithm (distinct from the Mini App's — see validateInitData.ts):
 *   secret_key = SHA256(<bot_token>)   -- NOT an HMAC, unlike the Mini App
 *   data_check_string = all fields except `hash`, sorted by key,
 *                        joined as "key=value" with "\n"
 *   computed_hash = hex(HMAC_SHA256(key=secret_key, data=data_check_string))
 *   valid iff computed_hash === hash (timing-safe) AND now - auth_date <= 24h
 */
export function validateLoginWidget(payload: LoginWidgetPayload, botToken: string): ValidationResult {
  const { hash, ...rest } = payload;
  if (!hash || typeof rest.id !== "number" || typeof rest.auth_date !== "number") {
    return { ok: false, reason: "malformed" };
  }

  const pairs = Object.entries(rest)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `${key}=${value}`)
    .sort();
  const dataCheckString = pairs.join("\n");

  const secretKey = createHash("sha256").update(botToken).digest();
  const computedHash = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  if (!timingSafeEqualHex(computedHash, hash)) {
    return { ok: false, reason: "bad_hash" };
  }

  const ageSeconds = Math.floor(Date.now() / 1000) - rest.auth_date;
  if (ageSeconds > MAX_AUTH_AGE_SECONDS) {
    return { ok: false, reason: "expired" };
  }

  return {
    ok: true,
    identity: {
      telegramUserId: rest.id,
      authDate: rest.auth_date,
      firstName: rest.first_name,
      username: rest.username,
      photoUrl: rest.photo_url,
    },
  };
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}
