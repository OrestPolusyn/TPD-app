-- Settings that an operator changes, kept out of the deployment's env vars.
--
-- TELEGRAM_ADMIN_CHAT_ID was env-only, which means: open the hosting
-- dashboard, add a variable, redeploy — and until all three happen, every
-- submission notification is silently dropped. That is a lot of ceremony for
-- "who should be told", and it has already been the cause of one round of
-- "nothing arrives anywhere".
--
-- The env var still wins when set, so a self-hosted deployment can keep
-- configuring it that way; this is the fallback that needs no redeploy.
create table app_settings (
  key         text primary key,
  value       text not null,
  updated_at  timestamptz not null default now()
);

-- Service-role only. No policies at all, and the default anon/authenticated
-- grants revoked as well, so a later stray `create policy` still cannot
-- expose the row: a readable moderator chat id is an invitation to spam it.
alter table app_settings enable row level security;
revoke all on app_settings from anon, authenticated;
