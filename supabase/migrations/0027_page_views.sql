-- ---------------------------------------------------------------------------
-- Anonymous visit counting: how many people open the site, signed in or not.
--
-- No cookies and no third party. The browser sends the path it is on; the
-- server stores that path, the Madrid day, and `visitor` — an HMAC of
-- (day, IP, user agent) under a server-side key. The IP itself is never
-- stored, and because the day is part of the hashed input the same person
-- gets an unrelated value tomorrow: this can count distinct visitors per
-- day, and by design cannot follow anyone across days.
--
-- Service-role only: no policies, default grants revoked.
-- ---------------------------------------------------------------------------
create table page_views (
  id          bigint generated always as identity primary key,
  day         date not null,
  visitor     text not null check (char_length(visitor) <= 64),
  path        text not null check (char_length(path) <= 200),
  created_at  timestamptz not null default now()
);

create index idx_page_views_day on page_views (day);

alter table page_views enable row level security;
revoke all on page_views from anon, authenticated;

-- Per-day distinct visitors and page views since a date.
create or replace function visit_stats(p_since date)
returns table (day date, visitors bigint, views bigint)
  language sql stable as $$
  select day, count(distinct visitor), count(*)
  from page_views
  where day >= p_since
  group by day
  order by day;
$$;

-- Most-opened pages since a date.
create or replace function top_paths(p_since date, p_limit int default 8)
returns table (path text, views bigint, visitors bigint)
  language sql stable as $$
  select path, count(*), count(distinct (day, visitor))
  from page_views
  where day >= p_since
  group by path
  order by count(*) desc
  limit p_limit;
$$;

revoke execute on function visit_stats(date) from public, anon, authenticated;
revoke execute on function top_paths(date, int) from public, anon, authenticated;
grant execute on function visit_stats(date) to service_role;
grant execute on function top_paths(date, int) to service_role;
