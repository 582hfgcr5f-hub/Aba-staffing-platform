insert into storage.buckets (id, name, public)
values ('interview-resumes', 'interview-resumes', false)
on conflict (id) do update set public = false;

drop policy if exists interview_resumes_public_select on storage.objects;
drop policy if exists interview_resumes_public_insert on storage.objects;
drop policy if exists interview_resumes_public_update on storage.objects;
drop policy if exists interview_resumes_public_delete on storage.objects;

drop policy if exists interview_resumes_client_select on storage.objects;
create policy interview_resumes_client_select
on storage.objects for select to anon, authenticated
using (bucket_id = 'interview-resumes');

drop policy if exists interview_resumes_client_insert on storage.objects;
create policy interview_resumes_client_insert
on storage.objects for insert to anon, authenticated
with check (bucket_id = 'interview-resumes');

drop policy if exists interview_resumes_client_update on storage.objects;
create policy interview_resumes_client_update
on storage.objects for update to anon, authenticated
using (bucket_id = 'interview-resumes')
with check (bucket_id = 'interview-resumes');

drop policy if exists interview_resumes_client_delete on storage.objects;
create policy interview_resumes_client_delete
on storage.objects for delete to anon, authenticated
using (bucket_id = 'interview-resumes');