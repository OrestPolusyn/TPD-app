import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { displayNameSchema } from "@/lib/validation/displayNameSchema";

/** Sets the caller's own nickname via the set_own_display_name RPC (SECURITY
 * INVOKER — RLS's profiles_update_own_display_name scopes it to auth.uid()). */
export async function PATCH(request: Request) {
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

  const parsed = displayNameSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation", issues: parsed.error.issues }, { status: 400 });
  }

  const { error } = await supabase.rpc("set_own_display_name", {
    p_display_name: parsed.data.display_name,
  });

  if (error) {
    if (error.message.includes("display_name_too_long")) {
      return NextResponse.json({ error: "validation" }, { status: 400 });
    }
    return NextResponse.json({ error: "unknown" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
