import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { briefConfirmationSchema } from "@/lib/validation/commentSchema";
import { getDisplayName } from "@/lib/data/reports";
import { notifyBriefChanged } from "@/lib/telegram/notifyModerator";

/**
 * Records (or withdraws) one person's verdict on an office's community brief.
 *
 * Pressing the stance you already hold removes it, pressing the other one
 * moves it. Moving to "changed" requires saying what changed — that text is
 * what the moderator acts on, so it is relayed to the moderator chat as well
 * as stored. Every write goes through the caller's own client, so the
 * brief_confirmations_*_own policies — not this route — are what guarantee
 * nobody votes as somebody else.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "malformed_request" }, { status: 400 });
  }

  const parsed = briefConfirmationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation", issues: parsed.error.issues }, { status: 400 });
  }
  const { location_id, stance } = parsed.data;
  const detail = parsed.data.detail || null;

  const table = () => supabase.from("location_brief_confirmations");

  const { data: existing, error: readError } = await table()
    .select("stance")
    .eq("location_id", location_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (readError) return NextResponse.json({ error: "unknown" }, { status: 500 });

  if (existing?.stance === stance) {
    const { error } = await table().delete().eq("location_id", location_id).eq("user_id", user.id);
    if (error) return NextResponse.json({ error: "unknown" }, { status: 500 });
    return NextResponse.json({ ok: true, stance: null });
  }

  if (stance === "changed" && !detail) {
    return NextResponse.json({ error: "detail_required" }, { status: 400 });
  }
  // A "still true" carries no description; clearing it keeps an old
  // "changed" explanation from lingering on a row that no longer says so.
  const row = { stance, detail: stance === "changed" ? detail : null };

  const { error } = existing
    ? await table().update(row).eq("location_id", location_id).eq("user_id", user.id)
    : await table().insert({ location_id, user_id: user.id, ...row });
  if (error) {
    if (error.code === "23503") return NextResponse.json({ error: "no_such_location" }, { status: 404 });
    return NextResponse.json({ error: "unknown" }, { status: 500 });
  }

  if (stance === "changed" && detail) {
    const [{ data: location }, author] = await Promise.all([
      supabase.from("locations").select("name").eq("id", location_id).maybeSingle(),
      getDisplayName(supabase, user.id),
    ]);
    await notifyBriefChanged({
      locationId: location_id,
      locationName: (location?.name as string) ?? location_id,
      detail,
      author,
    });
  }

  return NextResponse.json({ ok: true, stance });
}
