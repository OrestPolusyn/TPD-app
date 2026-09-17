create table locations (
  id                  text primary key,          -- from seed CSV `id`, or slugify(name)+suffix for user-submitted rows
  name                text not null,
  type                location_type_t not null,
  region              text not null,
  province            text not null,
  province_slug       text not null,
  city                text not null,
  address             text,                       -- null = "адреса не вказана в офіційному списку"
  postal_code         text,
  phones              text[] not null default '{}',
  email               text,
  email_hidden        boolean not null default false,
  appointment_method  appointment_method_t not null,
  appointment_url     text,
  source_url          text not null,
  official_list_url   text,
  source_date         text,                       -- TEXT: source values are heterogeneous ("2026" vs "2022-03-30")
  verified_at         date not null default current_date,
  verification_status verification_status_t not null,
  notes               text,
  moderation_status   moderation_status_t not null default 'pending',
  created_by          uuid references profiles(id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index idx_locations_province_slug on locations (province_slug) where moderation_status = 'published';
create index idx_locations_moderation on locations (moderation_status);

create or replace function locations_before_write() returns trigger
  language plpgsql as $$
declare
  v_domains       text[];
  v_email_domain  text;
  v_domain        text;
  v_ok            boolean := false;
begin
  new.province_slug := slugify(new.province);
  new.updated_at := now();

  if new.email is null or new.email = '' then
    new.email_hidden := false;
  elsif new.email !~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' then
    new.email_hidden := true;
  else
    select string_to_array(value, ',') into v_domains
    from app_config where key = 'allowed_official_email_domains';

    v_email_domain := lower(split_part(new.email, '@', 2));
    foreach v_domain in array coalesce(v_domains, '{}') loop
      if v_email_domain = trim(lower(v_domain)) then
        v_ok := true;
      end if;
    end loop;
    new.email_hidden := not v_ok;
  end if;

  return new;
end;
$$;

create trigger trg_locations_before_write
  before insert or update of email, province on locations
  for each row execute function locations_before_write();

create table location_procedures (
  location_id     text not null references locations(id) on delete cascade,
  procedure_code  text not null references procedures(code),
  primary key (location_id, procedure_code)
);

create table policy_changes (
  id              uuid primary key default gen_random_uuid(),
  procedure_code  text not null references procedures(code),
  effective_date  date not null,
  title_uk        text not null,
  source_url      text not null,
  created_at      timestamptz not null default now()
);

create table location_suggestions (
  id              uuid primary key default gen_random_uuid(),
  location_id     text not null references locations(id) on delete cascade,
  field           suggestion_field_t not null,
  current_value   text,          -- always overwritten server-side, see trigger below
  proposed_value  text not null,
  user_id         uuid not null references profiles(id),
  status          suggestion_status_t not null default 'pending',
  created_at      timestamptz not null default now(),
  reviewed_at     timestamptz
);

create or replace function location_suggestions_snapshot_current_value() returns trigger
  language plpgsql as $$
declare
  v_loc locations%rowtype;
begin
  select * into v_loc from locations where id = new.location_id;
  new.current_value := case new.field
    when 'address'          then v_loc.address
    when 'postal_code'      then v_loc.postal_code
    when 'phone'            then array_to_string(v_loc.phones, ';')
    when 'appointment_url'  then v_loc.appointment_url
  end;
  return new;
end;
$$;

create trigger trg_location_suggestions_snapshot
  before insert on location_suggestions
  for each row execute function location_suggestions_snapshot_current_value();

-- Read-only helper for the "possible duplicate location" UX warning on /locations/new.
-- Deliberately SECURITY DEFINER: it needs to see pending rows too (to avoid duplicate
-- pending submissions), which anon/authenticated RLS would otherwise hide.
create or replace function check_duplicate_location(
  p_province_slug text,
  p_name          text,
  p_address       text
) returns table (id text, name text, address text, moderation_status moderation_status_t)
  language sql stable security definer set search_path = public as $$
  select l.id, l.name, l.address, l.moderation_status
  from locations l
  where l.province_slug = p_province_slug
    and (
      (p_address is not null and p_address <> '' and slugify(l.address) = slugify(p_address))
      or slugify(l.name) = slugify(p_name)
    )
  limit 5;
$$;

grant execute on function check_duplicate_location(text, text, text) to anon, authenticated;
