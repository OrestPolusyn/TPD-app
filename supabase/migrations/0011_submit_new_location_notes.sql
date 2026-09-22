-- /locations/new is now a single free-text field ("propose a change or
-- addition") rather than a structured form asking for name/type/region/
-- province/city up front. Everything the user wrote goes into `notes` for a
-- moderator to read and turn into real, structured fields before publishing;
-- submit_new_location() didn't have anywhere to put it.
--
-- CREATE OR REPLACE does NOT collapse onto the old function here: Postgres
-- resolves "which function to replace" by matching the parameter TYPE LIST,
-- and adding a parameter changes that list, so this creates a second,
-- separate overload (11-arg and 12-arg both live) rather than truly replacing
-- it — confirmed against the live database, where both existed side by side,
-- the old one still PUBLIC-executable, until explicitly dropped. Drop the old
-- signature first so exactly one `submit_new_location` exists.
drop function if exists submit_new_location(
  text, text, location_type_t, text, text, text, appointment_method_t, text, text, text, text
);

create function submit_new_location(
  p_id                  text,
  p_name                text,
  p_type                location_type_t,
  p_region              text,
  p_province            text,
  p_city                text,
  p_appointment_method  appointment_method_t,
  p_address             text default null,
  p_postal_code         text default null,
  p_phone               text default null,
  p_appointment_url     text default null,
  p_notes               text default null
) returns text
  language plpgsql as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  insert into locations (
    id, name, type, region, province, city, address, postal_code, phones,
    appointment_method, appointment_url, source_url, verification_status,
    moderation_status, created_by, notes
  ) values (
    p_id, p_name, p_type, p_region, p_province, p_city, p_address, p_postal_code,
    case when p_phone is null or p_phone = '' then '{}'::text[] else string_to_array(p_phone, ';') end,
    p_appointment_method, p_appointment_url,
    'user-submitted, not yet verified against an official source',
    'user_submitted',
    'pending', auth.uid(), p_notes
  );

  insert into location_procedures (location_id, procedure_code)
  values (p_id, 'temporary_protection_application');

  return p_id;
end;
$$;

grant execute on function submit_new_location(
  text, text, location_type_t, text, text, text, appointment_method_t, text, text, text, text, text
) to authenticated;

revoke execute on function submit_new_location(
  text, text, location_type_t, text, text, text, appointment_method_t, text, text, text, text, text
) from public, anon;
