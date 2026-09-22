import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { reportSchema } from "@/lib/validation/reportSchema";
import { PROCEDURE_CODE } from "@/lib/matching/types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Edits the caller's own report. Runs against update_own_report(), which
 * checks ownership itself (RLS + `where ... and user_id = auth.uid()`), so
 * this route doesn't need a separate ownership lookup before calling it.
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

  const parsed = reportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation", issues: parsed.error.issues }, { status: 400 });
  }
  const input = parsed.data;

  const { error } = await supabase.rpc("update_own_report", {
    p_report_id: id,
    p_event_date: input.event_date,
    p_outcome: input.outcome,
    p_requested_list_complete: input.requested_list_complete,
    p_documents: input.documents,
    p_appointment_type: input.appointment_type ?? null,
    p_earliest_appointment_offered: input.earliest_appointment_offered ?? null,
    p_time_at_office: input.time_at_office ?? null,
    p_people_count: input.people_count ?? null,
    p_military_obligations_apply: input.military_obligations_apply ?? null,
    p_comment: input.comment ?? null,
  });

  if (error) {
    if (error.message.includes("not_found_or_forbidden")) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    if (error.code === "23505") {
      const { data: existing } = await supabase
        .from("reports")
        .select("id")
        .eq("location_id", input.location_id)
        .eq("procedure_code", PROCEDURE_CODE)
        .eq("event_date", input.event_date)
        .eq("user_id", user.id)
        .neq("id", id)
        .maybeSingle();
      return NextResponse.json(
        { error: "duplicate_report", existingReportId: existing?.id ?? null },
        { status: 409 }
      );
    }
    if (error.message.includes("other_document_requires_comment")) {
      return NextResponse.json({ error: "other_document_requires_comment" }, { status: 400 });
    }
    if (error.message.includes("report_requires_at_least_one_document")) {
      return NextResponse.json({ error: "validation" }, { status: 400 });
    }
    return NextResponse.json({ error: "unknown" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

/**
 * Deletes the caller's own report. RLS (reports_delete_own) scopes the DELETE
 * to rows the caller owns; report_documents and comments cascade via their FKs.
 */
export async function DELETE(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase.from("reports").delete().eq("id", id).select("id").maybeSingle();
  if (error) {
    return NextResponse.json({ error: "unknown" }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
