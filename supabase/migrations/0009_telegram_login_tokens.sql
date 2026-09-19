-- One-time login tokens issued by the bot.
--
-- The Login Widget needs BotFather's /setdomain and the Mini App needs /newapp;
-- both are account actions outside the deployment's control, and until they are
-- done there is no way to sign in at all. The bot needs neither: an update
-- arriving on our webhook is signed with a secret derived from the bot token,
-- so the Telegram user id in it is authentic, and that is enough to mint a
-- short-lived link.
create table telegram_login_tokens (
  -- sha256 of the token in the link, never the token itself: a dump of this
  -- table must not let anyone sign in as anybody.
  token_hash        text primary key,
  telegram_user_id  bigint not null,
  expires_at        timestamptz not null,
  consumed_at       timestamptz,
  created_at        timestamptz not null default now()
);

create index idx_telegram_login_tokens_expires_at on telegram_login_tokens (expires_at);

-- Deliberately no policies and no grants: only the service-role client (which
-- bypasses RLS) issues and redeems these. anon/authenticated must never read
-- them — a readable token_hash plus a readable telegram_user_id is an account
-- takeover waiting to happen.
alter table telegram_login_tokens enable row level security;

-- Supabase grants anon/authenticated full table privileges on the public schema
-- by default, so RLS with zero policies would be the only thing standing in the
-- way. Revoke the grants too: one mistaken `create policy` later should not be
-- enough to expose these rows.
revoke all on telegram_login_tokens from anon, authenticated;

/**
 * Housekeeping. Expired and consumed rows carry no value; this keeps the table
 * from growing without bound. Called opportunistically when a token is issued.
 */
create or replace function prune_telegram_login_tokens() returns void
  language sql security definer set search_path = public as $$
  delete from telegram_login_tokens
  where expires_at < now() - interval '1 day';
$$;

-- SECURITY DEFINER, so it must not be callable by anyone but the service role.
revoke execute on function prune_telegram_login_tokens() from public, anon, authenticated;
