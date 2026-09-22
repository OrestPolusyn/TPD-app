/**
 * Minimal Bot API client. No dependency: every call is the same POST shape.
 * https://core.telegram.org/bots/api
 */
const API = "https://api.telegram.org/bot";

export interface TelegramApiResult<T> {
  ok: boolean;
  result?: T;
  description?: string;
}

export async function callTelegram<T>(
  token: string,
  method: string,
  params: Record<string, unknown> = {}
): Promise<TelegramApiResult<T>> {
  const res = await fetch(`${API}${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
    cache: "no-store",
  });
  return (await res.json()) as TelegramApiResult<T>;
}

export interface BotIdentity {
  id: number;
  username: string;
  first_name: string;
  can_join_groups?: boolean;
}

/**
 * Which bot does this token actually belong to?
 *
 * The question that cost the most time on this project: the Mini App was opened
 * from one bot while the server held another bot's token, so every initData
 * failed its HMAC check with `bad_hash` and nothing said why. One call answers
 * it, so /api/health makes it.
 */
export async function getMe(token: string): Promise<BotIdentity | null> {
  const res = await callTelegram<BotIdentity>(token, "getMe");
  return res.ok && res.result ? res.result : null;
}

export interface WebhookInfo {
  url: string;
  pending_update_count: number;
  last_error_date?: number;
  last_error_message?: string;
  ip_address?: string;
  /** Absent means Telegram's default set, which covers every type we need. */
  allowed_updates?: string[];
}

/**
 * Is the bot actually wired up, and what did Telegram get last time it tried?
 *
 * An empty `url` means no webhook is registered, so the bot silently ignores
 * every message. A populated `last_error_message` is Telegram quoting our own
 * failure back at us — "403 Forbidden" there means the webhook was registered
 * with a secret the deployment does not have.
 */
export async function getWebhookInfo(token: string): Promise<WebhookInfo | null> {
  const res = await callTelegram<WebhookInfo>(token, "getWebhookInfo");
  return res.ok && res.result ? res.result : null;
}
