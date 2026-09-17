import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";

// RFC 2606 reserves ".invalid" for exactly this: an address guaranteed to
// never resolve or deliver. Supabase Auth requires an email-shaped identifier
// even for a non-email identity provider; this domain documents that the
// address is synthetic and its uniqueness is what matters, not deliverability.
const SYNTHETIC_EMAIL_DOMAIN = "tg.invalid";

export function syntheticEmailFor(telegramUserId: number): string {
  return `tg-${telegramUserId}@${SYNTHETIC_EMAIL_DOMAIN}`;
}

export type AuthBridgeResult = { ok: true } | { ok: false; error: string };

/**
 * "Workaround: Telegram is not a built-in Supabase provider" bridge.
 *
 * Docs read for this design:
 * - https://supabase.com/docs/reference/javascript/auth-admin-generatelink
 * - https://supabase.com/docs/reference/javascript/auth-verifyotp
 * - https://supabase.com/docs/guides/auth/auth-admin-api
 *
 * Steps (see docs/SPEC.md "TELEGRAM AUTH DESIGN" for the full risk analysis):
 * 1. admin.generateLink({ type: 'magiclink', email }) — service-role only.
 *    Auto-creates the auth.users row on first login; never sends a real email
 *    (the domain is unroutable) and returns a `hashed_token` we redeem below.
 * 2. Upsert `profiles(id, telegram_user_id)` with the service-role client —
 *    idempotent, so repeat logins are a no-op here.
 * 3. Redeem the token on a request-scoped, cookie-bound server client via
 *    `verifyOtp({ token_hash, type: 'magiclink' })` (the `token_hash` field,
 *    not `token`+`email` — verified against the installed @supabase/supabase-js
 *    types: VerifyTokenHashParams is the shape for a generateLink token).
 *    This issues a real Supabase Auth session and writes its cookies onto the
 *    Next.js response via the same cookie adapter used everywhere else.
 */
export async function signInTelegramUser(telegramUserId: number): Promise<AuthBridgeResult> {
  const admin = createAdminClient();
  const email = syntheticEmailFor(telegramUserId);

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (linkError || !linkData?.properties?.hashed_token) {
    return { ok: false, error: linkError?.message ?? "generateLink returned no hashed_token" };
  }

  const { error: profileError } = await admin
    .from("profiles")
    .upsert({ id: linkData.user.id, telegram_user_id: telegramUserId }, { onConflict: "id" });
  if (profileError) {
    return { ok: false, error: profileError.message };
  }

  const supabase = await createServerSupabaseClient();
  const { error: verifyError } = await supabase.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: "magiclink",
  });
  if (verifyError) {
    return { ok: false, error: verifyError.message };
  }

  return { ok: true };
}
