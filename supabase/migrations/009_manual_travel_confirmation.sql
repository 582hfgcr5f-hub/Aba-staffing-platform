create table if not exists public.travel_confirmations (
  id uuid primary key default gen_random_uuid(),
  technician_id uuid not null references public.technicians(id) on delete cascade,
  case_id uuid not null references public.cases(id) on delete cascade,
  status text not null default 'Manually Confirmed',
  confirmed_at timestamptz not null default now(),
  confirmed_by text,
  note text,
  unique (technician_id, case_id)
);

alter table public.travel_confirmations enable row level security;

drop policy if exists travel_confirmations_authenticated_access on public.travel_confirmations;
create policy travel_confirmations_authenticated_access on public.travel_confirmations for all to authenticated using (true) with check (true);

grant select, insert, update, delete on table public.travel_confirmations to authenticated;
