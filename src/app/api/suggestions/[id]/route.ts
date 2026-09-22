import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { suggestedValueSchema } from "@/lib/validation/suggestionSchema";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Edits the caller's own pending suggestion. RLS
 * (suggestions_update_own_pending) also requires status = 'pending' — once a
 * moderator has approved or rejected it, this 404s rather than silently
 * changing a decided record.
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  const { id } = await params;
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

  const parsed = suggestedValueSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation", issues: parsed.error.issues }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("location_suggestions")
    .update({ proposed_value: parsed.data.proposed_value })
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "unknown" }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

/** Deletes the caller's own pending suggestion. RLS scopes it the same way. */
export async function DELETE(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase.from("location_suggestions").delete().eq("id", id).select("id").maybeSingle();
  if (error) {
    return NextResponse.json({ error: "unknown" }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
