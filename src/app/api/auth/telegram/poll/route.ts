import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { consumeApprovedLoginRequest, LOGIN_NONCE_COOKIE } from "@/lib/telegram/loginRequests";
import { signInTelegramUser } from "@/lib/telegram/authBridge";

export const dynamic = "force-dynamic";

/**
 * Step two: the browser that started the login asks whether it was approved.
 *
 * This is where the session is created, which is the fix — the Set-Cookie for
 * it rides back on *this* response, to the browser holding the nonce, not to
 * whatever WebView happened to open a link in a chat.
 *
 * POST rather than GET because it consumes the approval; nothing here reads
 * user input, and the nonce is SameSite=Lax, so a cross-site call carries no
 * cookie and can do nothing.
 */
export async function POST() {
  const cookieStore = await cookies();
  const nonce = cookieStore.get(LOGIN_NONCE_COOKIE)?.value;
  if (!nonce) {
    return NextResponse.json({ status: "none" });
  }

  const state = await consumeApprovedLoginRequest(nonce);
  if (state.status !== "approved") {
    if (state.status === "expired" || state.status === "none") {
      cookieStore.delete(LOGIN_NONCE_COOKIE);
    }
    return NextResponse.json({ status: state.status, ...(state.status === "pending" ? { code: state.code } : {}) });
  }

  const result = await signInTelegramUser(state.telegramUserId, {
    firstName: state.firstName,
    username: state.username,
  });
  if (!result.ok) {
    console.error("bot login sign-in failed:", result.error);
    return NextResponse.json({ status: "failed" }, { status: 500 });
  }

  cookieStore.delete(LOGIN_NONCE_COOKIE);
  return NextResponse.json({ status: "signed_in" });
}
