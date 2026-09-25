-- ---------------------------------------------------------------------------
-- The updates channel as a two-way thing, and a dated timeline of rule
-- changes.
--
-- A channel post carries buttons: "✅ Актуально" (counted per Telegram
-- account, no sign-in), "✏️ Змінилось" (opens the bot, which asks what
-- changed and sends it to the owner to moderate), "➕ Мій досвід" and
-- "🔎 Детальніше". channel_posts remembers what each post was about, so a
-- vote or a suggested change can be tied back to its office.
-- ---------------------------------------------------------------------------

create table channel_posts (
  id           bigint generated always as identity primary key,
  kind         text not null check (kind in ('report', 'change', 'rule', 'guide')),
  location_id  text references locations(id) on delete set null,
  chat_id      text,
  message_id   bigint,
  created_at   timestamptz not null default now()
);
create index idx_channel_posts_location on channel_posts (location_id);

-- One "Актуально" per Telegram account per post; pressing again takes it back.
create table channel_post_votes (
  post_id      bigint not null references channel_posts(id) on delete cascade,
  tg_user_id   bigint not null,
  created_at   timestamptz not null default now(),
  primary key (post_id, tg_user_id)
);

-- "What changed?" is a two-step exchange with the bot: /start chg_<post>
-- opens it, the person's next message answers it. This remembers who is
-- mid-answer, and expires so a stray message days later is not taken as one.
create table bot_conversations (
  tg_user_id   bigint primary key,
  kind         text not null check (kind in ('change')),
  ref          jsonb not null,
  expires_at   timestamptz not null
);

alter table channel_posts enable row level security;
alter table channel_post_votes enable row level security;
alter table bot_conversations enable row level security;
revoke all on channel_posts, channel_post_votes, bot_conversations from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Rule changes: "from 22.09 Valladolid books only online". Kept apart from
-- policy_changes (0005), which is national, needs an official source and
-- marks every older report as outdated — far too strong for a per-office
-- change reported in a chat. Public: shown on /changes and on office pages.
-- ---------------------------------------------------------------------------
create table rule_changes (
  id              bigint generated always as identity primary key,
  location_id     text references locations(id) on delete cascade,
  effective_date  date not null,
  title           text not null check (char_length(title) between 1 and 300),
  source          text not null default 'community_chat',
  created_at      timestamptz not null default now()
);
create index idx_rule_changes_date on rule_changes (effective_date desc);
create index idx_rule_changes_location on rule_changes (location_id);

alter table rule_changes enable row level security;
create policy rule_changes_public_read on rule_changes for select using (true);
revoke all on rule_changes from anon, authenticated;
grant select on rule_changes to anon, authenticated;

insert into rule_changes (location_id, effective_date, title) values
  ('comisaria-barcelona', '2026-10-01', 'Очікується: телефон запису має знову запрацювати'),
  ('comisaria-pozuelo-de-alarcon', '2026-09-23', 'Почали відмовляти тим, у кого перевищено 90 днів безвізу'),
  ('comisaria-valladolid', '2026-09-22', 'Живої черги більше немає — лише запис через сайт'),
  ('comisaria-lugo', '2026-09-22', 'Запис лише через сайт — раніше приймали без запису'),
  ('comisaria-villarreal', '2026-09-15', 'Запис на e-mail більше не дають, скеровують у Кастельйон; схоже, ТЗ тут не оформлюють'),
  ('comisaria-castellon-de-la-plana', '2026-09-15', 'Запис лише через сайт замість e-mail (приблизно з середини вересня)');
