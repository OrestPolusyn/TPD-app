-- One Postgres function implementing all of docs/SPEC.md's "Matching" section,
-- returning everything a location page (and, via fn_search_results, a results
-- card) needs. Callable by anon; reads only published (or flagged-but-visible)
-- data, never anything gated behind auth.
create or replace function fn_location_page_data(
  p_location_id       text,
  p_procedure_code    text,
  p_user_docs         text[] default '{}',
  p_military_filter   text default null   -- only meaningfully used by fn_search_results
) returns jsonb
  language plpgsql stable security definer set search_path = public as $$
declare
  v_stale_days int := app_config_int('stale_days');
  v_badge_min  int := app_config_int('min_reports_for_badge');
  v_max_policy_date date;
  v_effective_u text[] := array_remove(p_user_docs, 'passport_photos');
  v_result jsonb;
begin
  select max(effective_date) into v_max_policy_date
  from policy_changes where procedure_code = p_procedure_code;

  with base as (
    select
      r.*,
      coalesce(array_agg(rd.document_code) filter (
        where rd.status in ('requested', 'requested_missing') and rd.document_code <> 'passport_photos'
      ), '{}') as r_docs,
      (r.outcome in ('protection_granted', 'application_accepted_pending')) as is_successful,
      (r.event_date >= (now() at time zone 'Europe/Madrid')::date - v_stale_days
        and (v_max_policy_date is null or r.event_date >= v_max_policy_date)) as is_fresh,
      (v_max_policy_date is not null and r.event_date < v_max_policy_date) as is_policy_outdated
    from reports r
    left join report_documents rd on rd.report_id = r.id
    where r.location_id = p_location_id
      and r.procedure_code = p_procedure_code
      and r.moderation_status = 'published'
    group by r.id
  ),
  classified as (
    select b.*,
      case
        when not is_successful then 'unsuccessful'
        when not requested_list_complete then 'incomplete'
        when r_docs <@ v_effective_u then 'match'
        else 'more_docs'
      end as klass
    from base b
  ),
  policy as (
    select pc.effective_date, pc.title_uk, pc.source_url
    from policy_changes pc
    where pc.procedure_code = p_procedure_code
    order by pc.effective_date desc
    limit 1
  ),
  not_requested_agg as (
    -- All *successful* reports feed this (match, incomplete, more_docs) — only
    -- unsuccessful reports are excluded (spec: "fresh successful reports").
    select
      rd.document_code,
      count(distinct c.user_id) as user_count
    from classified c
    join report_documents rd on rd.report_id = c.id
    where rd.status = 'not_requested'
      and c.is_fresh
      and c.klass in ('match', 'incomplete', 'more_docs')
      and (
        rd.document_code not in ('military_document_paper', 'military_document_reserve_plus', 'passport_exit_stamp')
        or c.military_obligations_apply = 'yes'
      )
    group by rd.document_code
  ),
  walk_in as (
    select count(distinct user_id) as user_count
    from classified
    where is_fresh and appointment_type = 'walk_in'
  ),
  earliest as (
    select earliest_appointment_offered, count(distinct user_id) as user_count
    from classified
    where is_fresh and earliest_appointment_offered is not null
    group by earliest_appointment_offered
    order by earliest_appointment_offered desc
    limit 1
  )
  select jsonb_build_object(
    'matches', (select coalesce(jsonb_agg(jsonb_build_object(
        'report_id', id, 'event_date', event_date, 'outcome', outcome,
        'is_fresh', is_fresh, 'is_policy_outdated', is_policy_outdated
      ) order by event_date desc), '[]'::jsonb) from classified where klass = 'match'),
    'incomplete', (select coalesce(jsonb_agg(jsonb_build_object(
        'report_id', id, 'event_date', event_date, 'is_fresh', is_fresh
      ) order by event_date desc), '[]'::jsonb) from classified where klass = 'incomplete'),
    'more_docs', (select coalesce(jsonb_agg(jsonb_build_object(
        'report_id', id, 'event_date', event_date, 'is_fresh', is_fresh,
        'extra_docs', array(select unnest(r_docs) except select unnest(v_effective_u))
      ) order by event_date desc), '[]'::jsonb) from classified where klass = 'more_docs'),
    'unsuccessful', (select coalesce(jsonb_agg(jsonb_build_object(
        'report_id', id, 'event_date', event_date, 'outcome', outcome, 'is_fresh', is_fresh
      ) order by event_date desc), '[]'::jsonb) from classified where klass = 'unsuccessful'),
    'not_requested', (select coalesce(jsonb_agg(jsonb_build_object(
        'document_code', document_code, 'user_count', user_count,
        'highlighted', user_count >= v_badge_min
      )), '[]'::jsonb) from not_requested_agg),
    'walk_in_count', (select coalesce(user_count, 0) from walk_in),
    'walk_in_highlighted', (select coalesce(user_count, 0) >= v_badge_min from walk_in),
    'earliest_appointment', (select to_jsonb(earliest.*) from earliest),
    'fresh_matching_count', (
      select count(distinct id) from classified
      where klass = 'match' and is_fresh
        and (p_military_filter is distinct from 'yes' or military_obligations_apply is distinct from 'no')
    ),
    'latest_matching_date', (
      select max(event_date) from classified
      where klass = 'match' and is_fresh
        and (p_military_filter is distinct from 'yes' or military_obligations_apply is distinct from 'no')
    ),
    'fresh_unsuccessful_count', (select count(distinct id) from classified where klass = 'unsuccessful' and is_fresh),
    'policy_change', (select to_jsonb(policy.*) from policy),
    -- Flagged reports: still shown on the page collapsed as "На перевірці", but
    -- excluded from every count/match above (the `classified` CTE only sees
    -- moderation_status = 'published' reports).
    'flagged_count', (
      select count(*) from reports
      where location_id = p_location_id and procedure_code = p_procedure_code
        and moderation_status = 'flagged'
    )
  ) into v_result;

  return v_result;
end;
$$;

grant execute on function fn_location_page_data(text, text, text[], text) to anon, authenticated;

-- Thin orchestration around fn_location_page_data: fetches every published
-- location in a province (including zero-report ones, per spec) and sorts by
-- the spec's 3-key order. Does not reimplement matching logic.
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
    where l.province_slug = p_province_slug and l.moderation_status = 'published'
  )
  select s.id, s.data
  from scored s
  join locations l on l.id = s.id
  order by
    (s.data->>'fresh_matching_count')::int desc,
    (s.data->>'latest_matching_date')::date desc nulls last,
    l.name asc;
$$;

grant execute on function fn_search_results(text, text, text[], text) to anon, authenticated;
