import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { reportSchema } from "@/lib/validation/reportSchema";
import { PROCEDURE_CODE } from "@/lib/matching/types";
import { notifyNewReport } from "@/lib/telegram/notifyModerator";
import { getDisplayName } from "@/lib/data/reports";
import { formatDate } from "@/lib/format";

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

  // After the report is safely stored, never before: this is a courtesy to
  // whoever moderates, and it awaits only so the serverless function is not
  // torn down mid-request. notifyNewReport swallows its own failures.
  await notifyNewReport({ reportId: data as string, ...(await describeReport(supabase, input)) });

  return NextResponse.json({ ok: true, reportId: data });
}

/** Turns the submitted report into something readable in a chat message. */
async function describeReport(
  supabase: Awaited<ReturnType<typeof createClient>>,
  input: { location_id: string; outcome: string; event_date: string }
) {
  const [{ data: location }, tOutcomes] = await Promise.all([
    supabase.from("locations").select("name").eq("id", input.location_id).maybeSingle(),
    getTranslations("outcomes"),
  ]);

  return {
    locationId: input.location_id,
    locationName: location?.name ?? input.location_id,
    outcome: tOutcomes(input.outcome as Parameters<typeof tOutcomes>[0]),
    eventDate: formatDate(input.event_date),
    author: await authorName(supabase),
  };
}

/** The display name the report will be signed with on the page. */
async function authorName(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? getDisplayName(supabase, user.id) : "";
}
