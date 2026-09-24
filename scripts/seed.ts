/**
 * Idempotent seed script.
 *
 * Imports seed/locations.csv into `locations` (+ `location_procedures` linking
 * every location to the one active MVP procedure), and upserts `procedures` /
 * `document_types` (kept in sync with supabase/migrations/0003_profiles_and_lookups.sql).
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/seed.ts
 *
 * Rows the CSV no longer lists are hidden, not deleted, so an official list that
 * drops a locality stops showing it without cascading away community reports.
 *
 * Idempotency: re-running against an unchanged DB produces the same end state
 * (upsert by primary key). Caveat: this recomputes `moderation_status` from the
 * CSV's `verification_status` on every run, so re-running after a moderator has
 * manually changed a seeded location's moderation_status would overwrite that
 * decision. Intended for initial setup / CI / local dev, not for repeated runs
 * against a moderated production DB — see README.md.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "csv-parse/sync";
import { createClient } from "@supabase/supabase-js";

interface LocationRow {
  id: string;
  name: string;
  type: string;
  region: string;
  province: string;
  city: string;
  address: string;
  postal_code: string;
  phone: string;
  email: string;
  appointment_method: string;
  appointment_url: string;
  source_url: string;
  official_list_url: string;
  source_date: string;
  verified_at: string;
  verification_status: string;
  notes: string;
}

const PROCEDURE_CODE = "temporary_protection_application";

const PROCEDURES = [
  {
    code: PROCEDURE_CODE,
    label_uk: "Заява на тимчасовий захист",
    label_es: "Solicitud de protección temporal",
    is_active: true,
  },
];

const DOCUMENT_TYPES = [
  { code: "international_passport", label_uk: "Закордонний паспорт", label_es: "Pasaporte internacional", sort_order: 1 },
  { code: "internal_passport_or_id_card", label_uk: "Внутрішній паспорт / ID-картка", label_es: "Documento de identidad interno", sort_order: 2 },
  { code: "birth_certificate", label_uk: "Свідоцтво про народження", label_es: "Certificado de nacimiento", sort_order: 3 },
  { code: "proof_of_residence_in_ukraine", label_uk: "Підтвердження проживання в Україні", label_es: "Prueba de residencia en Ucrania", sort_order: 4 },
  { code: "ukraine_residence_permit_third_country", label_uk: "Дозвіл на проживання в Україні (для громадян третіх країн)", label_es: "Permiso de residencia en Ucrania (terceros países)", sort_order: 5 },
  { code: "passport_exit_stamp", label_uk: "Штамп про перетин кордону", label_es: "Sello de salida en el pasaporte", sort_order: 6 },
  { code: "border_crossing_certificate", label_uk: "Довідка ДПСУ про перетин кордону", label_es: "Certificado de cruce de frontera (DPSU)", sort_order: 7 },
  { code: "military_document_paper", label_uk: "Військовий квиток (паперовий)", label_es: "Cartilla militar (papel)", sort_order: 8 },
  { code: "military_document_reserve_plus", label_uk: "Військово-обліковий документ (Резерв+)", label_es: "Documento militar (Reserv+)", sort_order: 9 },
  { code: "marriage_certificate", label_uk: "Свідоцтво про шлюб", label_es: "Certificado de matrimonio", sort_order: 10 },
  { code: "child_birth_certificate", label_uk: "Свідоцтво про народження дитини", label_es: "Certificado de nacimiento del hijo/a", sort_order: 11 },
  { code: "spanish_address_or_empadronamiento", label_uk: "Іспанська адреса / empadronamiento", label_es: "Empadronamiento / domicilio en España", sort_order: 12 },
  { code: "passport_photos", label_uk: "Фотографії паспортного зразка", label_es: "Fotografías tipo carné", sort_order: 13 },
  { code: "other", label_uk: "Інше", label_es: "Otro", sort_order: 14 },
].map((d) => ({ ...d, is_active: true }));

function nullIfEmpty(value: string): string | null {
  return value === "" ? null : value;
}

function toModerationStatus(verificationStatus: string): "published" | "pending" {
  return verificationStatus === "conflict" ? "pending" : "published";
}

async function main() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error("Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) / SUPABASE_SERVICE_ROLE_KEY env vars.");
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const csvPath = resolve(process.cwd(), "seed/locations.csv");
  const csvContent = readFileSync(csvPath, "utf8");
  const rows: LocationRow[] = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
  });

  console.log(`Parsed ${rows.length} rows from seed/locations.csv`);

  console.log("Upserting procedures...");
  const { error: procError } = await supabase.from("procedures").upsert(PROCEDURES, { onConflict: "code" });
  if (procError) throw procError;

  console.log("Upserting document_types...");
  const { error: docTypeError } = await supabase.from("document_types").upsert(DOCUMENT_TYPES, { onConflict: "code" });
  if (docTypeError) throw docTypeError;

  console.log("Upserting locations...");
  const locationPayload = rows.map((row) => ({
    id: row.id,
    name: row.name,
    type: row.type,
    region: row.region,
    province: row.province,
    city: row.city,
    address: nullIfEmpty(row.address),
    postal_code: nullIfEmpty(row.postal_code),
    phones: row.phone === "" ? [] : row.phone.split(";"),
    email: nullIfEmpty(row.email),
    appointment_method: row.appointment_method,
    appointment_url: nullIfEmpty(row.appointment_url),
    source_url: row.source_url,
    official_list_url: nullIfEmpty(row.official_list_url),
    source_date: nullIfEmpty(row.source_date),
    verified_at: row.verified_at,
    verification_status: row.verification_status,
    notes: nullIfEmpty(row.notes),
    moderation_status: toModerationStatus(row.verification_status),
  }));

  const { error: locError } = await supabase.from("locations").upsert(locationPayload, { onConflict: "id" });
  if (locError) throw locError;

  console.log("Linking every location to the active procedure...");
  const linkPayload = rows.map((row) => ({ location_id: row.id, procedure_code: PROCEDURE_CODE }));
  const { error: linkError } = await supabase
    .from("location_procedures")
    .upsert(linkPayload, { onConflict: "location_id,procedure_code" });
  if (linkError) throw linkError;

  // Retire seeded rows the official list no longer carries. Upsert alone would
  // leave them published with stale data — e.g. the 2022 Interior XLSX listed
  // six Murcia-region comisarías that the current MISSM list replaced with one.
  // Hidden rather than deleted: `reports` references location_procedures, so a
  // delete would cascade away real community reports, and `hidden` is already
  // excluded from every app query.
  console.log("Retiring seeded locations absent from the CSV...");
  const seededIds = rows.map((row) => row.id);
  const { data: retired, error: retireError } = await supabase
    .from("locations")
    .update({ moderation_status: "hidden" })
    .neq("verification_status", "user_submitted")
    .not("moderation_status", "eq", "hidden")
    .not("id", "in", `(${seededIds.join(",")})`)
    .select("id");
  if (retireError) throw retireError;
  if (retired && retired.length > 0) {
    console.log(`  hid ${retired.length}: ${retired.map((r) => r.id).join(", ")}`);
  }

  const published = locationPayload.filter((l) => l.moderation_status === "published").length;
  const pending = locationPayload.filter((l) => l.moderation_status === "pending").length;
  const provinces = new Set(locationPayload.map((l) => l.province)).size;
  console.log(
    `Done. ${locationPayload.length} locations (${published} published, ${pending} pending), ${provinces} distinct provinces.`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
