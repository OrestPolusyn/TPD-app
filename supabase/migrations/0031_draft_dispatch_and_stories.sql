-- 1. Drafts reach the owner by themselves.
--
-- Drafts are bot_actions rows written straight into the database (prepared
-- from the community chats), so the app never sees them arrive and the owner
-- had to ask with /pending. Now an insert of a draft makes the database call
-- /api/telegram/drafts-dispatch through pg_net, which sends each draft to the
-- admin bot with its buttons. notified_at is the "already shown" mark the
-- route claims before sending, so nothing is sent twice.
--
-- 2. Channel posts remember what they were made from (action_id), so a
-- format change can redraw old posts in place (/refresh_posts).
--
-- 3. "💬 Моя історія": readers' stories, sent to the bot, published to the
-- channel anonymously once the owner approves.

create extension if not exists pg_net;

alter table bot_actions add column notified_at timestamptz;
-- Everything that exists was either sent live or listed by /pending.
update bot_actions set notified_at = coalesce(done_at, created_at);

alter table bot_actions drop constraint bot_actions_kind_check;
alter table bot_actions add constraint bot_actions_kind_check
  check (kind in ('publish_report', 'accept_change', 'publish_story'));

alter table channel_posts add column action_id bigint references bot_actions (id) on delete set null;
alter table channel_posts drop constraint channel_posts_kind_check;
alter table channel_posts add constraint channel_posts_kind_check
  check (kind in ('report', 'change', 'rule', 'guide', 'story'));

alter table bot_conversations drop constraint bot_conversations_kind_check;
alter table bot_conversations add constraint bot_conversations_kind_check
  check (kind in ('change', 'story'));

-- The route's address and the secret it checks. Service-role only, like
-- every app_settings row (0014).
insert into app_settings (key, value)
values
  ('site_url', 'https://tpd-app.vercel.app'),
  ('dispatch_secret', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''))
on conflict (key) do nothing;

create or replace function dispatch_new_drafts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url    text;
  v_secret text;
begin
  if not exists (
    select 1 from inserted
    where payload->>'source' = 'draft' and notified_at is null and done_at is null
  ) then
    return null;
  end if;

  select value into v_url from app_settings where key = 'site_url';
  select value into v_secret from app_settings where key = 'dispatch_secret';
  if v_url is null or v_secret is null then
    return null;
  end if;

  -- Asynchronous: the insert does not wait for the site, and a site that is
  -- down only means /pending is still there to fall back on.
  perform net.http_post(
    url     := rtrim(v_url, '/') || '/api/telegram/drafts-dispatch',
    body    := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-dispatch-secret', v_secret),
    timeout_milliseconds := 10000
  );
  return null;
end;
$$;

revoke all on function dispatch_new_drafts() from public, anon, authenticated;

create trigger trg_bot_actions_dispatch_drafts
  after insert on bot_actions
  referencing new table as inserted
  for each statement
  execute function dispatch_new_drafts();
