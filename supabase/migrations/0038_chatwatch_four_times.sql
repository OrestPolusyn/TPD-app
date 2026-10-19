-- The chat watch reads the groups four times a day: 07:00, 12:00, 17:00 and
-- 22:00 Madrid time. The channel statistics snapshot stays at 12:00 and
-- 22:00. As in 0036, pg_cron runs in UTC and Madrid switches between UTC+2
-- and UTC+1, so the job fires at both candidate hours and only the one that
-- is a watch hour in Madrid goes through.
create or replace function chatwatch_scheduled_run()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hour   int := extract(hour from now() at time zone 'Europe/Madrid');
  v_url    text;
  v_secret text;
begin
  if v_hour not in (7, 12, 17, 22) then
    return;
  end if;
  perform chatwatch_trigger_run();

  if v_hour not in (12, 22) then
    return;
  end if;
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

select cron.unschedule('chatwatch-madrid');
select cron.schedule('chatwatch-madrid', '0 5,6,10,11,15,16,20,21 * * *', 'select public.chatwatch_scheduled_run()');
