import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import { signInTelegramUser } from "@/lib/telegram/authBridge";

// Negative IDs: real Telegram user ids are always positive, so these can
// never collide with a real account.
const DEV_TELEGRAM_IDS: Record<string, number> = {
  "1": -1,
  "2": -2,
};

/**
 * GET /api/auth/dev?user=1|2 — signs in as a fixed dev user without needing a
 * real Telegram bot, for local testing. Only enabled when
 * NODE_ENV !== "production" AND DEV_LOGIN_ENABLED=true; otherwise 404 (never
 * a 403 — a 403 would confirm to a prober that the route exists at all).
 */
export async function GET(request: Request) {
  if (!config.devLoginEnabled()) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const url = new URL(request.url);
  const user = url.searchParams.get("user");
  const telegramId = user ? DEV_TELEGRAM_IDS[user] : undefined;
  if (telegramId === undefined) {
    return NextResponse.json({ error: "unknown_dev_user" }, { status: 400 });
  }

  const result = await signInTelegramUser(telegramId);
  if (!result.ok) {
    return NextResponse.json({ error: "sign_in_failed" }, { status: 500 });
  }

  return NextResponse.redirect(new URL("/me", request.url));
}
