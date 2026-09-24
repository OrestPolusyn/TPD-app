import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { briefConfirmationSchema } from "@/lib/validation/commentSchema";

/**
 * Records (or withdraws) one person's verdict on an office's community brief.
 *
 * Pressing the stance you already hold removes it, pressing the other one
 * moves it. Every write goes through the caller's own client, so the
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

  if (existing) {
    const { error } = await table().update({ stance }).eq("location_id", location_id).eq("user_id", user.id);
    if (error) return NextResponse.json({ error: "unknown" }, { status: 500 });
    return NextResponse.json({ ok: true, stance });
  }

  const { error } = await table().insert({ location_id, user_id: user.id, stance });
  if (error) {
    if (error.code === "23503") return NextResponse.json({ error: "no_such_location" }, { status: 404 });
    return NextResponse.json({ error: "unknown" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, stance });
}
