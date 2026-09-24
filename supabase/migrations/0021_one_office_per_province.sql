-- ---------------------------------------------------------------------------
-- One office per province takes applications; search covers all of Spain.
--
-- Search used to start with "pick your province", then list every office in
-- it. In practice each province has exactly one office that receives and
-- files temporary-protection applications; the others in the official list
-- (CREADE centres, secondary comisarías, island offices) either redirect
-- there or no longer take applications (see the Villarreal and Torrevieja
-- community briefs). Listing them as equal results sent people to the wrong
-- door, and the province step made people choose before they could compare.
--
-- `accepts_applications` defaults to true so a newly added office shows up
-- in search without anyone remembering to set a flag; the offices below are
-- the exceptions. They stay published — their pages, reports and community
-- briefs remain reachable — they just are not offered as a place to apply.
-- ---------------------------------------------------------------------------
alter table locations add column accepts_applications boolean not null default true;

update locations set accepts_applications = false
where id in (
  'comisaria-ferrol', 'comisaria-santiago-de-compostela',   -- A Coruña → A Coruña
  'comisaria-ibiza', 'comisaria-mahon',                     -- Illes Balears → Palma de Mallorca
  'comisaria-arrecife', 'comisaria-puerto-del-rosario',     -- Las Palmas → Las Palmas de Gran Canaria
  'comisaria-tui', 'comisaria-vigo',                        -- Pontevedra → Pontevedra
  'comisaria-reus', 'comisaria-tortosa',                    -- Tarragona → Tarragona
  'creade-torrevieja',                                      -- Alicante → Alicante
  'comisaria-gijon',                                        -- Asturias → Oviedo
  'creade-barcelona',                                       -- Barcelona → Barcelona
  'comisaria-algeciras',                                    -- Cádiz → Cádiz
  'comisaria-villarreal',                                   -- Castellón → Castellón de la Plana
  'creade-pozuelo',                                         -- Madrid → Comisaría Pozuelo de Alarcón
  'comisaria-tudela'                                        -- Navarra → Pamplona
);

-- Province is now optional: null searches every province. Only offices that
-- take applications are returned, so with no province this is one result per
-- province, ranked by the same "people with your documents succeeded here"
-- ordering as before.
create or replace function fn_search_results(
  p_province_slug   text,
  p_procedure_code  text,
  p_user_docs       text[] default '{}',
  p_military_filter text default null
) returns table (location_id text, data jsonb)
  language sql stable security definer set search_path = public as $$
  with scored as (
    select l.id,
      fn_location_page_data(l.id, p_procedure_code, p_user_docs, p_military_filter) as data
    from locations l
    where (p_province_slug is null or l.province_slug = p_province_slug)
      and l.moderation_status = 'published'
      and l.accepts_applications
  )
  select s.id, s.data
  from scored s
  join locations l on l.id = s.id
  order by
    (s.data->>'fresh_matching_count')::int desc,
    (s.data->>'latest_matching_date')::date desc nulls last,
    l.province asc;
$$;
