import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  createLoginRequest,
  findPendingRequestByNonce,
  LOGIN_NONCE_COOKIE,
  LOGIN_REQUEST_TTL_MINUTES,
} from "@/lib/telegram/loginRequests";
import { config } from "@/lib/config";

export const dynamic = "force-dynamic";

/**
 * Step one of signing in: mint a request, and hand back the link to the bot
 * for the page to render.
 *
 * Deliberately not a redirect. A redirect has to be opened from somewhere —
 * a new tab, which is then left behind for the person to close, or this one,
 * which throws away the page that is waiting for the confirmation. Returning
 * the link instead lets /me render it as an ordinary link: tapping it is a
 * real user gesture on a t.me address, which hands straight to the Telegram
 * app and leaves this page exactly where it was.
 *
 * The cookie is the point of the whole design: it stays in *this* browser,
 * and only this browser can redeem the approval (see ./poll).
 */
export async function POST() {
  const botUsername = config.telegramBotUsername();
  if (!botUsername) {
    return NextResponse.json({ error: "bot_not_configured" }, { status: 503 });
  }

  const cookieStore = await cookies();
  const existingNonce = cookieStore.get(LOGIN_NONCE_COOKIE)?.value;
  if (existingNonce) {
    const pending = await findPendingRequestByNonce(existingNonce);
    if (pending) {
      // Same request, same code as the bot already quoted — see
      // findPendingRequestByNonce. `resumed` tells the page a login is already
      // under way, so it starts polling rather than waiting for a tap.
      return NextResponse.json({
        deepLink: deepLink(botUsername, pending.requestId),
        code: pending.code,
        resumed: true,
      });
    }
  }

  const created = await createLoginRequest();
  if (!created) {
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }

  const response = NextResponse.json({
    deepLink: deepLink(botUsername, created.requestId),
    code: created.code,
    resumed: false,
  });
  response.cookies.set(LOGIN_NONCE_COOKIE, created.nonce, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: LOGIN_REQUEST_TTL_MINUTES * 60,
  });
  return response;
}

function deepLink(botUsername: string, requestId: string): string {
  return `https://t.me/${botUsername}?start=login_${requestId}`;
}
