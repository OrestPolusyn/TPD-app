import { NextResponse } from "next/server";
import { validateInitData } from "@/lib/telegram/validateInitData";
import { validateLoginWidget, type LoginWidgetPayload } from "@/lib/telegram/validateLoginWidget";
import { signInTelegramUser } from "@/lib/telegram/authBridge";

interface RequestBody {
  initData?: string;
  loginWidget?: LoginWidgetPayload;
}

/**
 * POST /api/auth/telegram
 * Body: { initData: string } (Mini App) XOR { loginWidget: {...} } (web Login Widget).
 * On success: 200, Supabase session cookies set on the response.
 * On a bad/tampered/expired payload: 401, no cookies set.
 */
export async function POST(request: Request) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  }

  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "malformed_request" }, { status: 400 });
  }

  const validation = body.initData
    ? validateInitData(body.initData, botToken)
    : body.loginWidget
      ? validateLoginWidget(body.loginWidget, botToken)
      : null;

  if (!validation) {
    return NextResponse.json({ error: "malformed_request" }, { status: 400 });
  }
  if (!validation.ok) {
    return NextResponse.json({ error: validation.reason }, { status: 401 });
  }

  const result = await signInTelegramUser(validation.identity.telegramUserId, {
    firstName: validation.identity.firstName,
    username: validation.identity.username,
    photoUrl: validation.identity.photoUrl,
  });
  if (!result.ok) {
    return NextResponse.json({ error: "sign_in_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
