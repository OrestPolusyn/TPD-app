-- Channel statistics for the owner, and the chat watch moved to 12:00 and
-- 22:00 Madrid time.

-- How many people follow the updates channel, one row per Madrid day (the
-- last reading of the day wins). The Bot API only says "how many now", so
-- the growth chart is built from these readings.
create table channel_member_counts (
  day          date primary key,
  members      integer not null check (members >= 0),
  recorded_at  timestamptz not null default now()
);

alter table channel_member_counts enable row level security;
revoke all on channel_member_counts from anon, authenticated;

-- Views and forwards of each channel post, read twice a day through the
-- server's Telegram login (the Bot API does not expose them).
alter table channel_posts
  add column views     integer,
  add column forwards  integer,
  add column views_at  timestamptz;

-- pg_cron runs in UTC and Madrid switches between UTC+2 and UTC+1, so the
-- job fires at both candidate hours and only the one that is 12:00 or 22:00
-- in Madrid goes through. Each run also records the channel's size.
create or replace function chatwatch_scheduled_run()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url    text;
  v_secret text;
begin
  if extract(hour from now() at time zone 'Europe/Madrid') not in (12, 22) then
    return;
  end if;
  perform chatwatch_trigger_run();

  select value into v_url from app_settings where key = 'site_url';
  select value into v_secret from app_settings where key = 'dispatch_secret';
  if v_url is null or v_secret is null then
    return;
  end if;
  perform net.http_post(
    url     := rtrim(v_url, '/') || '/api/stats/snapshot',
    body    := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-dispatch-secret', v_secret),
    timeout_milliseconds := 30000
  );
end;
$$;

revoke all on function chatwatch_scheduled_run() from public, anon, authenticated;

select cron.unschedule('chatwatch-morning');
select cron.unschedule('chatwatch-evening');
select cron.schedule('chatwatch-madrid', '0 10,11,20,21 * * *', 'select public.chatwatch_scheduled_run()');
