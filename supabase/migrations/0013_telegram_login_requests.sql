-- Login is browser-initiated now, not chat-initiated.
--
-- The old flow (0009) had the bot send a one-time LINK into the chat. Tapping
-- that link on a phone opens Telegram's own in-app browser, so the session
-- cookie landed in Telegram's WebView — a different cookie jar from the Safari
-- or Chrome tab the person actually started in, which stayed signed out with
-- no way to ever sign in. Reported from the field, reproduced exactly.
--
-- The direction is reversed here: the browser mints the request and holds the
-- secret, the chat only approves it, and the session is created on the polling
-- response — i.e. in the same browser that asked. Nothing the chat can tap
-- creates a session anywhere else.
create table telegram_login_requests (
  -- Public half: travels to Telegram inside the t.me deep link, so it is
  -- visible to anyone who can see that chat. Unguessable, but on its own it
  -- grants nothing — approving a request only ever signs in the browser
  -- holding the matching nonce below.
  request_id           text primary key,

  -- Secret half: sha256 of the nonce in the browser's httpOnly cookie. Only
  -- the browser that started the login can redeem the approval. Stored hashed
  -- so a dump of this table cannot be replayed into a session.
  nonce_hash           text not null unique,

  -- Short pairing code, shown both in the browser and in the bot's message.
  -- Defence against blind approval: a person who is not currently signing in
  -- has no code on screen to match, which is the signal not to confirm.
  code                 text not null,

  -- Set when the person confirms in the chat. Captured from the same webhook
  -- update Telegram signs, so the id is authentic — and the name comes along
  -- with it, which the old flow never stored (every bot-login profile had a
  -- null telegram_first_name and rendered as the generic "Користувач").
  telegram_user_id     bigint,
  telegram_first_name  text,
  telegram_username    text,

  approved_at          timestamptz,
  consumed_at          timestamptz,
  expires_at           timestamptz not null,
  created_at           timestamptz not null default now()
);

create index idx_telegram_login_requests_expires_at on telegram_login_requests (expires_at);

-- Same posture as 0009: service-role only. No policies, and the default
-- anon/authenticated grants revoked as well, so a later stray `create policy`
-- still cannot expose a row. A readable nonce_hash plus telegram_user_id is an
-- account takeover waiting to happen.
alter table telegram_login_requests enable row level security;
revoke all on telegram_login_requests from anon, authenticated;

create or replace function prune_telegram_login_requests() returns void
  language sql security definer set search_path = public as $$
  delete from telegram_login_requests
  where expires_at < now() - interval '1 day';
$$;

revoke execute on function prune_telegram_login_requests() from public, anon, authenticated;

-- telegram_login_tokens (0009) is deliberately LEFT IN PLACE, unused: the code
-- that reads it (src/app/auth/telegram/route.ts) is deleted in this change, so
-- nothing issues or redeems those rows any more. Dropping it is a destructive
-- change to a live database and buys nothing today — it is a separate step,
-- once this flow is confirmed working in production.
