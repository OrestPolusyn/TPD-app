-- Unconfirmed chat comments leave the site 14 days after they were added
-- (owner, 20.11): the rules change weekly, and a lone report nobody
-- confirmed in two weeks is more likely stale than true. Fourteen days is
-- also how long the chat watch waits for a second report (0034). Hidden,
-- not deleted — a comment can be brought back by hand.
create or replace function expire_unconfirmed_notes()
returns integer
language sql
security definer
set search_path = public
as $$
  with hidden as (
    update community_notes
       set moderation_status = 'hidden'
     where kind = 'unconfirmed'
       and moderation_status = 'published'
       and created_at < now() - interval '14 days'
    returning 1
  )
  select count(*)::integer from hidden;
$$;

revoke all on function expire_unconfirmed_notes() from public, anon, authenticated;

select cron.schedule('unconfirmed-expire', '20 3 * * *', 'select public.expire_unconfirmed_notes()');
