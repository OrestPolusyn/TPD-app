-- Chat watch: twice a day the server reads the Telegram groups the owner
-- follows, keeps what is about temporary protection and sends it to the
-- admin bot as a digest (src/lib/chatwatch).
--
-- It reads as a Telegram user (GramJS), signed in once through the admin
-- bot (/tg_login). Its session and API keys live in app_settings
-- (tg_session, tg_api_id, tg_api_hash), service-role only like every row
-- there (0014): the session is a signed-in login to that account.

-- The groups (or single topics of a forum group) to read. peer_id and
-- access_hash are what Telegram needs to address a chat directly, stored
-- when the source is added so a run does not have to look chats up again.
-- last_message_id is how far a source has been read.
create table chatwatch_sources (
  id               bigint generated always as identity primary key,
  title            text not null,
  username         text,
  peer_type        text not null check (peer_type in ('channel', 'chat')),
  peer_id          bigint not null,
  access_hash      text,
  topic            integer,
  enabled          boolean not null default true,
  last_message_id  bigint,
  last_run_at      timestamptz,
  last_error       text,
  created_at       timestamptz not null default now(),
  unique nulls not distinct (peer_id, topic)
);

-- Messages already sent in a digest, by a hash of their text: the same city
-- summary gets forwarded to several chats and must arrive once.
create table chatwatch_seen (
  fingerprint  text primary key,
  seen_at      timestamptz not null default now()
);

alter table chatwatch_sources enable row level security;
alter table chatwatch_seen enable row level security;
revoke all on chatwatch_sources, chatwatch_seen from anon, authenticated;

-- The schedule: the database calls the site, the same way it already calls
-- it for new drafts (0031). 07:00 and 17:00 UTC = 9:00 and 19:00 in Madrid
-- in summer, 8:00 and 18:00 in winter.
create extension if not exists pg_cron;

create or replace function chatwatch_trigger_run()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url    text;
  v_secret text;
begin
  select value into v_url from app_settings where key = 'site_url';
  select value into v_secret from app_settings where key = 'dispatch_secret';
  if v_url is null or v_secret is null then
    return;
  end if;
  perform net.http_post(
    url     := rtrim(v_url, '/') || '/api/chatwatch/run',
    body    := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-dispatch-secret', v_secret),
    timeout_milliseconds := 60000
  );
end;
$$;

revoke all on function chatwatch_trigger_run() from public, anon, authenticated;

select cron.schedule('chatwatch-morning', '0 7 * * *', 'select public.chatwatch_trigger_run()');
select cron.schedule('chatwatch-evening', '0 17 * * *', 'select public.chatwatch_trigger_run()');
