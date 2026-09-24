-- ---------------------------------------------------------------------------
-- Offices the 23.09 chat digest shows taking applications.
--
-- 0021 assumed one office per province. The digest contradicts that: in
-- Valencia province Alzira, Gandia, Paterna, Sagunto and Xirivella all take
-- applications (with their own requirements), Tenerife has Puerto de la Cruz
-- and Adeje besides Santa Cruz, and Tortosa and Puerto del Rosario — hidden
-- from search by 0021 — have reported requirements of their own. So:
-- the missing offices are added, and those two go back into search.
--
-- Mirrored in seed/locations.csv, which owns these columns. Adeje's address
-- is left empty: the directories give two different ones.
-- ---------------------------------------------------------------------------
update locations set accepts_applications = true
where id in ('comisaria-tortosa', 'comisaria-puerto-del-rosario');

insert into locations (
  id, name, type, region, province, city, address, postal_code, phones,
  appointment_method, appointment_url, source_url, source_date, verified_at,
  verification_status, notes, moderation_status
)
select v.id, 'Comisaría Policía Nacional — ' || v.city, 'police_station', v.region, v.province, v.city,
       v.address, v.postal_code, v.phones,
       'icp_online', 'https://sede.administracionespublicas.gob.es/pagina/index/directorio/icpplus',
       v.source_url, '2026-09-23', date '2026-09-24', 'community_reported',
       'Додано 24.09.2026 за повідомленнями з чатів (приймають заяви на ТЗ); адреса з довідника, не з офіційного списку MISSM.',
       'published'
from (values
  ('comisaria-alzira', 'Alzira', 'Comunitat Valenciana', 'Valencia', 'Calle Pere Morell, 4', null, '{}'::text[], 'https://citaping.es/appointments/procedures/police/provinces/valencia/'),
  ('comisaria-gandia', 'Gandia', 'Comunitat Valenciana', 'Valencia', 'Calle Ciudad de Laval, 5', null, '{}'::text[], 'https://citaping.es/appointments/procedures/police/provinces/valencia/'),
  ('comisaria-paterna', 'Paterna', 'Comunitat Valenciana', 'Valencia', 'Calle de les Roses, 27', null, '{}'::text[], 'https://citaping.es/appointments/procedures/police/provinces/valencia/'),
  ('comisaria-sagunto', 'Sagunto', 'Comunitat Valenciana', 'Valencia', 'Calle Progreso, 14', null, '{}'::text[], 'https://citaping.es/appointments/procedures/police/provinces/valencia/'),
  ('comisaria-xirivella', 'Xirivella', 'Comunitat Valenciana', 'Valencia', 'Calle Jaume Roig, 4–6', '46950', '{}'::text[], 'https://igualtat.mancohortasud.es/es/recurso/policia-nacional-xirivella/'),
  ('comisaria-puerto-de-la-cruz', 'Puerto de la Cruz', 'Canarias', 'Santa Cruz de Tenerife', 'Avenida José María del Campo Llarena, 3', '38400', '{+34922376833}'::text[], 'https://www.registrocentral.es/en/comisaria/puerto-de-la-cruz/'),
  ('comisaria-adeje', 'Adeje', 'Canarias', 'Santa Cruz de Tenerife', null, null, '{}'::text[], 'https://web.citas-extranjeria.es/canarias/santa-cruz-de-tenerife/playa-americas-costa-adeje-policia-nacional/')
) as v(id, city, region, province, address, postal_code, phones, source_url);

-- Reports attach to (location, procedure); every office offers the one procedure.
insert into location_procedures (location_id, procedure_code)
select id, 'temporary_protection_application' from locations
where id in ('comisaria-alzira', 'comisaria-gandia', 'comisaria-paterna', 'comisaria-sagunto',
             'comisaria-xirivella', 'comisaria-puerto-de-la-cruz', 'comisaria-adeje')
on conflict do nothing;

-- Their briefs, from the same digest.
insert into community_notes (location_id, kind, position, body, observed_on)
select n.loc, n.kind, n.pos, n.body, date '2026-09-23'
from (values
  ('comisaria-alzira', 'document', 1, 'Резерв+ — навіть якщо є штамп чи довідка'),
  ('comisaria-alzira', 'document', 2, 'Адреса проживання в цьому місті'),
  ('comisaria-gandia', 'document', 1, 'Резерв+ — навіть якщо є штамп чи довідка'),
  ('comisaria-gandia', 'document', 2, 'Адреса проживання в цьому місті'),
  ('comisaria-paterna', 'document', 1, 'Резерв+ — навіть якщо є штамп чи довідка'),
  ('comisaria-sagunto', 'document', 1, 'Резерв+ — навіть якщо є штамп чи довідка'),
  ('comisaria-xirivella', 'document', 1, 'Резерв+ — навіть якщо є штамп чи довідка'),
  ('comisaria-puerto-de-la-cruz', 'document', 1, 'Резерв+ — навіть якщо є штамп чи довідка'),
  ('comisaria-puerto-de-la-cruz', 'document', 2, 'Довідка ДПСУ — з присяжним перекладом'),
  ('comisaria-adeje', 'document', 1, 'Резерв+ — навіть якщо є штамп чи довідка'),
  ('comisaria-adeje', 'document', 2, 'Довідка ДПСУ — з присяжним перекладом')
) as n(loc, kind, pos, body);

-- The Valencia card listed these towns in one line while they had no pages.
update community_notes set body = 'У провінції також приймають: Альсіра, Гандія, Патерна, Сагунто, Шірівелья'
where location_id = 'comisaria-valencia' and kind = 'info' and position = 2;
