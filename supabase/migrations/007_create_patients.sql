create table if not exists public.patients (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references public.hospitals(id) on delete restrict,
  department_id uuid references public.departments(id) on delete set null,
  mrn varchar(80),
  full_name varchar(255) not null,
  date_of_birth date,
  gender varchar(40),
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (hospital_id, mrn)
);

create index if not exists patients_hospital_id_idx on public.patients (hospital_id);
create index if not exists patients_department_id_idx on public.patients (department_id);
create index if not exists patients_mrn_idx on public.patients (mrn);

drop trigger if exists set_patients_updated_at on public.patients;
create trigger set_patients_updated_at
before update on public.patients
for each row execute function public.set_updated_at();
