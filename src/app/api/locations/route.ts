import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { newLocationSchema } from "@/lib/validation/newLocationSchema";
import { getDisplayName } from "@/lib/data/reports";
import { notifyNewLocation } from "@/lib/telegram/notifyModerator";

/**
 * The user provides free text only; every structured field goes to a
 * placeholder here and gets corrected by a moderator (Supabase dashboard —
 * this repo has no admin UI, see README) before the location is published.
 * "police_station" as the type default because most submissions historically
 * are: 66 of the 70 seeded locations.
 */
const PLACEHOLDER_NAME = "Пропозиція від користувача (очікує на перевірку)";
const PLACEHOLDER_TYPE = "police_station";
const PLACEHOLDER_REGION = "";
const PLACEHOLDER_PROVINCE = "";
const PLACEHOLDER_CITY = "";
const PLACEHOLDER_APPOINTMENT_METHOD = "phone";

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

  const parsed = newLocationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation", issues: parsed.error.issues }, { status: 400 });
  }
  const input = parsed.data;
  const id = `suggestion-${randomBytes(6).toString("hex")}`;

  const { data, error } = await supabase.rpc("submit_new_location", {
    p_id: id,
    p_name: PLACEHOLDER_NAME,
    p_type: PLACEHOLDER_TYPE,
    p_region: PLACEHOLDER_REGION,
    p_province: PLACEHOLDER_PROVINCE,
    p_city: PLACEHOLDER_CITY,
    p_appointment_method: PLACEHOLDER_APPOINTMENT_METHOD,
    p_notes: input.description,
  });

  if (error) {
    return NextResponse.json({ error: "unknown" }, { status: 500 });
  }

  // A submitted location is invisible until a moderator fills in the real
  // fields, so without this it waits in a table nobody was told to open.
  await notifyNewLocation({
    locationId: id,
    description: input.description,
    author: await getDisplayName(supabase, user.id),
  });

  return NextResponse.json({ ok: true, locationId: data });
}
