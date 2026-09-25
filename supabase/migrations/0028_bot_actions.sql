-- Buttons on the owner's admin-bot notices ("📢 Опублікувати в канал",
-- "✅ Додати на сайт і в канал").
--
-- Telegram limits callback_data to 64 bytes — too small for a location id
-- plus a user id plus the text being approved — so each button carries only
-- `act:<id>` and the payload lives here. `done_at` makes every action
-- one-shot: a double tap, or tapping an old message again, cannot post the
-- same thing to the channel twice.
--
-- Service-role only: no policies, default grants revoked.
create table bot_actions (
  id          bigint generated always as identity primary key,
  kind        text not null check (kind in ('publish_report', 'accept_change')),
  payload     jsonb not null,
  created_at  timestamptz not null default now(),
  done_at     timestamptz
);

alter table bot_actions enable row level security;
revoke all on bot_actions from anon, authenticated;
