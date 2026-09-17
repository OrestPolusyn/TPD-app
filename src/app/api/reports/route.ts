import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { reportSchema } from "@/lib/validation/reportSchema";
import { PROCEDURE_CODE } from "@/lib/matching/types";

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

  const parsed = reportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation", issues: parsed.error.issues }, { status: 400 });
  }
  const input = parsed.data;

  const { data, error } = await supabase.rpc("submit_report", {
    p_location_id: input.location_id,
    p_procedure_code: PROCEDURE_CODE,
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
    if (error.code === "23505") {
      const { data: existing } = await supabase
        .from("reports")
        .select("id")
        .eq("location_id", input.location_id)
        .eq("procedure_code", PROCEDURE_CODE)
        .eq("event_date", input.event_date)
        .eq("user_id", user.id)
        .maybeSingle();
      return NextResponse.json(
        { error: "duplicate_report", existingReportId: existing?.id ?? null },
        { status: 409 }
      );
    }
    if (error.message.includes("daily_report_limit_reached")) {
      return NextResponse.json({ error: "daily_limit_reached" }, { status: 429 });
    }
    if (error.message.includes("other_document_requires_comment")) {
      return NextResponse.json({ error: "other_document_requires_comment" }, { status: 400 });
    }
    return NextResponse.json({ error: "unknown" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, reportId: data });
}
