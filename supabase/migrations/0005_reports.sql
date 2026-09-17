create table reports (
  id                            uuid primary key default gen_random_uuid(),
  location_id                   text not null,
  procedure_code                text not null,
  user_id                       uuid not null references profiles(id),
  event_date                    date not null,
  outcome                       report_outcome_t not null,
  appointment_type              appointment_type_t,
  earliest_appointment_offered  date,
  time_at_office                time_at_office_t,
  people_count                  int check (people_count between 1 and 10),
  requested_list_complete       boolean not null,
  military_obligations_apply    military_obligations_t,
  comment                       text check (comment is null or char_length(comment) <= 1000),
  moderation_status             moderation_status_t not null default 'published',
  created_at                    timestamptz not null default now(),
  updated_at                    timestamptz not null default now(),
  foreign key (location_id, procedure_code) references location_procedures (location_id, procedure_code),
  constraint chk_event_date_not_future
    check (event_date <= (now() at time zone 'Europe/Madrid')::date),
  constraint chk_event_date_not_before_program
    check (event_date >= date '2022-03-04'),
  constraint uq_report_per_user_location_date
    unique (user_id, location_id, procedure_code, event_date)
);

create index idx_reports_location on reports (location_id, procedure_code) where moderation_status = 'published';
create index idx_reports_user on reports (user_id);

create or replace function reports_set_updated_at() returns trigger
  language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger trg_reports_updated_at before update on reports
  for each row execute function reports_set_updated_at();

-- Anti-spam: MAX_REPORTS_PER_USER_PER_DAY, calendar day in Europe/Madrid, counted by submission time.
create or replace function reports_enforce_daily_limit() returns trigger
  language plpgsql as $$
declare
  v_count int;
  v_limit int := app_config_int('max_reports_per_user_per_day');
begin
  select count(*) into v_count
  from reports
  where user_id = new.user_id
    and (created_at at time zone 'Europe/Madrid')::date = (now() at time zone 'Europe/Madrid')::date;
  if v_count >= v_limit then
    raise exception 'daily_report_limit_reached' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger trg_reports_daily_limit before insert on reports
  for each row execute function reports_enforce_daily_limit();

-- "at least 1 row in report_documents" — deferred to commit. In practice writes go
-- through submit_report() below, which inserts both in one transaction; this trigger
-- is a DB-level backstop against any other insert path.
create or replace function reports_require_documents() returns trigger
  language plpgsql as $$
declare
  v_count int;
begin
  select count(*) into v_count from report_documents where report_id = new.id;
  if v_count = 0 then
    raise exception 'report_requires_at_least_one_document' using errcode = 'P0001';
  end if;
  return null;
end;
$$;
create constraint trigger trg_reports_require_documents
  after insert on reports
  deferrable initially deferred
  for each row execute function reports_require_documents();

create table report_documents (
  report_id      uuid not null references reports(id) on delete cascade,
  document_code  text not null references document_types(code),
  status         document_status_t not null,
  primary key (report_id, document_code)
);

-- "other" with status requested/requested_missing requires the report comment to name it.
create or replace function report_documents_require_comment_for_other() returns trigger
  language plpgsql as $$
declare
  v_comment text;
begin
  if new.document_code = 'other' and new.status in ('requested', 'requested_missing') then
    select comment into v_comment from reports where id = new.report_id;
    if v_comment is null or length(trim(v_comment)) = 0 then
      raise exception 'other_document_requires_comment' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;
create trigger trg_report_documents_other_comment
  before insert or update on report_documents
  for each row execute function report_documents_require_comment_for_other();

create table comments (
  id                 uuid primary key default gen_random_uuid(),
  report_id          uuid not null references reports(id) on delete cascade,
  user_id            uuid not null references profiles(id),
  body               text not null check (char_length(body) <= 1000 and length(trim(body)) > 0),
  moderation_status  moderation_status_t not null default 'published',
  created_at         timestamptz not null default now()
);

create table flags (
  id           uuid primary key default gen_random_uuid(),
  target_type  flag_target_t not null,
  target_id    uuid not null,
  user_id      uuid not null references profiles(id),
  reason       text,
  created_at   timestamptz not null default now(),
  unique (user_id, target_type, target_id)
);

-- SECURITY DEFINER: this is a system-triggered state change (3 distinct
-- flaggers), not a moderator action, so it must bypass the moderator-only RLS
-- policy on reports/comments UPDATE rather than run as the flagging user.
create or replace function flags_promote_to_flagged() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  v_distinct_flaggers int;
begin
  select count(distinct user_id) into v_distinct_flaggers
  from flags where target_type = new.target_type and target_id = new.target_id;

  if v_distinct_flaggers >= 3 then
    if new.target_type = 'report' then
      update reports set moderation_status = 'flagged'
        where id = new.target_id and moderation_status = 'published';
    elsif new.target_type = 'comment' then
      update comments set moderation_status = 'flagged'
        where id = new.target_id and moderation_status = 'published';
    end if;
  end if;
  return new;
end;
$$;
create trigger trg_flags_promote after insert on flags
  for each row execute function flags_promote_to_flagged();

-- ---------------------------------------------------------------------------
-- submit_report: the only write path for reports + report_documents.
--
-- SECURITY INVOKER (default) is essential here: this function runs with the
-- privileges and RLS of the calling role (authenticated), so the normal
-- reports_insert_own / report_documents_insert_own RLS policies still apply —
-- a user cannot use this RPC to write a report for someone else. It exists
-- only so both inserts happen in a single transaction (a plain PostgREST
-- .insert() call is its own transaction, which would defeat the deferred
-- "at least one document" trigger above).
-- ---------------------------------------------------------------------------
create or replace function submit_report(
  p_location_id                  text,
  p_procedure_code                text,
  p_event_date                    date,
  p_outcome                       report_outcome_t,
  p_requested_list_complete       boolean,
  p_documents                     jsonb, -- [{"document_code": "...", "status": "requested"}, ...]
  p_appointment_type              appointment_type_t default null,
  p_earliest_appointment_offered  date default null,
  p_time_at_office                time_at_office_t default null,
  p_people_count                  int default null,
  p_military_obligations_apply    military_obligations_t default null,
  p_comment                       text default null
) returns uuid
  language plpgsql as $$
declare
  v_report_id uuid;
  v_doc jsonb;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if jsonb_array_length(p_documents) = 0 then
    raise exception 'report_requires_at_least_one_document' using errcode = 'P0001';
  end if;

  insert into reports (
    location_id, procedure_code, user_id, event_date, outcome,
    appointment_type, earliest_appointment_offered, time_at_office, people_count,
    requested_list_complete, military_obligations_apply, comment
  ) values (
    p_location_id, p_procedure_code, auth.uid(), p_event_date, p_outcome,
    p_appointment_type, p_earliest_appointment_offered, p_time_at_office, p_people_count,
    p_requested_list_complete, p_military_obligations_apply, p_comment
  ) returning id into v_report_id;

  for v_doc in select * from jsonb_array_elements(p_documents) loop
    insert into report_documents (report_id, document_code, status)
    values (v_report_id, v_doc->>'document_code', (v_doc->>'status')::document_status_t);
  end loop;

  return v_report_id;
end;
$$;

grant execute on function submit_report(
  text, text, date, report_outcome_t, boolean, jsonb,
  appointment_type_t, date, time_at_office_t, int, military_obligations_t, text
) to authenticated;
