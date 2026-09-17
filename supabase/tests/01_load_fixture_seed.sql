-- Loads seed/locations.csv the same way scripts/seed.ts does (via a staging
-- table + transform), for local verification without the Supabase JS client /
-- PostgREST. Test-only; not part of the real migration set.
create temporary table locations_staging (
  id text, name text, type text, region text, province text, city text,
  address text, postal_code text, phone text, email text,
  appointment_method text, appointment_url text, source_url text,
  official_list_url text, source_date text, verified_at text,
  verification_status text, notes text
);

\copy locations_staging from 'seed/locations.csv' with (format csv, header true)

insert into locations (
  id, name, type, region, province, city, address, postal_code, phones, email,
  appointment_method, appointment_url, source_url, official_list_url, source_date,
  verified_at, verification_status, notes, moderation_status
)
select
  s.id, s.name, s.type::location_type_t, s.region, s.province, s.city,
  nullif(s.address, ''), nullif(s.postal_code, ''),
  case when s.phone is null or s.phone = '' then '{}'::text[] else string_to_array(s.phone, ';') end,
  nullif(s.email, ''),
  s.appointment_method::appointment_method_t, nullif(s.appointment_url, ''),
  s.source_url, nullif(s.official_list_url, ''), nullif(s.source_date, ''),
  s.verified_at::date, s.verification_status::verification_status_t, nullif(s.notes, ''),
  case s.verification_status when 'conflict' then 'pending'::moderation_status_t
                              else 'published'::moderation_status_t end
from locations_staging s
on conflict (id) do nothing;

insert into location_procedures (location_id, procedure_code)
select id, 'temporary_protection_application' from locations
on conflict do nothing;
