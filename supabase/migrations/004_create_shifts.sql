create table if not exists public.shifts (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references public.hospitals(id) on delete restrict,
  department_id uuid references public.departments(id) on delete set null,
  assigned_user_id uuid references auth.users(id) on delete set null,
  shift_type varchar(80),
  start_at timestamptz not null,
  end_at timestamptz not null,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists shifts_hospital_id_idx on public.shifts (hospital_id);
create index if not exists shifts_department_id_idx on public.shifts (department_id);
create index if not exists shifts_assigned_user_id_idx on public.shifts (assigned_user_id);
create index if not exists shifts_start_at_idx on public.shifts (start_at);

drop trigger if exists set_shifts_updated_at on public.shifts;
create trigger set_shifts_updated_at
before update on public.shifts
for each row execute function public.set_updated_at();
