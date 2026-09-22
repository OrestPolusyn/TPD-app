import { NextResponse } from "next/server";
import { createLoginRequest, LOGIN_NONCE_COOKIE, LOGIN_REQUEST_TTL_MINUTES } from "@/lib/telegram/loginRequests";
import { config } from "@/lib/config";

export const dynamic = "force-dynamic";

/**
 * Step one of signing in: mint a request here, then hand the person to the bot.
 *
 * A plain navigation target rather than a fetch+redirect, so the tap that
 * leaves for Telegram is the browser's own — no popup blocker, no JS needed,
 * and the cookie below is set on a real top-level response.
 *
 * That cookie is the whole point of the redesign: it stays in *this* browser,
 * and only this browser can later redeem the approval (see ./poll). The old
 * flow put a login link in the chat instead, which on a phone opens Telegram's
 * in-app browser and signed that WebView in, leaving the person's actual
 * browser signed out with no way forward.
 */
export async function GET(request: Request) {
  const botUsername = config.telegramBotUsername();
  if (!botUsername) {
    return NextResponse.redirect(new URL("/me?login=failed", request.url));
  }

  const created = await createLoginRequest();
  if (!created) {
    return NextResponse.redirect(new URL("/me?login=failed", request.url));
  }

  const response = NextResponse.redirect(`https://t.me/${botUsername}?start=login_${created.requestId}`);
  response.cookies.set(LOGIN_NONCE_COOKIE, created.nonce, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: LOGIN_REQUEST_TTL_MINUTES * 60,
  });
  return response;
}
