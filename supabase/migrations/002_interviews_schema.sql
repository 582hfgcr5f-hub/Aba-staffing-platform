create table if not exists public.interviews (
  id uuid primary key default gen_random_uuid(),
  candidate_name text not null,
  phone text,
  email text,
  city text not null,
  state text not null,
  zip text,
  scheduled_at timestamptz not null,
  status text not null default 'Scheduled',
  experience text,
  desired_pay text,
  employment_type text,
  availability text,
  available_days text[] not null default '{}',
  preferred_start_time text,
  preferred_end_time text,
  travel_radius_minutes integer,
  centralreach_experience text,
  preferred_contact text,
  rating text,
  recruiter_notes text,
  technician_id uuid references public.technicians(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  dedupe_key text generated always as (
    lower(trim(candidate_name)) || '|' ||
    lower(trim(coalesce(email, ''))) || '|' ||
    regexp_replace(coalesce(phone, ''), '\D', '', 'g') || '|' ||
    public.normalize_state_code(state)
  ) stored,
  constraint interviews_state_normalized check (state = public.normalize_state_code(state)),
  constraint interviews_status_check check (status in ('Scheduled', 'Completed', 'Follow Up', 'Offer', 'Hired', 'Declined', 'No Show'))
);

create table if not exists public.interview_events (
  id uuid primary key default gen_random_uuid(),
  interview_id uuid not null references public.interviews(id) on delete cascade,
  event_type text not null,
  detail text,
  created_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists interviews_dedupe_key_idx on public.interviews (dedupe_key);
create index if not exists interviews_status_idx on public.interviews (status);
create index if not exists interviews_scheduled_at_idx on public.interviews (scheduled_at);
create index if not exists interview_events_interview_id_idx on public.interview_events (interview_id, created_at desc);

grant select, insert, update, delete on table public.interviews to anon, authenticated;
grant select, insert, update, delete on table public.interview_events to anon, authenticated;

alter table public.interviews enable row level security;
alter table public.interview_events enable row level security;

drop policy if exists interviews_public_access on public.interviews;
create policy interviews_public_access on public.interviews
for all to anon, authenticated using (true) with check (true);

drop policy if exists interview_events_public_access on public.interview_events;
create policy interview_events_public_access on public.interview_events
for all to anon, authenticated using (true) with check (true);

drop trigger if exists interviews_set_updated_at on public.interviews;
create trigger interviews_set_updated_at
before update on public.interviews
for each row execute function public.set_updated_at();