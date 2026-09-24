-- ---------------------------------------------------------------------------
-- 1. Довідка ДПСУ as a document type.
--
-- Every office in the September chats turns on one of three documents: the
-- exit stamp, Reserve+, or the DPSU border-crossing certificate. Only the
-- first two existed, so a report could not say "I brought the certificate"
-- except through "Інше" + free text. Slotted in right after the stamp, which
-- it substitutes for.
-- ---------------------------------------------------------------------------
update document_types set sort_order = sort_order + 1 where sort_order >= 7;
insert into document_types (code, label_uk, label_es, sort_order, is_active) values
  ('border_crossing_certificate', 'Довідка ДПСУ про перетин кордону', 'Certificado de cruce de frontera (DPSU)', 7, true);

-- ---------------------------------------------------------------------------
-- 2. Community notes become a compact brief.
--
-- 0017/0018 rendered each claim as its own comment-sized card: 5–8 cards per
-- office, more screen than the office's actual reports. What a reader needs
-- from the chats is short: which documents, and a few practical points. So a
-- note is now one bullet, either a 'document' (under "Документи") or 'info'
-- (under "Додатково"), ordered by `position` — and the brief as a whole, not
-- each bullet, is what people confirm.
-- ---------------------------------------------------------------------------
drop trigger trg_note_confirmations_sync_status on community_note_confirmations;
drop function community_note_confirmations_sync_status();
drop table community_note_confirmations;   -- empty at the time of writing
drop function community_note_confirmations_set_updated_at();

delete from community_notes;

alter table community_notes
  add column kind     text not null default 'info' check (kind in ('document', 'info')),
  add column position smallint not null default 0;

create table location_brief_confirmations (
  location_id  text not null references locations(id) on delete cascade,
  user_id      uuid not null references profiles(id) on delete cascade,
  stance       community_note_stance_t not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (location_id, user_id)
);

create or replace function location_brief_confirmations_set_updated_at() returns trigger
  language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger trg_brief_confirmations_updated_at before update on location_brief_confirmations
  for each row execute function location_brief_confirmations_set_updated_at();

alter table location_brief_confirmations enable row level security;

-- Tallies are shown to everyone; rows carry only (office, user, stance).
create policy brief_confirmations_public_read on location_brief_confirmations for select
  using (true);
create policy brief_confirmations_insert_own on location_brief_confirmations for insert to authenticated
  with check (user_id = auth.uid());
create policy brief_confirmations_update_own on location_brief_confirmations for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
create policy brief_confirmations_delete_own on location_brief_confirmations for delete to authenticated
  using (user_id = auth.uid());

-- Same default-privilege gap as every other new table (0012, 0014, 0017).
revoke all on location_brief_confirmations from anon, authenticated;
grant select on location_brief_confirmations to anon, authenticated;
grant insert, delete on location_brief_confirmations to authenticated;
grant update (stance) on location_brief_confirmations to authenticated;

-- The briefs, as of 23.09.2026. Bullets are deliberately terse.
insert into community_notes (location_id, kind, position, body, observed_on)
select n.loc, n.kind, n.pos, n.body, date '2026-09-23'
from (values
  ('comisaria-alicante', 'document', 1, 'Одне з: штамп у паспорті, довідка ДПСУ або Резерв+'),
  ('comisaria-alicante', 'document', 2, 'Резерв+: «звільнений», «відстрочка до кінця мобілізації» або «не на обліку»'),
  ('comisaria-alicante', 'document', 3, 'Довідка ДПСУ — роздрукована + перевірка на czo.gov.ua/verify з телефона'),
  ('comisaria-alicante', 'info', 1, 'Вимоги однакові для жінок і чоловіків'),
  ('comisaria-alicante', 'info', 2, 'Рішення — наступного дня'),
  ('comisaria-alicante', 'info', 3, 'Письмової відмови не дають — документ можна донести'),
  ('comisaria-alicante', 'info', 4, 'Єдине місце подачі в провінції Аліканте'),
  ('comisaria-alicante', 'info', 5, 'Без довгих нігтів — сканер не зчитує відбитки'),

  ('creade-torrevieja', 'info', 1, 'ТЗ не оформлюють — скеровують у поліцію Аліканте і до Червоного Хреста'),
  ('creade-torrevieja', 'info', 2, 'Запис у центр — телефоном'),
  ('creade-torrevieja', 'info', 3, 'Житло в день приїзду не дають — ставлять у чергу'),

  ('comisaria-zaragoza', 'document', 1, 'Штамп у паспорті або довідка ДПСУ'),
  ('comisaria-zaragoza', 'document', 2, 'Чи потрібен Резерв+ — невідомо'),
  ('comisaria-zaragoza', 'info', 1, 'Адреса: Av. de Valencia, 50 (Delicias)'),
  ('comisaria-zaragoza', 'info', 2, 'Жива черга — приходити о 7:45, оформлення ~30 хв'),
  ('comisaria-zaragoza', 'info', 3, 'Питають лише, через яку країну перетинали кордон'),

  ('comisaria-almeria', 'info', 1, 'Запис фактично не дають — чекають місяцями'),
  ('comisaria-almeria', 'info', 2, 'У відділку щоразу кажуть різне'),

  ('comisaria-castellon-de-la-plana', 'document', 1, 'Штамп у паспорті або довідка ДПСУ; Резерв+ не потрібен'),
  ('comisaria-castellon-de-la-plana', 'document', 2, 'Адреса проживання'),
  ('comisaria-castellon-de-la-plana', 'info', 1, 'Запис лише через сайт (не e-mail)'),
  ('comisaria-castellon-de-la-plana', 'info', 2, 'Прийом чт/пт 9:00–14:00, BPEF Documentación, Teodoro Izquierdo, 6'),

  ('comisaria-villarreal', 'info', 1, 'З 15.09 скеровують на запис у Кастельйоні'),
  ('comisaria-villarreal', 'info', 2, 'Схоже, ТЗ тут більше не оформлюють'),

  ('comisaria-barcelona', 'document', 1, 'Одне з: Резерв+, штамп або довідка ДПСУ (роздруківка без мокрої печатки — ок)'),
  ('comisaria-barcelona', 'document', 2, 'Без жодного з них — відмова'),
  ('comisaria-barcelona', 'info', 1, 'Лише за записом — живу чергу розвертають'),
  ('comisaria-barcelona', 'info', 2, 'Телефон запису не працює, обіцяють з 01.10'),
  ('comisaria-barcelona', 'info', 3, 'Через CREADE: дзвінок → центр → поліція, ~2 місяці'),

  ('creade-barcelona', 'info', 1, 'ТЗ не оформлюють — скеровують у поліцію і до Червоного Хреста'),

  ('comisaria-tarragona', 'document', 1, 'Резерв+'),
  ('comisaria-tarragona', 'document', 2, 'Документ про перебування в Україні на 24.02.2022 — на кожного, включно з дітьми'),

  ('comisaria-valladolid', 'info', 1, 'З 22.09 — лише запис через сайт, живої черги немає'),
  ('comisaria-valladolid', 'info', 2, 'Записи ~на 2 тижні вперед'),

  ('comisaria-mallorca', 'document', 1, 'Штамп у паспорті або довідка ДПСУ'),
  ('comisaria-mallorca', 'document', 2, 'Жінкам Резерв+ «не на обліку» приймали; чоловікам — невідомо'),
  ('comisaria-mallorca', 'info', 1, 'Запис на e-mail'),
  ('comisaria-mallorca', 'info', 2, 'Якщо прийти раніше — приймають без черги'),

  ('comisaria-malaga', 'document', 1, 'Обидва: штамп або довідка ДПСУ + Резерв+'),

  ('comisaria-valencia', 'document', 1, 'Резерв+ — з 16 років'),
  ('comisaria-valencia', 'info', 1, 'Вільних записів фактично немає'),
  ('comisaria-valencia', 'info', 2, 'ТЗ можна отримати в іншій провінції, TIE — потім за місцем проживання')
) as n(loc, kind, pos, body);

-- Madrid: the police station and the CREADE centre are one route.
insert into community_notes (location_id, kind, position, body, observed_on)
select l.loc, n.kind, n.pos, n.body, date '2026-09-23'
from (values ('comisaria-pozuelo-de-alarcon'), ('creade-pozuelo')) as l(loc)
cross join (values
  ('document', 1, 'Обидва: штамп або довідка ДПСУ + Резерв+ (кожному з подружжя)'),
  ('document', 2, 'Довідка — лише з мокрою печаткою'),
  ('info', 1, 'Запис у поліцію дають одразу'),
  ('info', 2, 'З 23.09 відмовляють, якщо перевищено 90 днів безвізу'),
  ('info', 3, 'Донести документи — лише в Мадриді')
) as n(kind, pos, body);

create index idx_community_notes_brief on community_notes (location_id, kind, position)
  where moderation_status = 'published';
