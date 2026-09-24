import { createHmac } from "node:crypto";

/**
 * Anonymous per-day visitor id: HMAC of (day, IP, user agent) under a
 * server-side key. The day is part of the input, so the same person maps to
 * an unrelated value tomorrow — distinct visitors per day can be counted,
 * nobody can be followed across days, and the IP is never stored.
 */
export function visitorHash(key: string, day: string, ip: string, userAgent: string): string {
  return createHmac("sha256", key).update(`${day}|${ip}|${userAgent}`).digest("hex").slice(0, 32);
}

/** Crawlers and link-preview fetchers (Telegram's included) are not visitors. */
const BOT_PATTERN =
  /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|headless|lighthouse|pingdom|monitor|curl|wget|python|node-fetch|axios/i;

export function isBot(userAgent: string): boolean {
  return userAgent === "" || BOT_PATTERN.test(userAgent);
}

/**
 * The path worth counting, or null for one that is not a page view.
 * Query strings are dropped (a search's ticked documents are nobody's
 * business here) and the length is capped.
 */
export function normalizePath(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw.startsWith("/")) return null;
  const path = raw.split(/[?#]/)[0].slice(0, 200);
  if (path.startsWith("/api/") || path.startsWith("/admin") || path.startsWith("/_next")) return null;
  return path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
}
