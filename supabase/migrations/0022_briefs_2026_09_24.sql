-- ---------------------------------------------------------------------------
-- Community briefs, second pass: the 07.09 and 23.09 city digests from the
-- chats, plus a correction from a chat admin (24.09) that Alicante books only
-- through the website.
--
-- Where the two digests disagree, the newer one wins (Valladolid: e-mail on
-- 07.09, website-only from 22.09). Bullets that only the 07.09 digest backs
-- say so in their text — the card shows its newest date, and a two-week-old
-- claim should not borrow it.
-- ---------------------------------------------------------------------------

-- Booking method. The ministry list says phone/e-mail for these four; the
-- chats (and, for Alicante, an admin who deals with that office daily) say
-- appointments are only given through the ICP website now. Mirrored in
-- seed/locations.csv, which owns these columns, so a re-seed keeps it.
update locations set
  appointment_method = 'icp_online',
  appointment_url = 'https://sede.administracionespublicas.gob.es/pagina/index/directorio/icpplus'
where id in ('comisaria-alicante', 'comisaria-valladolid', 'comisaria-albacete', 'comisaria-castellon-de-la-plana');

-- Rewritten in full.
delete from community_notes where location_id in ('comisaria-alicante', 'comisaria-valencia', 'comisaria-malaga');

-- Adjusted in place.
update community_notes set body = 'Штамп у паспорті або довідка ДПСУ (з QR-кодом)'
where location_id = 'comisaria-zaragoza' and kind = 'document' and position = 1;

insert into community_notes (location_id, kind, position, body, observed_on)
select n.loc, n.kind, n.pos, n.body, n.seen::date
from (values
  ('comisaria-alicante', 'document', 1, 'Одне з: штамп у паспорті, довідка ДПСУ або Резерв+ — однаково для жінок і чоловіків', '2026-09-23'),
  ('comisaria-alicante', 'document', 2, 'Резерв+: «звільнений», «відстрочка до кінця мобілізації» або «не на обліку»', '2026-09-23'),
  ('comisaria-alicante', 'document', 3, 'Довідка ДПСУ — роздрукована + перевірка на czo.gov.ua/verify з телефона', '2026-09-23'),
  ('comisaria-alicante', 'info', 1, 'Запис лише через сайт', '2026-09-24'),
  ('comisaria-alicante', 'info', 2, 'Перетин кордону — не пізніше ніж 90 днів тому (07.09)', '2026-09-07'),
  ('comisaria-alicante', 'info', 3, 'Рішення — наступного дня', '2026-09-23'),
  ('comisaria-alicante', 'info', 4, 'Письмової відмови не дають — документ можна донести', '2026-09-23'),
  ('comisaria-alicante', 'info', 5, 'Єдине місце подачі в провінції Аліканте', '2026-09-23'),
  ('comisaria-alicante', 'info', 6, 'Без довгих нігтів — сканер не зчитує відбитки', '2026-09-23'),

  ('comisaria-valencia', 'document', 1, 'Резерв+ — навіть якщо є штамп чи довідка, з 16 років', '2026-09-23'),
  ('comisaria-valencia', 'document', 2, 'Адреса проживання у Валенсії', '2026-09-23'),
  ('comisaria-valencia', 'info', 1, 'Вільних записів фактично немає', '2026-09-23'),
  ('comisaria-valencia', 'info', 2, 'У провінції також приймають: Альсіра, Гандія, Патерна, Сагунто, Шірівелья — з тими ж вимогами', '2026-09-23'),
  ('comisaria-valencia', 'info', 3, 'ТЗ можна отримати в іншій провінції, TIE — потім за місцем проживання', '2026-09-23'),

  ('comisaria-malaga', 'document', 1, 'Штамп або довідка ДПСУ з мокрою печаткою + Резерв+', '2026-09-23'),
  ('comisaria-malaga', 'document', 2, 'Якщо був захист іншої країни і є документ про відмову від нього — більше нічого не треба', '2026-09-23'),

  ('comisaria-valladolid', 'document', 1, 'Адреса проживання у Вальядоліді', '2026-09-23'),
  ('comisaria-tarragona', 'info', 1, 'У провінції також приймають у Тортосі — там теж вимагають Резерв+', '2026-09-23'),

  ('comisaria-bilbao', 'document', 1, 'Штамп у паспорті — довідку ДПСУ не визнають', '2026-09-23'),
  ('comisaria-bilbao', 'document', 2, 'Резерв+ — навіть якщо є штамп', '2026-09-23'),

  ('comisaria-badajoz', 'document', 1, 'Резерв+ — навіть якщо є штамп чи довідка', '2026-09-23'),
  ('comisaria-badajoz', 'document', 2, 'Адреса проживання в Бадахосі', '2026-09-23'),

  ('comisaria-granada', 'document', 1, 'Резерв+ — навіть якщо є штамп чи довідка', '2026-09-23'),
  ('comisaria-granada', 'document', 2, 'Довідка ДПСУ — лише з присяжним перекладом (traducción jurada)', '2026-09-23'),

  ('comisaria-caceres', 'document', 1, 'Резерв+ — навіть якщо є штамп чи довідка', '2026-09-23'),

  ('comisaria-cordoba', 'document', 1, 'Довідка ДПСУ і Резерв+ — обидва з присяжним перекладом', '2026-09-23'),

  ('comisaria-santa-cruz-de-tenerife', 'document', 1, 'Резерв+ — навіть якщо є штамп чи довідка', '2026-09-23'),
  ('comisaria-santa-cruz-de-tenerife', 'document', 2, 'Довідка ДПСУ — з присяжним перекладом', '2026-09-23'),
  ('comisaria-santa-cruz-de-tenerife', 'info', 1, 'Так само в Пуерто-де-ла-Крус і Адехе', '2026-09-23'),

  ('comisaria-toledo', 'document', 1, 'Резерв+ — навіть якщо є штамп чи довідка', '2026-09-23'),

  ('comisaria-sevilla', 'document', 1, 'Резерв+ — навіть якщо є штамп чи довідка', '2026-09-23'),
  ('comisaria-sevilla', 'document', 2, 'Довідка ДПСУ — з присяжним перекладом', '2026-09-23'),

  ('comisaria-teruel', 'document', 1, 'Адреса проживання в Теруелі', '2026-09-23'),
  ('comisaria-teruel', 'info', 1, 'На e-mail відповідають дуже швидко', '2026-09-23'),

  ('comisaria-albacete', 'document', 1, 'Штамп або довідка ДПСУ; Резерв+ не перевіряють (07.09)', '2026-09-07'),
  ('comisaria-albacete', 'info', 1, 'Запис лише через сайт — на e-mail давно не дають (07.09)', '2026-09-07'),

  ('comisaria-cadiz', 'document', 1, 'Штамп або довідка ДПСУ; Резерв+ не перевіряють (07.09)', '2026-09-07'),

  ('comisaria-san-sebastian', 'document', 1, 'Штамп або довідка ДПСУ; Резерв+ не перевіряють (07.09)', '2026-09-07'),

  ('comisaria-lugo', 'document', 1, 'Не вимагали ні штампа, ні Резерв+ (07.09)', '2026-09-07'),
  ('comisaria-lugo', 'info', 1, 'З 22.09 — запис через сайт, раніше приймали без запису', '2026-09-23'),

  -- Not offered in search (0021), but their pages are still reachable.
  ('comisaria-tortosa', 'document', 1, 'Резерв+ — навіть якщо є штамп чи довідка', '2026-09-23'),
  ('comisaria-puerto-del-rosario', 'document', 1, 'Адреса проживання в цьому місті', '2026-09-23')
) as n(loc, kind, pos, body, seen);
