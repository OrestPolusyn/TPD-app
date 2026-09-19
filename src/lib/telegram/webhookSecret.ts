import { createHmac } from "node:crypto";

/**
 * The secret Telegram echoes back on every webhook call, derived from the bot
 * token rather than configured separately.
 *
 * A hand-managed TELEGRAM_WEBHOOK_SECRET has to be identical in two places —
 * whatever registered the webhook, and the deployment receiving it — and when
 * they drift Telegram just reports "403 Forbidden" against a bot that looks
 * correctly configured. Deriving it removes that failure mode entirely: both
 * sides compute the same value from the token they already share, and it is
 * unguessable without that token.
 */
export function deriveWebhookSecret(botToken: string): string {
  return createHmac("sha256", botToken).update("tpspain-webhook-v1").digest("hex");
}
