-- "✅ Актуально" taps in the channel count towards the office card's "Так"
-- on the site. The votes table is service-role only (it holds Telegram
-- account ids); this exposes just the number of distinct people per office.
create or replace function channel_confirmations(p_location_id text) returns int
  language sql stable security definer set search_path = public as $$
  select count(distinct v.tg_user_id)::int
  from channel_post_votes v
  join channel_posts p on p.id = v.post_id
  where p.location_id = p_location_id;
$$;

revoke execute on function channel_confirmations(text) from public;
grant execute on function channel_confirmations(text) to anon, authenticated;
