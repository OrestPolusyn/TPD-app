import { NextResponse } from "next/server";
import { consumeLoginToken } from "@/lib/telegram/loginTokens";
import { signInTelegramUser } from "@/lib/telegram/authBridge";

export const dynamic = "force-dynamic";

/**
 * Redeems a one-time login link sent by the bot.
 *
 * The token is single-use and short-lived, and the Telegram user id behind it
 * came off a webhook update Telegram signed — so reaching this route with a
 * valid token is proof of that Telegram account, without the Login Widget's
 * /setdomain or a Mini App.
 *
 * Every failure redirects to /me with a reason rather than rendering an error:
 * a stale link in a chat is the normal case, not an exception, and the page
 * there can offer a fresh one.
 */
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (!token) {
    return NextResponse.redirect(new URL("/me?login=missing", request.url));
  }

  const telegramUserId = await consumeLoginToken(token);
  if (telegramUserId === null) {
    // Expired, already used, or never existed — deliberately indistinguishable.
    return NextResponse.redirect(new URL("/me?login=expired", request.url));
  }

  const result = await signInTelegramUser(telegramUserId);
  if (!result.ok) {
    console.error("bot login sign-in failed:", result.error);
    return NextResponse.redirect(new URL("/me?login=failed", request.url));
  }

  return NextResponse.redirect(new URL("/me", request.url));
}
