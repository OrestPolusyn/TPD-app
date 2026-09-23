-- ---------------------------------------------------------------------------
-- Community notes: the practical digests, broken up and made checkable.
--
-- 0015/0016 put what the chats report about an office into two columns on
-- locations (practical_info, practical_info_updated_at). As a data model that
-- was wrong in the way that matters here: one opaque paragraph per office,
-- asserted by nobody, which a reader can neither agree nor disagree with. It
-- rendered as a wall of text in the middle of "Досвід спільноти" and carried
-- no more authority than a rumour.
--
-- One note is now one claim ("приймають довідку ДПСУ", "живої черги немає"),
-- dated, listed like a comment, and every signed-in person can mark it still
-- true or no longer true. That turns a static blob into something the
-- community maintains: a claim three people say is stale gets demoted
-- automatically (see community_note_confirmations_sync_status below), and a
-- claim ten people confirm visibly outranks one nobody has touched.
--
-- The paragraphs from 0016 are re-inserted here as individual claims, so
-- nothing is lost, and the two columns go away rather than living on as a
-- second, unverifiable source of truth.
-- ---------------------------------------------------------------------------

create type community_note_stance_t as enum ('still_true', 'changed');

create table community_notes (
  id                 uuid primary key default gen_random_uuid(),
  location_id        text not null references locations(id) on delete cascade,
  body               text not null check (char_length(body) <= 600 and length(trim(body)) > 0),
  -- When the claim was true, not when the row was written: a note imported
  -- from a September chat is September's news even if it lands in the DB later.
  observed_on        date not null,
  -- Where it came from, shown to the reader. 'community_chat' = summarised
  -- from a Telegram/Facebook group; 'moderator' = written by whoever runs the
  -- site. Free text rather than an enum so a new provenance does not need a
  -- migration; the UI falls back to the generic label for anything unknown.
  source             text not null default 'community_chat',
  -- Null for imported digests: there is no account behind them, and inventing
  -- one would put a name on something nobody here said.
  created_by         uuid references profiles(id),
  moderation_status  moderation_status_t not null default 'published',
  created_at         timestamptz not null default now()
);

create index idx_community_notes_location on community_notes (location_id)
  where moderation_status = 'published';
create index idx_community_notes_observed on community_notes (observed_on desc);

create table community_note_confirmations (
  note_id     uuid not null references community_notes(id) on delete cascade,
  user_id     uuid not null references profiles(id),
  stance      community_note_stance_t not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (note_id, user_id)
);

create index idx_note_confirmations_note on community_note_confirmations (note_id);

create or replace function community_note_confirmations_set_updated_at() returns trigger
  language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger trg_note_confirmations_updated_at before update on community_note_confirmations
  for each row execute function community_note_confirmations_set_updated_at();

-- SECURITY DEFINER for the same reason flags_promote_to_flagged is: this is a
-- system consequence of three people disagreeing, not a moderator action, so
-- it must not need the moderator-only UPDATE policy on community_notes.
--
-- Demotes to 'flagged' (which the UI still shows, but visibly demoted and
-- struck through) rather than deleting: "the office changed its practice" is
-- itself information, and a note that comes back into force can be restored.
create or replace function community_note_confirmations_sync_status() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  v_note_id uuid := coalesce(new.note_id, old.note_id);
  v_changed int;
  v_still   int;
begin
  select
    count(*) filter (where stance = 'changed'),
    count(*) filter (where stance = 'still_true')
  into v_changed, v_still
  from community_note_confirmations where note_id = v_note_id;

  if v_changed >= 3 and v_changed > v_still then
    update community_notes set moderation_status = 'flagged'
      where id = v_note_id and moderation_status = 'published';
  else
    update community_notes set moderation_status = 'published'
      where id = v_note_id and moderation_status = 'flagged';
  end if;
  return null;
end;
$$;
create trigger trg_note_confirmations_sync_status
  after insert or update or delete on community_note_confirmations
  for each row execute function community_note_confirmations_sync_status();

-- ---------- RLS ----------
alter table community_notes enable row level security;
alter table community_note_confirmations enable row level security;

create policy community_notes_public_read on community_notes for select
  using (moderation_status in ('published', 'flagged') or is_moderator());

create policy community_notes_moderator_write on community_notes for all to authenticated
  using (is_moderator())
  with check (is_moderator());

-- Counts are shown to everyone, signed in or not, so the rows have to be
-- publicly readable. They carry only (note, user, stance) — the same
-- "this person engaged with this office" fact that a published report already
-- states in full.
create policy note_confirmations_public_read on community_note_confirmations for select
  using (true);

create policy note_confirmations_insert_own on community_note_confirmations for insert to authenticated
  with check (user_id = auth.uid());

create policy note_confirmations_update_own on community_note_confirmations for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Pressing the same button twice takes the confirmation back.
create policy note_confirmations_delete_own on community_note_confirmations for delete to authenticated
  using (user_id = auth.uid());

-- ---------- grants ----------
-- Supabase's project-wide default privileges hand every new table broad DML
-- to anon/authenticated on creation, so each table below gets exactly what it
-- needs and nothing more (the same gap closed for app_settings in 0014 and
-- public_profiles in 0012).
revoke all on community_notes, community_note_confirmations from anon, authenticated;

grant select on community_notes to anon, authenticated;
grant select on community_note_confirmations to anon, authenticated;
grant insert, delete on community_note_confirmations to authenticated;
grant update (stance) on community_note_confirmations to authenticated;
