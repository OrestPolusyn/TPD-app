-- Lets a signed-in user edit and delete their own reports, comments and
-- pending suggestions. Previously only a moderator could UPDATE
-- moderation_status, and nothing could DELETE at all except account deletion
-- running server-side with the service role (0006_rls.sql said so explicitly).
--
-- All SECURITY INVOKER, following this repo's own established pattern
-- (submit_new_location in 0008): RLS + column-scoped grants are the real gate,
-- not a SECURITY DEFINER bypass — reserved elsewhere in this codebase for
-- genuinely cross-user reads/writes (check_duplicate_location,
-- flags_promote_to_flagged), which this is not.

-- ---------- reports: owner update (mutable fields only) + delete ----------
-- location_id/procedure_code/user_id are deliberately not grantable: editing
-- moves a report's *content*, never which location or user it belongs to.
grant update (
  event_date, outcome, appointment_type, earliest_appointment_offered,
  time_at_office, people_count, requested_list_complete,
  military_obligations_apply, comment
) on reports to authenticated;
grant delete on reports to authenticated;

create policy reports_update_own on reports for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy reports_delete_own on reports for delete to authenticated
  using (user_id = auth.uid());

-- ---------- report_documents: owner delete (insert already existed) ----------
-- Editing a report's document list is delete-all-then-reinsert (see
-- update_own_report below); report_documents_insert_own already covers the
-- reinsert half.
grant delete on report_documents to authenticated;

create policy report_documents_delete_own on report_documents for delete to authenticated
  using (exists (
    select 1 from reports r where r.id = report_documents.report_id and r.user_id = auth.uid()
  ));

-- ---------- comments: owner update (body only) + delete ----------
grant update (body) on comments to authenticated;
grant delete on comments to authenticated;

create policy comments_update_own on comments for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy comments_delete_own on comments for delete to authenticated
  using (user_id = auth.uid());

-- ---------- location_suggestions: owner update/delete while still pending ----------
-- Once a moderator has approved or rejected one, it's a record of that
-- decision, not a draft — locked from further owner edits.
grant update (proposed_value) on location_suggestions to authenticated;
grant delete on location_suggestions to authenticated;

create policy suggestions_update_own_pending on location_suggestions for update to authenticated
  using (user_id = auth.uid() and status = 'pending')
  with check (user_id = auth.uid() and status = 'pending');

create policy suggestions_delete_own_pending on location_suggestions for delete to authenticated
  using (user_id = auth.uid() and status = 'pending');

-- ---------------------------------------------------------------------------
-- update_own_report: the only edit path for reports + report_documents,
-- mirroring submit_report's own reasoning in 0005 — replacing the document
-- list is delete-then-insert, which needs one transaction, which a plain
-- PostgREST call sequence does not give you.
--
-- SECURITY INVOKER (default): runs with the caller's RLS and the grants
-- above, so it can only ever touch the calling user's own rows.
-- ---------------------------------------------------------------------------
create or replace function update_own_report(
  p_report_id                     uuid,
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
) returns void
  language plpgsql as $$
declare
  v_doc jsonb;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if jsonb_array_length(p_documents) = 0 then
    raise exception 'report_requires_at_least_one_document' using errcode = 'P0001';
  end if;

  update reports set
    event_date = p_event_date,
    outcome = p_outcome,
    requested_list_complete = p_requested_list_complete,
    appointment_type = p_appointment_type,
    earliest_appointment_offered = p_earliest_appointment_offered,
    time_at_office = p_time_at_office,
    people_count = p_people_count,
    military_obligations_apply = p_military_obligations_apply,
    comment = p_comment
  where id = p_report_id and user_id = auth.uid();

  if not found then
    raise exception 'not_found_or_forbidden' using errcode = 'P0001';
  end if;

  delete from report_documents where report_id = p_report_id;

  for v_doc in select * from jsonb_array_elements(p_documents) loop
    insert into report_documents (report_id, document_code, status)
    values (p_report_id, v_doc->>'document_code', (v_doc->>'status')::document_status_t);
  end loop;
end;
$$;

grant execute on function update_own_report(
  uuid, date, report_outcome_t, boolean, jsonb,
  appointment_type_t, date, time_at_office_t, int, military_obligations_t, text
) to authenticated;

-- Postgres functions are PUBLIC-executable by default (a gap this schema's
-- other RPCs already share — submit_report, submit_new_location,
-- check_duplicate_location); harmless here since the internal UPDATE still
-- needs the grants/RLS above, but closed anyway rather than adding another.
revoke execute on function update_own_report(
  uuid, date, report_outcome_t, boolean, jsonb,
  appointment_type_t, date, time_at_office_t, int, military_obligations_t, text
) from public, anon;
