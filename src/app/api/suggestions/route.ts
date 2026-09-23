import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { suggestionSchema, type SuggestionInput } from "@/lib/validation/suggestionSchema";
import { getDisplayName } from "@/lib/data/reports";
import { notifyNewSuggestion } from "@/lib/telegram/notifyModerator";

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

  // current_value is filled by trg_location_suggestions_snapshot (0004), which
  // runs BEFORE INSERT and overwrites whatever a client sends — so it is read
  // back here rather than worked out a second time in TypeScript.
  const { data: inserted, error } = await supabase
    .from("location_suggestions")
    .insert({
      location_id: input.location_id,
      field: input.field,
      proposed_value: input.proposed_value,
      user_id: user.id,
      status: "pending",
    })
    .select("current_value")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "unknown" }, { status: 500 });
  }

  await notifyModerator(supabase, user.id, input, inserted?.current_value ?? null);

  return NextResponse.json({ ok: true });
}

/** Sends the proposal to the moderator chat; never fails the submission. */
async function notifyModerator(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  input: SuggestionInput,
  currentValue: string | null
) {
  const [{ data: location }, tSuggest, author] = await Promise.all([
    supabase.from("locations").select("name").eq("id", input.location_id).maybeSingle(),
    getTranslations("suggestForm"),
    getDisplayName(supabase, userId),
  ]);

  const fieldLabels: Record<SuggestionInput["field"], string> = {
    address: tSuggest("fieldAddress"),
    postal_code: tSuggest("fieldPostalCode"),
    phone: tSuggest("fieldPhone"),
    appointment_url: tSuggest("fieldAppointmentUrl"),
  };

  await notifyNewSuggestion({
    locationId: input.location_id,
    locationName: (location?.name as string) ?? input.location_id,
    field: fieldLabels[input.field],
    currentValue,
    proposedValue: input.proposed_value,
    author,
  });
}
