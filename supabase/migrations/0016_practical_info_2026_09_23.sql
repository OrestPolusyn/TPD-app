-- Practical information gathered from the Ukrainian community chats for
-- Alicante and Spain generally, as of 23.09.2026.
--
-- Deliberately confined to practical_info: scripts/seed.ts owns the official
-- columns (address, appointment_method, verification_status…) and recomputes
-- them from seed/locations.csv on every run, so anything community-sourced
-- written there would be silently reverted — and would also blur the line
-- between "the ministry publishes this" and "someone reported this on Monday".
-- Where the two disagree (Castellón, Villarreal), the disagreement is stated
-- in the text rather than by overwriting the official value.
--
-- This is a snapshot, not a fixed truth: offices change practice week to week,
-- which is why every one of these is rendered with its date.

update locations set
  practical_info = 'Приймають із документом про виїзд з України після 24.02.2022: штамп у закордонному паспорті, довідка ДПСУ про перетин кордону або Резерв+. Підходять статуси Резерв+ «звільнений від призову», «відстрочка до кінця мобілізації», «не на обліку». Вимоги однакові для жінок і чоловіків. Рішення зазвичай наступного дня після подачі. Письмової відмови не дають — з донесеним документом можна прийти в той самий відділок ще раз. Довідку ДПСУ варто мати роздрукованою і водночас могти показати її перевірку на czo.gov.ua/verify зі свого телефона. У провінції Аліканте заяви приймає лише цей відділок. Просять приходити без довгих нігтів: сканер не зчитує відбитки.',
  practical_info_updated_at = date '2026-09-23'
where id = 'comisaria-alicante';

update locations set
  practical_info = 'Центр не оформлює тимчасовий захист — лише скеровує до поліції та на програму Червоного Хреста. У провінції Аліканте заяви приймає тільки комісаріат у самому Аліканте. Запис у центр — телефоном. Житло в день приїзду не надають, ставлять у чергу.',
  practical_info_updated_at = date '2026-09-23'
where id = 'creade-torrevieja';

update locations set
  practical_info = 'Адреса, яку називають у спільноті: Av. de Valencia, 50, Delicias, 50005 Zaragoza. 23.09.2026 приймали живою чергою — приходили на 7:45–8:00, оформлення зайняло близько 30 хвилин. Вистачило штампа в паспорті; довідка ДПСУ теж підходить. Питали лише, з якою країною перетинали кордон. Чи вимагають Резерв+ — невідомо.',
  practical_info_updated_at = date '2026-09-23'
where id = 'comisaria-zaragoza';

update locations set
  practical_info = 'Вересень 2026: запис фактично не дають. Люди чекають місяцями, у відділку щоразу кажуть різне. Запис — на e-mail.',
  practical_info_updated_at = date '2026-09-23'
where id = 'comisaria-almeria';

update locations set
  practical_info = 'З середини вересня 2026 запис беруть через сайт, а не на e-mail, як вказано в офіційному списку. Потрібен штамп у паспорті або довідка ДПСУ; Резерв+ не вимагають. Просять адресу проживання. Прийом у четвер або п’ятницю, 9:00–14:00, за адресою BPEF Documentación, Teodoro Izquierdo, 6.',
  practical_info_updated_at = date '2026-09-23'
where id = 'comisaria-castellon-de-la-plana';

update locations set
  practical_info = 'До 15.09.2026 запис видавали на e-mail, тепер скеровують на сайт Кастельона. Схоже, відділок більше не оформлює тимчасовий захист — попри те, що є в офіційному списку.',
  practical_info_updated_at = date '2026-09-23'
where id = 'comisaria-villarreal';

update locations set
  practical_info = 'Лише за попереднім записом — людей із живої черги розвертають. Телефон запису не працював; повідомляли, що має відновитися з 01.10.2026. Потрібен щонайменше один документ: Резерв+, штамп у паспорті або довідка ДПСУ (приймали і роздруківку без мокрої печатки). Без жодного з них — відмова. Шлях через CREADE довгий: дзвінок, потім запис у центр, потім запис у поліцію — разом близько двох місяців.',
  practical_info_updated_at = date '2026-09-23'
where id = 'comisaria-barcelona';

update locations set
  practical_info = 'Центр не оформлює тимчасовий захист — лише скеровує до поліції та на програму Червоного Хреста.',
  practical_info_updated_at = date '2026-09-23'
where id = 'creade-barcelona';

update locations set
  practical_info = 'Вимагають Резерв+ і документ про перебування в Україні на початок війни — на всіх членів родини, включно з малолітніми дітьми.',
  practical_info_updated_at = date '2026-09-23'
where id = 'comisaria-tarragona';

update locations set
  practical_info = 'З 22.09.2026 живої черги немає — лише запис через сайт, місця дають приблизно на два тижні вперед.',
  practical_info_updated_at = date '2026-09-23'
where id = 'comisaria-valladolid';

update locations set
  practical_info = 'Запис — на e-mail. Достатньо штампа в паспорті або довідки ДПСУ; жінкам із Резерв+ зі статусом «не на обліку» документи приймали. Якщо прийти раніше, приймають без черги. Чи потрібен Резерв+ чоловікам — невідомо.',
  practical_info_updated_at = date '2026-09-23'
where id = 'comisaria-mallorca';

update locations set
  practical_info = 'Вимагають одночасно два документи: штамп або довідку про виїзд з України після 24.02.2022 і Резерв+ (кожному з подружжя, якщо подаються разом). Довідку без мокрої печатки не приймають. З 23.09.2026 почали відмовляти тим, у кого перевищено 90 днів безвізу. Донести документи можна лише в Мадриді — в інших відділках їх не візьмуть.',
  practical_info_updated_at = date '2026-09-23'
where id in ('comisaria-pozuelo-de-alarcon', 'creade-pozuelo');

update locations set
  practical_info = 'Вимоги такі самі, як у Мадриді: штамп або довідка про виїзд з України після 24.02.2022 разом із Резерв+.',
  practical_info_updated_at = date '2026-09-23'
where id = 'comisaria-malaga';

update locations set
  practical_info = 'Резерв+ вимагають починаючи з 16 років. Вересень 2026: вільних записів фактично немає. Тимчасовий захист можна отримати в іншій провінції, а TIE потім робити за місцем проживання.',
  practical_info_updated_at = date '2026-09-23'
where id = 'comisaria-valencia';
