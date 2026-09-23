-- The 23.09.2026 digests from 0016, re-entered as individual claims.
--
-- Split by hand rather than by sentence-splitting the old text: a claim is a
-- unit somebody can agree or disagree with, and that boundary is not always a
-- full stop ("вимагають два документи" plus the condition that applies to
-- couples is one claim; the address and the queue times are two). Each one
-- keeps 23.09.2026 as its observation date — the day the chats reported it,
-- not the day this migration runs.
--
-- Everything here is community-sourced and none of it is verified against an
-- official list; that is exactly why it is now checkable in place.

insert into community_notes (location_id, body, observed_on) values
  ('comisaria-alicante', 'Приймають із документом про виїзд з України після 24.02.2022: штамп у закордонному паспорті, довідка ДПСУ про перетин кордону або Резерв+.', date '2026-09-23'),
  ('comisaria-alicante', 'Підходять статуси Резерв+ «звільнений від призову», «відстрочка до кінця мобілізації», «не на обліку».', date '2026-09-23'),
  ('comisaria-alicante', 'Вимоги однакові для жінок і чоловіків.', date '2026-09-23'),
  ('comisaria-alicante', 'Рішення зазвичай наступного дня після подачі.', date '2026-09-23'),
  ('comisaria-alicante', 'Письмової відмови не дають — з донесеним документом можна прийти в той самий відділок ще раз.', date '2026-09-23'),
  ('comisaria-alicante', 'Довідку ДПСУ варто мати роздрукованою і водночас могти показати її перевірку на czo.gov.ua/verify зі свого телефона.', date '2026-09-23'),
  ('comisaria-alicante', 'У провінції Аліканте заяви приймає лише цей відділок.', date '2026-09-23'),
  ('comisaria-alicante', 'Просять приходити без довгих нігтів: сканер не зчитує відбитки.', date '2026-09-23'),

  ('creade-torrevieja', 'Центр не оформлює тимчасовий захист — лише скеровує до поліції та на програму Червоного Хреста.', date '2026-09-23'),
  ('creade-torrevieja', 'У провінції Аліканте заяви приймає тільки комісаріат у самому Аліканте.', date '2026-09-23'),
  ('creade-torrevieja', 'Запис у центр — телефоном.', date '2026-09-23'),
  ('creade-torrevieja', 'Житло в день приїзду не надають, ставлять у чергу.', date '2026-09-23'),

  ('comisaria-zaragoza', 'Адреса, яку називають у спільноті: Av. de Valencia, 50, Delicias, 50005 Zaragoza.', date '2026-09-23'),
  ('comisaria-zaragoza', 'Приймали живою чергою — приходили на 7:45–8:00, оформлення зайняло близько 30 хвилин.', date '2026-09-23'),
  ('comisaria-zaragoza', 'Вистачило штампа в паспорті; довідка ДПСУ теж підходить.', date '2026-09-23'),
  ('comisaria-zaragoza', 'Питали лише, з якою країною перетинали кордон.', date '2026-09-23'),
  ('comisaria-zaragoza', 'Чи вимагають Резерв+ — невідомо.', date '2026-09-23'),

  ('comisaria-almeria', 'Запис фактично не дають — люди чекають місяцями.', date '2026-09-23'),
  ('comisaria-almeria', 'У відділку щоразу кажуть різне.', date '2026-09-23'),
  ('comisaria-almeria', 'Запис — на e-mail.', date '2026-09-23'),

  ('comisaria-castellon-de-la-plana', 'З середини вересня 2026 запис беруть через сайт, а не на e-mail, як вказано в офіційному списку.', date '2026-09-23'),
  ('comisaria-castellon-de-la-plana', 'Потрібен штамп у паспорті або довідка ДПСУ; Резерв+ не вимагають.', date '2026-09-23'),
  ('comisaria-castellon-de-la-plana', 'Просять адресу проживання.', date '2026-09-23'),
  ('comisaria-castellon-de-la-plana', 'Прийом у четвер або п’ятницю, 9:00–14:00, за адресою BPEF Documentación, Teodoro Izquierdo, 6.', date '2026-09-23'),

  ('comisaria-villarreal', 'До 15.09.2026 запис видавали на e-mail, тепер скеровують на сайт Кастельона.', date '2026-09-23'),
  ('comisaria-villarreal', 'Схоже, відділок більше не оформлює тимчасовий захист — попри те, що він є в офіційному списку.', date '2026-09-23'),

  ('comisaria-barcelona', 'Лише за попереднім записом — людей із живої черги розвертають.', date '2026-09-23'),
  ('comisaria-barcelona', 'Телефон запису не працював; казали, що має відновитися з 01.10.2026.', date '2026-09-23'),
  ('comisaria-barcelona', 'Потрібен щонайменше один документ: Резерв+, штамп у паспорті або довідка ДПСУ — приймали і роздруківку без мокрої печатки.', date '2026-09-23'),
  ('comisaria-barcelona', 'Без жодного з цих документів — відмова.', date '2026-09-23'),
  ('comisaria-barcelona', 'Шлях через CREADE довгий: дзвінок, потім запис у центр, потім запис у поліцію — разом близько двох місяців.', date '2026-09-23'),

  ('creade-barcelona', 'Центр не оформлює тимчасовий захист — лише скеровує до поліції та на програму Червоного Хреста.', date '2026-09-23'),

  ('comisaria-tarragona', 'Вимагають Резерв+ і документ про перебування в Україні на початок війни.', date '2026-09-23'),
  ('comisaria-tarragona', 'Документи просять на всіх членів родини, включно з малолітніми дітьми.', date '2026-09-23'),

  ('comisaria-valladolid', 'З 22.09.2026 живої черги немає — лише запис через сайт.', date '2026-09-23'),
  ('comisaria-valladolid', 'Місця на запис дають приблизно на два тижні вперед.', date '2026-09-23'),

  ('comisaria-mallorca', 'Запис — на e-mail.', date '2026-09-23'),
  ('comisaria-mallorca', 'Достатньо штампа в паспорті або довідки ДПСУ.', date '2026-09-23'),
  ('comisaria-mallorca', 'Жінкам із Резерв+ зі статусом «не на обліку» документи приймали.', date '2026-09-23'),
  ('comisaria-mallorca', 'Якщо прийти раніше, приймають без черги.', date '2026-09-23'),
  ('comisaria-mallorca', 'Чи потрібен Резерв+ чоловікам — невідомо.', date '2026-09-23'),

  ('comisaria-malaga', 'Вимоги такі самі, як у Мадриді: штамп або довідка про виїзд з України після 24.02.2022 разом із Резерв+.', date '2026-09-23'),

  ('comisaria-valencia', 'Резерв+ вимагають починаючи з 16 років.', date '2026-09-23'),
  ('comisaria-valencia', 'Вільних записів фактично немає.', date '2026-09-23'),
  ('comisaria-valencia', 'Тимчасовий захист можна отримати в іншій провінції, а TIE потім робити за місцем проживання.', date '2026-09-23');

-- Madrid: the police station and the CREADE centre next to it are two rows in
-- locations but one story for anyone applying there, so both carry the same
-- claims (as they did in 0016).
insert into community_notes (location_id, body, observed_on)
select loc, body, date '2026-09-23'
from (values ('comisaria-pozuelo-de-alarcon'), ('creade-pozuelo')) as l(loc)
cross join (values
  ('Вимагають одночасно два документи: штамп або довідку про виїзд з України після 24.02.2022 і Резерв+.'),
  ('Якщо подружжя подається разом, Резерв+ потрібен кожному з подружжя.'),
  ('Довідку без мокрої печатки не приймають.'),
  ('З 23.09.2026 почали відмовляти тим, у кого перевищено 90 днів безвізу.'),
  ('Донести документи можна лише в Мадриді — в інших відділках їх не візьмуть.')
) as n(body);

-- The paragraphs are now rows. Keeping the columns as well would leave two
-- sources for the same claims, one of which nobody can correct.
alter table locations
  drop column practical_info,
  drop column practical_info_updated_at;
