import { createHash, randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

/** Long enough to be worth sending in a chat message, short enough to expire unused. */
const TTL_MINUTES = 10;

function hash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Mints a one-time login token for a Telegram user id.
 *
 * Only ever called from the bot webhook, whose updates Telegram signs with a
 * secret derived from the bot token — so the id is authentic and this is not
 * a way to log in as an arbitrary user.
 *
 * Returns the raw token; only its hash is stored.
 */
export async function issueLoginToken(telegramUserId: number): Promise<string | null> {
  const admin = createAdminClient();
  const token = randomBytes(32).toString("base64url");

  const { error } = await admin.from("telegram_login_tokens").insert({
    token_hash: hash(token),
    telegram_user_id: telegramUserId,
    expires_at: new Date(Date.now() + TTL_MINUTES * 60_000).toISOString(),
  });
  if (error) {
    console.error("issueLoginToken failed:", error.message);
    return null;
  }

  // Best effort; a failure here must not cost the user their login.
  const { error: pruneError } = await admin.rpc("prune_telegram_login_tokens");
  if (pruneError) console.error("prune_telegram_login_tokens failed:", pruneError.message);

  return token;
}

/**
 * Redeems a token, returning the Telegram user id it was minted for.
 *
 * The guard is the UPDATE itself: matching on `consumed_at is null` and an
 * unexpired `expires_at` in the same statement means two simultaneous redeems
 * cannot both succeed, and a replayed link finds nothing.
 */
export async function consumeLoginToken(token: string): Promise<number | null> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("telegram_login_tokens")
    .update({ consumed_at: new Date().toISOString() })
    .eq("token_hash", hash(token))
    .is("consumed_at", null)
    .gt("expires_at", new Date().toISOString())
    .select("telegram_user_id")
    .maybeSingle();

  if (error) {
    console.error("consumeLoginToken failed:", error.message);
    return null;
  }
  return data?.telegram_user_id ?? null;
}

export const LOGIN_TOKEN_TTL_MINUTES = TTL_MINUTES;
