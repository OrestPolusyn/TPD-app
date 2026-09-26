import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { countFeedItemsSince } from "@/lib/data/feedCount";

export const dynamic = "force-dynamic";

/** Nothing older than this counts as "new" — a bell reading 300 is noise. */
const MAX_LOOKBACK_DAYS = 90;

/**
 * Feeds the bell in the header: how many feed items (reports, rule changes,
 * updated offices) arrived since the visitor last looked at /feed. The
 * "last looked" time lives in the visitor's own browser.
 */
export async function GET(request: Request) {
  const since = new URL(request.url).searchParams.get("since");
  const parsed = since ? Date.parse(since) : NaN;
  if (!Number.isFinite(parsed)) {
    return NextResponse.json({ error: "bad_since" }, { status: 400 });
  }

  const floor = Date.now() - MAX_LOOKBACK_DAYS * 86_400_000;
  const from = new Date(Math.max(parsed, floor)).toISOString();

  try {
    return NextResponse.json({ count: await countFeedItemsSince(await createClient(), from) });
  } catch {
    // A bell that cannot count is not worth a 500 on the page it sits in.
    return NextResponse.json({ count: 0 });
  }
}
