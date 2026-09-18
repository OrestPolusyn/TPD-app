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
