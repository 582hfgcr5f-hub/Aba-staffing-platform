-- REVIEW BEFORE APPLYING: this migration removes anonymous production access.
-- The application currently uses a shared staff workspace, so authenticated
-- users retain staff-wide access. Add organization/user ownership before
-- introducing tenant-specific authorization rules.

revoke all on schema public from anon;
revoke all on all tables in schema public from anon;
grant usage on schema public to authenticated;
grant select, insert, update, delete on table public.technicians, public.cases, public.assignments, public.technician_availability, public.interviews, public.interview_events, public.technician_notes, public.case_notes, public.operational_activity to authenticated;

alter table public.technicians enable row level security;
alter table public.cases enable row level security;
alter table public.assignments enable row level security;
alter table public.technician_availability enable row level security;
alter table public.interviews enable row level security;
alter table public.interview_events enable row level security;
alter table public.technician_notes enable row level security;
alter table public.case_notes enable row level security;
alter table public.operational_activity enable row level security;

drop policy if exists technicians_public_access on public.technicians;
drop policy if exists cases_public_access on public.cases;
drop policy if exists assignments_public_access on public.assignments;
drop policy if exists technician_availability_public_access on public.technician_availability;
drop policy if exists interviews_public_access on public.interviews;
drop policy if exists interview_events_public_access on public.interview_events;

create policy technicians_authenticated_access on public.technicians for all to authenticated using (true) with check (true);
create policy cases_authenticated_access on public.cases for all to authenticated using (true) with check (true);
create policy assignments_authenticated_access on public.assignments for all to authenticated using (true) with check (true);
create policy technician_availability_authenticated_access on public.technician_availability for all to authenticated using (true) with check (true);
create policy interviews_authenticated_access on public.interviews for all to authenticated using (true) with check (true);
create policy interview_events_authenticated_access on public.interview_events for all to authenticated using (true) with check (true);
create policy technician_notes_authenticated_access on public.technician_notes for all to authenticated using (true) with check (true);
create policy case_notes_authenticated_access on public.case_notes for all to authenticated using (true) with check (true);
create policy operational_activity_authenticated_access on public.operational_activity for all to authenticated using (true) with check (true);

insert into storage.buckets (id, name, public)
values
  ('interview-resumes', 'interview-resumes', false),
  ('technician-files', 'technician-files', false)
on conflict (id) do update set public = false;

drop policy if exists interview_resumes_public_select on storage.objects;
drop policy if exists interview_resumes_public_insert on storage.objects;
drop policy if exists interview_resumes_public_update on storage.objects;
drop policy if exists interview_resumes_public_delete on storage.objects;
drop policy if exists interview_resumes_client_select on storage.objects;
drop policy if exists interview_resumes_client_insert on storage.objects;
drop policy if exists interview_resumes_client_update on storage.objects;
drop policy if exists interview_resumes_client_delete on storage.objects;
drop policy if exists interview_resumes_authenticated_select on storage.objects;
drop policy if exists interview_resumes_authenticated_insert on storage.objects;
drop policy if exists interview_resumes_authenticated_update on storage.objects;
drop policy if exists interview_resumes_authenticated_delete on storage.objects;
drop policy if exists technician_files_authenticated_select on storage.objects;
drop policy if exists technician_files_authenticated_insert on storage.objects;
drop policy if exists technician_files_authenticated_update on storage.objects;
drop policy if exists technician_files_authenticated_delete on storage.objects;

create policy interview_resumes_authenticated_select on storage.objects for select to authenticated using (bucket_id = 'interview-resumes');
create policy interview_resumes_authenticated_insert on storage.objects for insert to authenticated with check (bucket_id = 'interview-resumes');
create policy interview_resumes_authenticated_update on storage.objects for update to authenticated using (bucket_id = 'interview-resumes') with check (bucket_id = 'interview-resumes');
create policy interview_resumes_authenticated_delete on storage.objects for delete to authenticated using (bucket_id = 'interview-resumes');
create policy technician_files_authenticated_select on storage.objects for select to authenticated using (bucket_id = 'technician-files');
create policy technician_files_authenticated_insert on storage.objects for insert to authenticated with check (bucket_id = 'technician-files');
create policy technician_files_authenticated_update on storage.objects for update to authenticated using (bucket_id = 'technician-files') with check (bucket_id = 'technician-files');
create policy technician_files_authenticated_delete on storage.objects for delete to authenticated using (bucket_id = 'technician-files');

delete from public.cases
where client_name = 'Avery Example'
  and address = '123 Example Ave'
  and city = 'Albuquerque'
  and state = 'NM';

delete from public.technicians
where email = 'jordan@example.com'
  and name = 'Jordan Example';