import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/me/delete — "Видалити акаунт".
 *
 * Deletes flags, comments, reports (report_documents cascade via FK) and
 * location_suggestions for this user, then the auth.users row itself, which
 * cascades to profiles. Runs on the service-role client: no RLS policy grants
 * authenticated users DELETE on any of these tables (see 0006_rls.sql) — this
 * is deliberately the one place account data removal happens, server-side,
 * and only for the currently authenticated caller's own id.
 *
 * `locations.created_by` uses ON DELETE SET NULL (not part of this deletion
 * list — spec only names profile/reports/comments/flags/suggestions),
 * so a location this user submitted stays public, just unattributed.
 */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const userId = user.id;

  const steps = [
    admin.from("flags").delete().eq("user_id", userId),
    admin.from("comments").delete().eq("user_id", userId),
    admin.from("reports").delete().eq("user_id", userId),
    admin.from("location_suggestions").delete().eq("user_id", userId),
  ];
  for (const step of steps) {
    const { error } = await step;
    if (error) {
      return NextResponse.json({ error: "unknown" }, { status: 500 });
    }
  }

  const { error: deleteUserError } = await admin.auth.admin.deleteUser(userId);
  if (deleteUserError) {
    return NextResponse.json({ error: "unknown" }, { status: 500 });
  }

  await supabase.auth.signOut();

  return NextResponse.json({ ok: true });
}
