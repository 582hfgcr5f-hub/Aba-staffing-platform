create extension if not exists pgcrypto;

create or replace function public.normalize_state_code(input text)
returns text
language sql
immutable
as $$
  select case
    when input is null then null
    when regexp_replace(lower(input), '[^a-z0-9]', '', 'g') in ('nm', 'newmexico') then 'NM'
    when regexp_replace(lower(input), '[^a-z0-9]', '', 'g') in ('ia', 'iowa') then 'IA'
    else upper(trim(input))
  end
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.technicians (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  city text not null,
  state text not null,
  zip text,
  status text not null,
  employment_type text,
  experience text,
  preferred_start_time text,
  preferred_end_time text,
  travel_radius_minutes integer,
  desired_pay text,
  centralreach_experience text,
  preferred_contact text,
  rating text,
  notes text,
  hours text,
  available_start_date text,
  certifications text[] not null default '{}',
  availability text,
  recruiter_notes text,
  documents jsonb not null default '[]'::jsonb,
  latitude double precision,
  longitude double precision,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  dedupe_key text generated always as (
    lower(trim(name)) || '|' ||
    lower(trim(coalesce(email, ''))) || '|' ||
    regexp_replace(coalesce(phone, ''), '\D', '', 'g') || '|' ||
    public.normalize_state_code(state)
  ) stored,
  constraint technicians_state_normalized check (state = public.normalize_state_code(state))
);

create unique index if not exists technicians_dedupe_key_idx on public.technicians (dedupe_key);
create index if not exists technicians_state_idx on public.technicians (state);
create index if not exists technicians_status_idx on public.technicians (status);

create table if not exists public.cases (
  id uuid primary key default gen_random_uuid(),
  client_name text not null,
  address text,
  city text not null,
  state text not null,
  zip text,
  status text not null,
  required_days text[] not null default '{}',
  start_time text,
  end_time text,
  start_date text,
  bcba text,
  notes text,
  contact_name text,
  phone text,
  email text,
  preferred_technician_gender text,
  urgency text,
  required_schedule_text text,
  latitude double precision,
  longitude double precision,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  dedupe_key text generated always as (
    lower(trim(client_name)) || '|' ||
    lower(trim(coalesce(address, ''))) || '|' ||
    lower(trim(city)) || '|' ||
    public.normalize_state_code(state) || '|' ||
    coalesce(zip, '')
  ) stored,
  constraint cases_state_normalized check (state = public.normalize_state_code(state))
);

create unique index if not exists cases_dedupe_key_idx on public.cases (dedupe_key);
create index if not exists cases_state_idx on public.cases (state);
create index if not exists cases_status_idx on public.cases (status);

create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  technician_id uuid not null references public.technicians(id) on delete cascade,
  case_id uuid not null references public.cases(id) on delete cascade,
  status text not null,
  assigned_at timestamptz not null default timezone('utc', now()),
  started_at timestamptz,
  unassigned_at timestamptz,
  drive_time_minutes integer,
  drive_distance_miles double precision,
  notes text,
  assigned_by text,
  required_schedule_at_assignment text,
  previous_technician_status text,
  new_technician_status text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists assignments_technician_id_idx on public.assignments (technician_id);
create index if not exists assignments_case_id_idx on public.assignments (case_id);
create index if not exists assignments_status_idx on public.assignments (status);
create unique index if not exists assignments_active_unique_idx on public.assignments (technician_id, case_id)
where status <> 'Unassigned';

create table if not exists public.technician_availability (
  id uuid primary key default gen_random_uuid(),
  technician_id uuid not null references public.technicians(id) on delete cascade,
  day_of_week smallint not null,
  start_time text,
  end_time text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint technician_availability_day_check check (day_of_week between 0 and 6)
);

create unique index if not exists technician_availability_unique_idx
on public.technician_availability (technician_id, day_of_week, start_time, end_time);
create index if not exists technician_availability_technician_id_idx on public.technician_availability (technician_id);

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on table public.technicians to anon, authenticated;
grant select, insert, update, delete on table public.cases to anon, authenticated;
grant select, insert, update, delete on table public.assignments to anon, authenticated;
grant select, insert, update, delete on table public.technician_availability to anon, authenticated;

alter table public.technicians enable row level security;
alter table public.cases enable row level security;
alter table public.assignments enable row level security;
alter table public.technician_availability enable row level security;

drop policy if exists technicians_public_access on public.technicians;
create policy technicians_public_access on public.technicians
for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists cases_public_access on public.cases;
create policy cases_public_access on public.cases
for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists assignments_public_access on public.assignments;
create policy assignments_public_access on public.assignments
for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists technician_availability_public_access on public.technician_availability;
create policy technician_availability_public_access on public.technician_availability
for all
to anon, authenticated
using (true)
with check (true);

drop trigger if exists technicians_set_updated_at on public.technicians;
create trigger technicians_set_updated_at
before update on public.technicians
for each row
execute function public.set_updated_at();

drop trigger if exists cases_set_updated_at on public.cases;
create trigger cases_set_updated_at
before update on public.cases
for each row
execute function public.set_updated_at();

drop trigger if exists assignments_set_updated_at on public.assignments;
create trigger assignments_set_updated_at
before update on public.assignments
for each row
execute function public.set_updated_at();

drop trigger if exists technician_availability_set_updated_at on public.technician_availability;
create trigger technician_availability_set_updated_at
before update on public.technician_availability
for each row
execute function public.set_updated_at();