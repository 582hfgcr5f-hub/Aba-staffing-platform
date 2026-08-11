alter table public.technicians
  add column if not exists profile_photo_path text,
  add column if not exists profile_photo_name text;

alter table public.cases
  add column if not exists preferred_contact text,
  add column if not exists bcba_phone text,
  add column if not exists bcba_email text;

create table if not exists public.technician_notes (
  id uuid primary key default gen_random_uuid(),
  technician_id uuid not null references public.technicians(id) on delete cascade,
  note text not null,
  case_id uuid references public.cases(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.case_notes (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  note text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.operational_activity (
  id uuid primary key default gen_random_uuid(),
  technician_id uuid references public.technicians(id) on delete cascade,
  case_id uuid references public.cases(id) on delete cascade,
  event_type text not null,
  detail text,
  created_at timestamptz not null default timezone('utc', now()),
  constraint operational_activity_subject_check check (technician_id is not null or case_id is not null)
);