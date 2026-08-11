alter table public.interviews
  add column if not exists interview_outcome text,
  add column if not exists case_recommendation text,
  add column if not exists case_recommendation_id uuid references public.cases(id) on delete set null,
  add column if not exists resume_path text,
  add column if not exists resume_name text,
  add column if not exists resume_mime_type text,
  add column if not exists background_check_submitted boolean not null default false,
  add column if not exists background_cleared boolean not null default false,
  add column if not exists drug_screen boolean not null default false,
  add column if not exists cpr_verified boolean not null default false,
  add column if not exists rbt_license_verified boolean not null default false;

alter table public.technicians
  add column if not exists background_check_submitted boolean not null default false,
  add column if not exists background_cleared boolean not null default false,
  add column if not exists drug_screen boolean not null default false,
  add column if not exists cpr_verified boolean not null default false,
  add column if not exists rbt_license_verified boolean not null default false;

alter table public.interviews
  drop constraint if exists interviews_outcome_check,
  add constraint interviews_outcome_check check (
    interview_outcome is null or interview_outcome in ('Strong Hire', 'Hire', 'Maybe', 'Hold', 'Decline')
  );

create index if not exists interviews_case_recommendation_id_idx
  on public.interviews (case_recommendation_id);

insert into storage.buckets (id, name, public)
values ('interview-resumes', 'interview-resumes', true)
on conflict (id) do nothing;

drop policy if exists interview_resumes_public_select on storage.objects;
create policy interview_resumes_public_select
on storage.objects for select to anon, authenticated
using (bucket_id = 'interview-resumes');

drop policy if exists interview_resumes_public_insert on storage.objects;
create policy interview_resumes_public_insert
on storage.objects for insert to anon, authenticated
with check (bucket_id = 'interview-resumes');

drop policy if exists interview_resumes_public_update on storage.objects;
create policy interview_resumes_public_update
on storage.objects for update to anon, authenticated
using (bucket_id = 'interview-resumes')
with check (bucket_id = 'interview-resumes');

drop policy if exists interview_resumes_public_delete on storage.objects;
create policy interview_resumes_public_delete
on storage.objects for delete to anon, authenticated
using (bucket_id = 'interview-resumes');