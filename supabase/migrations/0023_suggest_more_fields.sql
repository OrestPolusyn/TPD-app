-- Corrections to an office's official details could only target address,
-- postal code, phone or booking link. The first error a chat admin reported
-- was none of those — the booking *method* (phone, when Alicante only books
-- online) — so there was no way to report it from the page it was wrong on.
-- Adds the method, the e-mail, and a free-text "something else is wrong".
alter type suggestion_field_t add value if not exists 'appointment_method';
alter type suggestion_field_t add value if not exists 'email';
alter type suggestion_field_t add value if not exists 'other';

create or replace function location_suggestions_snapshot_current_value() returns trigger
  language plpgsql as $$
declare
  v_loc locations%rowtype;
begin
  select * into v_loc from locations where id = new.location_id;
  new.current_value := case new.field::text
    when 'address'            then v_loc.address
    when 'postal_code'        then v_loc.postal_code
    when 'phone'              then array_to_string(v_loc.phones, ';')
    when 'appointment_url'    then v_loc.appointment_url
    when 'appointment_method' then v_loc.appointment_method::text
    when 'email'              then v_loc.email
    else null   -- 'other': free text, nothing to snapshot
  end;
  return new;
end;
$$;
