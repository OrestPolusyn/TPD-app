-- Inserting a user-submitted location needs two tables (locations +
-- location_procedures) in one transaction, same reasoning as submit_report()
-- in 0005_reports.sql: a plain PostgREST .insert() call is its own
-- transaction, so two separate REST calls could leave a location with no
-- linked procedure if the second call failed.
--
-- SECURITY INVOKER (default): runs with the caller's RLS, so
-- locations_insert_own_pending (created_by = auth.uid(), moderation_status =
-- 'pending') still gates this exactly as it would a direct insert.
create or replace function submit_new_location(
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
  p_appointment_url     text default null
) returns text
  language plpgsql as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  insert into locations (
    id, name, type, region, province, city, address, postal_code, phones,
    appointment_method, appointment_url, source_url, verification_status,
    moderation_status, created_by
  ) values (
    p_id, p_name, p_type, p_region, p_province, p_city, p_address, p_postal_code,
    case when p_phone is null or p_phone = '' then '{}'::text[] else string_to_array(p_phone, ';') end,
    p_appointment_method, p_appointment_url,
    'user-submitted, not yet verified against an official source',
    'user_submitted',
    'pending', auth.uid()
  );

  insert into location_procedures (location_id, procedure_code)
  values (p_id, 'temporary_protection_application');

  return p_id;
end;
$$;

grant execute on function submit_new_location(
  text, text, location_type_t, text, text, text, appointment_method_t, text, text, text, text
) to authenticated;

-- 0006_rls.sql only granted SELECT on location_procedures (it's normally a
-- moderator/seed-only table). submit_new_location() runs SECURITY INVOKER, so
-- its insert needs both a table grant and an RLS policy for `authenticated`,
-- scoped to rows for a location the same user just created.
grant insert on location_procedures to authenticated;

create policy location_procedures_insert_own_location on location_procedures for insert to authenticated
  with check (exists (
    select 1 from locations l where l.id = location_procedures.location_id and l.created_by = auth.uid()
  ));
