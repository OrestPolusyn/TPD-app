-- Extensions and shared config/helpers used by later migrations.

create extension if not exists pgcrypto;   -- gen_random_uuid()
create extension if not exists unaccent;   -- province_slug generation

-- Editable numeric/text config, read by triggers and the matching function.
-- Lets a moderator tune these from the Supabase dashboard without a redeploy.
create table app_config (
  key   text primary key,
  value text not null
);

insert into app_config (key, value) values
  ('stale_days', '90'),
  ('min_reports_for_badge', '2'),
  ('max_reports_per_user_per_day', '5'),
  ('allowed_official_email_domains', 'policia.es');

create or replace function app_config_int(p_key text) returns int
  language sql stable as $$
    select value::int from app_config where key = p_key;
$$;

create or replace function slugify(p_text text) returns text
  language sql immutable as $$
    select trim(both '-' from
      regexp_replace(lower(unaccent(p_text)), '[^a-z0-9]+', '-', 'g')
    );
$$;
