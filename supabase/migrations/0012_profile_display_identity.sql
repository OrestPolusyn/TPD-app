-- Every report/comment author has rendered as the literal word "Користувач"
-- since launch — Telegram hands us first_name/username/photo_url on every
-- login, and nothing ever stored them. Captured now at sign-in time
-- (signInTelegramUser upserts these alongside telegram_user_id), with an
-- optional self-chosen nickname override.
alter table profiles
  add column telegram_first_name  text,
  add column telegram_username    text,
  add column avatar_url           text,
  add column display_name         text;

-- What a report/comment card actually renders: the nickname if the person
-- set one, else their Telegram first name, else a generic fallback — never
-- NULL, so every call site gets a display-ready string with no extra branching.
create or replace function profile_display_name(p profiles) returns text
  language sql immutable as $$
  select coalesce(nullif(trim(p.display_name), ''), nullif(trim(p.telegram_first_name), ''), 'Користувач');
$$;

-- ---------------------------------------------------------------------------
-- public_profiles: the *only* other-users'-row read path.
--
-- profiles_select_own (id = auth.uid(), from 0006_rls.sql) is deliberately
-- left untouched — telegram_user_id and role stay strictly owner-only, never
-- table-wide. A report/comment author's name and avatar are public wherever
-- the report/comment itself is (no login needed to browse /results or a
-- location page), so they need a path that isn't "every column of every
-- profile to any authenticated caller".
--
-- This view is exactly Supabase's own documented pattern for that: owned by
-- postgres (bypasses the base table's RLS for the view's own permission
-- check), exposing only the two safe columns. Callers still go through
-- profiles' RLS for anything else; this view is not a backdoor into the rest
-- of the table, because it only ever selects id/display_name/avatar_url.
-- ---------------------------------------------------------------------------
create view public_profiles as
  select id, profile_display_name(profiles) as display_name, avatar_url
  from profiles;

grant select on public_profiles to anon, authenticated;

-- Supabase's project-wide default privileges grant every new relation
-- (tables AND views alike) broad DML to anon/authenticated on creation — the
-- same gap already hit and closed for telegram_login_tokens and every RPC
-- added this session. profiles' own RLS would still block a write that got
-- this far (no insert/delete policy at all, update limited to display_name
-- on one's own row), but there is no reason to depend on that: revoke
-- everything this view does not need.
revoke insert, update, delete, truncate, references, trigger on public_profiles
  from anon, authenticated;

-- Lets a signed-in user set their own nickname. Trimmed/length-checked again
-- here at the DB, not just client-side: name = null/'' or whitespace-only
-- clears it back to the Telegram-first-name fallback.
create or replace function set_own_display_name(p_display_name text) returns void
  language plpgsql security invoker as $$
declare
  v_name text := nullif(trim(p_display_name), '');
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if v_name is not null and char_length(v_name) > 60 then
    raise exception 'display_name_too_long' using errcode = 'P0001';
  end if;

  update profiles set display_name = v_name where id = auth.uid();
end;
$$;

grant execute on function set_own_display_name(text) to authenticated;
revoke execute on function set_own_display_name(text) from public, anon;

-- set_own_display_name runs SECURITY INVOKER, so its UPDATE needs an actual
-- grant + RLS policy the way every other owner-write path in this schema does.
grant update (display_name) on profiles to authenticated;

create policy profiles_update_own_display_name on profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());
