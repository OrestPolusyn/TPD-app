alter table profiles enable row level security;
alter table procedures enable row level security;
alter table document_types enable row level security;
alter table locations enable row level security;
alter table location_procedures enable row level security;
alter table policy_changes enable row level security;
alter table location_suggestions enable row level security;
alter table reports enable row level security;
alter table report_documents enable row level security;
alter table comments enable row level security;
alter table flags enable row level security;

-- security definer helper to avoid RLS self-recursion on profiles
create or replace function is_moderator() returns boolean
  language sql security definer set search_path = public stable as $$
    select exists (select 1 from profiles where id = auth.uid() and role = 'moderator');
$$;

-- ---------- profiles ----------
create policy profiles_select_own on profiles for select
  using (id = auth.uid());
-- no insert/update/delete policy for anon/authenticated: profile rows are created
-- only by the server-side Telegram auth bridge (service role bypasses RLS).

-- ---------- lookup tables: public read, no client writes ----------
create policy procedures_public_read on procedures for select using (is_active);
create policy document_types_public_read on document_types for select using (is_active);
create policy location_procedures_public_read on location_procedures for select using (true);
create policy policy_changes_public_read on policy_changes for select using (true);

-- ---------- locations ----------
create policy locations_select_published on locations for select
  using (moderation_status = 'published' or created_by = auth.uid() or is_moderator());

create policy locations_insert_own_pending on locations for insert to authenticated
  with check (created_by = auth.uid() and moderation_status = 'pending');

create policy locations_moderator_update_status on locations for update to authenticated
  using (is_moderator())
  with check (is_moderator());
revoke update on locations from authenticated;
grant update (moderation_status) on locations to authenticated;

-- ---------- location_suggestions ----------
create policy suggestions_select_own on location_suggestions for select
  using (user_id = auth.uid() or is_moderator());

create policy suggestions_insert_own on location_suggestions for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending');

-- ---------- reports ----------
create policy reports_select_published_or_own on reports for select
  using (moderation_status in ('published', 'flagged') or user_id = auth.uid() or is_moderator());

create policy reports_insert_own on reports for insert to authenticated
  with check (user_id = auth.uid() and moderation_status = 'published');

create policy reports_moderator_update on reports for update to authenticated
  using (is_moderator())
  with check (is_moderator());
revoke update on reports from authenticated;
grant update (moderation_status) on reports to authenticated;
-- no delete policy for authenticated: account deletion runs server-side with the
-- service role (constraint: service-role key never reaches the client anyway).

-- ---------- report_documents ----------
create policy report_documents_select on report_documents for select
  using (exists (
    select 1 from reports r
    where r.id = report_documents.report_id
      and (r.moderation_status in ('published', 'flagged') or r.user_id = auth.uid() or is_moderator())
  ));

create policy report_documents_insert_own on report_documents for insert to authenticated
  with check (exists (
    select 1 from reports r where r.id = report_documents.report_id and r.user_id = auth.uid()
  ));

-- ---------- comments ----------
create policy comments_select_published_or_own on comments for select
  using (moderation_status in ('published', 'flagged') or user_id = auth.uid() or is_moderator());

create policy comments_insert_own on comments for insert to authenticated
  with check (user_id = auth.uid() and moderation_status = 'published');

create policy comments_moderator_update on comments for update to authenticated
  using (is_moderator())
  with check (is_moderator());
revoke update on comments from authenticated;
grant update (moderation_status) on comments to authenticated;

-- ---------- flags ----------
create policy flags_select_own on flags for select
  using (user_id = auth.uid() or is_moderator());

create policy flags_insert_own on flags for insert to authenticated
  with check (user_id = auth.uid());

-- ---------- default grants ----------
-- RLS policies above are the real gate; these grants just allow the roles onto
-- the tables at all (PostgREST/Supabase already grants usage on the schema).
grant select on procedures, document_types, location_procedures, policy_changes, locations
  to anon, authenticated;
grant select on reports, report_documents, comments to anon, authenticated;
grant insert on reports, report_documents, comments, flags, location_suggestions, locations
  to authenticated;
grant select on profiles, location_suggestions, flags to authenticated;
