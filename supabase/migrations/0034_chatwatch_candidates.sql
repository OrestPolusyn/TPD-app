-- Facts from the chats that only one message has reported so far. The
-- scheduled Claude session (see 0033) keeps them here instead of drafting
-- them: a single report does not become a draft until a second, independent
-- one (another chat or another person) confirms it within 14 days. An
-- official police answer is drafted at once.
create table chatwatch_candidates (
  id               bigint generated always as identity primary key,
  location_id      text not null references locations (id) on delete cascade,
  fact             text not null,
  links            text[] not null default '{}',
  sources          text[] not null default '{}',
  reports          integer not null default 1,
  first_seen       timestamptz not null default now(),
  last_seen        timestamptz not null default now(),
  status           text not null default 'waiting' check (status in ('waiting', 'drafted', 'expired')),
  draft_action_id  bigint references bot_actions (id) on delete set null
);

create index chatwatch_candidates_waiting on chatwatch_candidates (location_id) where status = 'waiting';

alter table chatwatch_candidates enable row level security;
revoke all on chatwatch_candidates from anon, authenticated;
