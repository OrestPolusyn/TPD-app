import { createHash, randomBytes, randomInt } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

/** Long enough to walk over to Telegram and back, short enough to expire unused. */
const TTL_MINUTES = 10;

/** Holds the secret half of a login request. httpOnly: only the server reads it. */
export const LOGIN_NONCE_COOKIE = "tg_login_nonce";

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export interface NewLoginRequest {
  /** Public: travels to Telegram inside the deep link. Grants nothing alone. */
  requestId: string;
  /** Secret: the browser's cookie, and the only thing that can redeem an approval. */
  nonce: string;
  /** Shown in the browser and in the chat, for the person to compare. */
  code: string;
}

/**
 * Starts a login, from the browser side.
 *
 * Nothing about the person is known yet — that arrives when they confirm in
 * Telegram (see approveLoginRequest). This only stakes out a row that the
 * chat can later approve and this browser, holding the nonce, can redeem.
 */
export async function createLoginRequest(): Promise<NewLoginRequest | null> {
  const admin = createAdminClient();
  const requestId = randomBytes(16).toString("base64url");
  const nonce = randomBytes(32).toString("base64url");
  // Four digits is enough to make a blind "yes" unlikely to match, and short
  // enough that people actually compare it instead of skipping past.
  const code = String(randomInt(0, 10_000)).padStart(4, "0");

  const { error } = await admin.from("telegram_login_requests").insert({
    request_id: requestId,
    nonce_hash: hash(nonce),
    code,
    expires_at: new Date(Date.now() + TTL_MINUTES * 60_000).toISOString(),
  });
  if (error) {
    console.error("createLoginRequest failed:", error.message);
    return null;
  }

  // Best effort; a failure here must not cost the user their login.
  const { error: pruneError } = await admin.rpc("prune_telegram_login_requests");
  if (pruneError) console.error("prune_telegram_login_requests failed:", pruneError.message);

  return { requestId, nonce, code };
}

/**
 * The login this browser already has in flight, if any.
 *
 * Reloading /me (or coming back to it) must not mint a second request: the
 * bot's message still quotes the first one's code, and approving it would
 * leave the browser polling for a request nobody confirmed.
 */
export async function findPendingRequestByNonce(nonce: string): Promise<{ requestId: string; code: string } | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("telegram_login_requests")
    .select("request_id, code")
    .eq("nonce_hash", hash(nonce))
    .is("consumed_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (error) {
    console.error("findPendingRequestByNonce failed:", error.message);
    return null;
  }
  return data ? { requestId: data.request_id, code: data.code } : null;
}

/** The code to quote in the chat, or null if the request is spent or expired. */
export async function findPendingLoginRequest(requestId: string): Promise<{ code: string } | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("telegram_login_requests")
    .select("code")
    .eq("request_id", requestId)
    .is("approved_at", null)
    .is("consumed_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (error) {
    console.error("findPendingLoginRequest failed:", error.message);
    return null;
  }
  return data ? { code: data.code } : null;
}

export interface TelegramApprover {
  id: number;
  first_name?: string;
  username?: string;
}

/**
 * Approves a request from the chat side.
 *
 * Only ever called from the bot webhook, whose updates Telegram signs with a
 * secret derived from the bot token — so the id (and the name, which the old
 * link flow threw away) is authentic. Guarded in the UPDATE itself, so an
 * already-approved or expired request cannot be approved a second time.
 */
export async function approveLoginRequest(requestId: string, approver: TelegramApprover): Promise<boolean> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("telegram_login_requests")
    .update({
      telegram_user_id: approver.id,
      telegram_first_name: approver.first_name ?? null,
      telegram_username: approver.username ?? null,
      approved_at: new Date().toISOString(),
    })
    .eq("request_id", requestId)
    .is("approved_at", null)
    .is("consumed_at", null)
    .gt("expires_at", new Date().toISOString())
    .select("request_id")
    .maybeSingle();

  if (error) {
    console.error("approveLoginRequest failed:", error.message);
    return false;
  }
  return data !== null;
}

export type LoginRequestState =
  | { status: "none" }
  | { status: "pending"; code: string }
  | { status: "approved"; telegramUserId: number; firstName?: string; username?: string }
  | { status: "expired" };

/**
 * What the polling browser gets: the approval if there is one, consumed in the
 * same statement that reads it.
 *
 * Single-use is enforced by the UPDATE's own filters — `consumed_at is null`
 * plus an unexpired `expires_at` — so two simultaneous polls cannot both come
 * back with an approval, and a replay finds nothing.
 */
export async function consumeApprovedLoginRequest(nonce: string): Promise<LoginRequestState> {
  const admin = createAdminClient();
  const nonceHash = hash(nonce);
  const now = new Date().toISOString();

  const { data: approved, error } = await admin
    .from("telegram_login_requests")
    .update({ consumed_at: now })
    .eq("nonce_hash", nonceHash)
    .not("approved_at", "is", null)
    .is("consumed_at", null)
    .gt("expires_at", now)
    .select("telegram_user_id, telegram_first_name, telegram_username")
    .maybeSingle();

  if (error) {
    console.error("consumeApprovedLoginRequest failed:", error.message);
    return { status: "none" };
  }
  if (approved?.telegram_user_id) {
    return {
      status: "approved",
      telegramUserId: approved.telegram_user_id,
      firstName: approved.telegram_first_name ?? undefined,
      username: approved.telegram_username ?? undefined,
    };
  }

  // Nothing to redeem: say whether it is still worth waiting for.
  const { data: row } = await admin
    .from("telegram_login_requests")
    .select("code, consumed_at, expires_at")
    .eq("nonce_hash", nonceHash)
    .maybeSingle();

  if (!row) return { status: "none" };
  if (row.consumed_at || row.expires_at <= now) return { status: "expired" };
  return { status: "pending", code: row.code };
}

export const LOGIN_REQUEST_TTL_MINUTES = TTL_MINUTES;
