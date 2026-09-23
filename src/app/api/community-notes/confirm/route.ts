import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { noteConfirmationSchema } from "@/lib/validation/commentSchema";

/**
 * Records (or withdraws) one person's verdict on a community note.
 *
 * Idempotent and reversible on purpose: pressing the button you already hold
 * removes your confirmation, pressing the other one moves it. All three paths
 * go through the caller's own client, so the
 * note_confirmations_{insert,update,delete}_own policies — not this route —
 * are what guarantee nobody votes as somebody else.
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

  const parsed = noteConfirmationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation", issues: parsed.error.issues }, { status: 400 });
  }
  const { note_id, stance } = parsed.data;

  const { data: existing, error: readError } = await supabase
    .from("community_note_confirmations")
    .select("stance")
    .eq("note_id", note_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (readError) {
    return NextResponse.json({ error: "unknown" }, { status: 500 });
  }

  if (existing?.stance === stance) {
    const { error } = await supabase
      .from("community_note_confirmations")
      .delete()
      .eq("note_id", note_id)
      .eq("user_id", user.id);
    if (error) return NextResponse.json({ error: "unknown" }, { status: 500 });
    return NextResponse.json({ ok: true, stance: null });
  }

  if (existing) {
    const { error } = await supabase
      .from("community_note_confirmations")
      .update({ stance })
      .eq("note_id", note_id)
      .eq("user_id", user.id);
    if (error) return NextResponse.json({ error: "unknown" }, { status: 500 });
    return NextResponse.json({ ok: true, stance });
  }

  const { error } = await supabase
    .from("community_note_confirmations")
    .insert({ note_id, user_id: user.id, stance });
  if (error) {
    // The note id is the only thing a caller controls that can legitimately
    // not exist; everything else here is server-side.
    if (error.code === "23503") return NextResponse.json({ error: "no_such_note" }, { status: 404 });
    return NextResponse.json({ error: "unknown" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, stance });
}
