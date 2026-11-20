import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getDispatchSecret } from "@/lib/telegram/settings";
import { publishNavPost } from "@/lib/telegram/navPost";

export const dynamic = "force-dynamic";

function sameSecret(given: string | null, expected: string): boolean {
  if (!given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Publishes (and pins) the channel's navigation post, or updates it in
 * place. Called with the shared dispatch secret, like the chat watch; the
 * owner's /post_nav in the admin bot does the same.
 */
export async function POST(request: NextRequest) {
  const secret = await getDispatchSecret();
  if (!secret || !sameSecret(request.headers.get("x-dispatch-secret"), secret)) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }
  return NextResponse.json(await publishNavPost());
}
