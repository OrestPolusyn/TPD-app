import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getDispatchSecret } from "@/lib/telegram/settings";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordChannelMembers } from "@/lib/channelStats";
import { madridDate } from "@/lib/stats";

export const dynamic = "force-dynamic";

function sameSecret(given: string | null, expected: string): boolean {
  if (!given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Records how many people follow the updates channel today. Called by the
 * database's schedule next to the chat watch (migration 0036), with the
 * shared dispatch secret; the owner's /stats records it too.
 */
export async function POST(request: NextRequest) {
  const secret = await getDispatchSecret();
  if (!secret || !sameSecret(request.headers.get("x-dispatch-secret"), secret)) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }
  const members = await recordChannelMembers(createAdminClient(), madridDate(new Date()));
  return NextResponse.json({ ok: members !== null, members });
}
