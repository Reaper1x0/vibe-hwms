create table if not exists public.handovers (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references public.hospitals(id) on delete restrict,
  department_id uuid references public.departments(id) on delete set null,
  patient_id uuid references public.patients(id) on delete set null,
  shift_id uuid references public.shifts(id) on delete set null,
  from_user_id uuid not null references auth.users(id) on delete restrict,
  to_user_id uuid references auth.users(id) on delete set null,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists handovers_hospital_id_idx on public.handovers (hospital_id);
create index if not exists handovers_department_id_idx on public.handovers (department_id);
create index if not exists handovers_patient_id_idx on public.handovers (patient_id);
create index if not exists handovers_shift_id_idx on public.handovers (shift_id);
create index if not exists handovers_from_user_id_idx on public.handovers (from_user_id);
create index if not exists handovers_to_user_id_idx on public.handovers (to_user_id);

drop trigger if exists set_handovers_updated_at on public.handovers;
create trigger set_handovers_updated_at
before update on public.handovers
for each row execute function public.set_updated_at();
