import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { suggestionSchema } from "@/lib/validation/suggestionSchema";

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

  const parsed = suggestionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation", issues: parsed.error.issues }, { status: 400 });
  }
  const input = parsed.data;

  const { error } = await supabase.from("location_suggestions").insert({
    location_id: input.location_id,
    field: input.field,
    proposed_value: input.proposed_value,
    user_id: user.id,
    status: "pending",
  });

  if (error) {
    return NextResponse.json({ error: "unknown" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
