import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getDispatchSecret } from "@/lib/telegram/settings";
import { runChatWatch } from "@/lib/chatwatch/run";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function sameSecret(given: string | null, expected: string): boolean {
  if (!given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * The scheduled chat watch: the database's pg_cron calls this twice a day
 * (migration 0032) with the shared dispatch secret. /watch_run in the admin
 * bot does the same thing on demand.
 */
export async function POST(request: NextRequest) {
  const secret = await getDispatchSecret();
  if (!secret || !sameSecret(request.headers.get("x-dispatch-secret"), secret)) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }
  try {
    return NextResponse.json({ ok: true, ...(await runChatWatch()) });
  } catch (err) {
    console.error("chat watch failed:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
