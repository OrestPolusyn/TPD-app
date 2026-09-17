import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { flagSchema } from "@/lib/validation/commentSchema";

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

  const parsed = flagSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation", issues: parsed.error.issues }, { status: 400 });
  }
  const input = parsed.data;

  const { error } = await supabase.from("flags").insert({
    target_type: input.target_type,
    target_id: input.target_id,
    user_id: user.id,
    reason: input.reason ?? null,
  });

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "already_flagged" }, { status: 409 });
    }
    return NextResponse.json({ error: "unknown" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
