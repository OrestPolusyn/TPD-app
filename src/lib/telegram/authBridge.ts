import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerSupabaseClient } from "@/lib/supabase/server";
import { notifyNewUser } from "@/lib/telegram/notifyModerator";

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
export interface TelegramDisplayProfile {
  firstName?: string;
  username?: string;
  photoUrl?: string;
}

export async function signInTelegramUser(
  telegramUserId: number,
  displayProfile?: TelegramDisplayProfile
): Promise<AuthBridgeResult> {
  const admin = createAdminClient();
  const email = syntheticEmailFor(telegramUserId);

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (linkError || !linkData?.properties?.hashed_token) {
    return { ok: false, error: linkError?.message ?? "generateLink returned no hashed_token" };
  }

  // Checked before the upsert below creates the row: a first login is the
  // one worth telling the owner about.
  const { data: existingProfile } = await admin.from("profiles").select("id").eq("id", linkData.user.id).maybeSingle();
  const isNewUser = !existingProfile;

  // Refreshed on every login so a changed Telegram name/photo catches up here
  // too — deliberately never touches `display_name`, the person's own
  // override (set via set_own_display_name), which this must not clobber.
  //
  // The fields below are set to `undefined`, not `null`, when Telegram didn't
  // send one this time (e.g. a login widget response with no photo_url, or a
  // user with no profile photo at all) — JSON.stringify drops an `undefined`
  // key entirely, so PostgREST's upsert leaves that column exactly as it was
  // rather than blanking out a name/avatar that a *previous* login did supply.
  const { error: profileError } = await admin.from("profiles").upsert(
    {
      id: linkData.user.id,
      telegram_user_id: telegramUserId,
      telegram_first_name: displayProfile?.firstName,
      telegram_username: displayProfile?.username,
      avatar_url: displayProfile?.photoUrl,
    },
    { onConflict: "id" }
  );
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

  if (isNewUser) await announceNewUser(admin, displayProfile);

  return { ok: true };
}

/**
 * Tells the owner's Telegram that someone new joined, with the running total.
 * Best effort: a sign-in must never fail because the notice could not be sent.
 */
async function announceNewUser(admin: ReturnType<typeof createAdminClient>, profile?: TelegramDisplayProfile) {
  try {
    const { count } = await admin.from("profiles").select("id", { count: "exact", head: true });
    await notifyNewUser({
      name: profile?.firstName?.trim() || "Без імені",
      username: profile?.username ?? null,
      total: count ?? 0,
    });
  } catch (err) {
    console.error("new-user notice failed:", err);
  }
}
