import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { newLocationSchema } from "@/lib/validation/newLocationSchema";
import { slugify } from "@/lib/slugify";

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
  const id = `${slugify(input.name)}-${randomBytes(4).toString("hex")}`;

  const { data, error } = await supabase.rpc("submit_new_location", {
    p_id: id,
    p_name: input.name,
    p_type: input.type,
    p_region: input.region,
    p_province: input.province,
    p_city: input.city,
    p_appointment_method: input.appointment_method,
    p_address: input.address ?? null,
    p_postal_code: input.postal_code ?? null,
    p_phone: input.phone ?? null,
    p_appointment_url: input.appointment_url ?? null,
  });

  if (error) {
    return NextResponse.json({ error: "unknown" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, locationId: data });
}
