-- What the chat watch found, kept for the scheduled Claude session that
-- turns new facts into drafts (bot_actions, source "draft"; 0031 sends them
-- to the admin bot). processed_at marks rows that session has gone through.
-- Service-role only: these are other people's chat messages.
create table chatwatch_found (
  id            bigint generated always as identity primary key,
  source_title  text not null,
  msg_date      timestamptz not null,
  text          text not null,
  link          text not null,
  cities        text[] not null default '{}',
  created_at    timestamptz not null default now(),
  processed_at  timestamptz
);

create index chatwatch_found_unprocessed on chatwatch_found (created_at) where processed_at is null;

alter table chatwatch_found enable row level security;
revoke all on chatwatch_found from anon, authenticated;
