-- HWMS bootstrap: migrations 001-011 + super_admin promotion
-- Run in Supabase SQL Editor or via supabase db push
-- Super_admin email: codecorelabs@gmail.com (change in file if using another email)

-- 001_create_hospitals.sql
create extension if not exists "pgcrypto";

create table if not exists public.hospitals (
  id uuid primary key default gen_random_uuid(),
  name varchar(255) not null,
  code varchar(50) not null unique,
  address text,
  city varchar(120),
  phone varchar(40),
  email varchar(255),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists hospitals_is_active_idx on public.hospitals (is_active);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_hospitals_updated_at on public.hospitals;
create trigger set_hospitals_updated_at
before update on public.hospitals
for each row execute function public.set_updated_at();

-- 002_create_departments.sql
create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references public.hospitals(id) on delete restrict,
  name varchar(255) not null,
  type varchar(80),
  hod_user_id uuid,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (hospital_id, name)
);

create index if not exists departments_hospital_id_idx on public.departments (hospital_id);
create index if not exists departments_is_active_idx on public.departments (is_active);

drop trigger if exists set_departments_updated_at on public.departments;
create trigger set_departments_updated_at
before update on public.departments
for each row execute function public.set_updated_at();

-- 003_create_profiles.sql
do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type public.user_role as enum ('super_admin', 'admin', 'hod', 'doctor', 'nurse');
  end if;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email varchar(255),
  full_name varchar(255),
  role public.user_role not null default 'doctor',
  hospital_id uuid references public.hospitals(id) on delete set null,
  department_id uuid references public.departments(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_role_idx on public.profiles (role);
create index if not exists profiles_hospital_id_idx on public.profiles (hospital_id);
create index if not exists profiles_department_id_idx on public.profiles (department_id);

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles
  for select
  using (id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles
  for update
  using (id = auth.uid());

-- 004_create_shifts.sql
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

-- 005_create_leave_requests.sql
do $$
begin
  if not exists (select 1 from pg_type where typname = 'leave_status') then
    create type public.leave_status as enum ('pending', 'approved', 'rejected', 'cancelled');
  end if;
end $$;

create table if not exists public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  hospital_id uuid not null references public.hospitals(id) on delete restrict,
  department_id uuid references public.departments(id) on delete set null,
  start_date date not null,
  end_date date not null,
  reason text,
  status public.leave_status not null default 'pending',
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists leave_requests_user_id_idx on public.leave_requests (user_id);
create index if not exists leave_requests_hospital_id_idx on public.leave_requests (hospital_id);
create index if not exists leave_requests_status_idx on public.leave_requests (status);

drop trigger if exists set_leave_requests_updated_at on public.leave_requests;
create trigger set_leave_requests_updated_at
before update on public.leave_requests
for each row execute function public.set_updated_at();

-- 006_create_swap_requests.sql
do $$
begin
  if not exists (select 1 from pg_type where typname = 'swap_status') then
    create type public.swap_status as enum ('pending', 'approved', 'rejected', 'cancelled');
  end if;
end $$;

create table if not exists public.swap_requests (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references public.shifts(id) on delete cascade,
  requester_id uuid not null references auth.users(id) on delete cascade,
  requested_with_user_id uuid references auth.users(id) on delete set null,
  status public.swap_status not null default 'pending',
  reason text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists swap_requests_shift_id_idx on public.swap_requests (shift_id);
create index if not exists swap_requests_requester_id_idx on public.swap_requests (requester_id);
create index if not exists swap_requests_status_idx on public.swap_requests (status);

drop trigger if exists set_swap_requests_updated_at on public.swap_requests;
create trigger set_swap_requests_updated_at
before update on public.swap_requests
for each row execute function public.set_updated_at();

-- 007_create_patients.sql
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

-- 008_create_tasks.sql
do $$
begin
  if not exists (select 1 from pg_type where typname = 'task_status') then
    create type public.task_status as enum ('todo', 'in_progress', 'done', 'cancelled');
  end if;

  if not exists (select 1 from pg_type where typname = 'task_priority') then
    create type public.task_priority as enum ('low', 'medium', 'high', 'critical');
  end if;
end $$;

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references public.hospitals(id) on delete restrict,
  department_id uuid references public.departments(id) on delete set null,
  patient_id uuid references public.patients(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete restrict,
  assigned_to uuid references auth.users(id) on delete set null,
  title varchar(255) not null,
  description text,
  status public.task_status not null default 'todo',
  priority public.task_priority not null default 'medium',
  due_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tasks_hospital_id_idx on public.tasks (hospital_id);
create index if not exists tasks_department_id_idx on public.tasks (department_id);
create index if not exists tasks_patient_id_idx on public.tasks (patient_id);
create index if not exists tasks_assigned_to_idx on public.tasks (assigned_to);
create index if not exists tasks_status_idx on public.tasks (status);

drop trigger if exists set_tasks_updated_at on public.tasks;
create trigger set_tasks_updated_at
before update on public.tasks
for each row execute function public.set_updated_at();

-- 009_create_task_comments.sql
create table if not exists public.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists task_comments_task_id_idx on public.task_comments (task_id);
create index if not exists task_comments_user_id_idx on public.task_comments (user_id);

drop trigger if exists set_task_comments_updated_at on public.task_comments;
create trigger set_task_comments_updated_at
before update on public.task_comments
for each row execute function public.set_updated_at();

-- 010_create_handovers.sql
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

-- 011_enable_rls_policies.sql (truncated to essentials)
create or replace function public.profile_role()
returns public.user_role
language sql
stable
as $$
  select p.role
  from public.profiles p
  where p.id = auth.uid() and p.is_active
$$;

create or replace function public.profile_hospital_id()
returns uuid
language sql
stable
as $$
  select p.hospital_id
  from public.profiles p
  where p.id = auth.uid() and p.is_active
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
as $$
  select exists(
    select 1
    from public.profiles p
    where p.id = auth.uid() and p.is_active and p.role = 'super_admin'
  )
$$;

create or replace function public.is_hospital_member(hid uuid)
returns boolean
language sql
stable
as $$
  select public.is_super_admin() or public.profile_hospital_id() = hid
$$;

alter table public.hospitals enable row level security;
alter table public.departments enable row level security;
alter table public.shifts enable row level security;
alter table public.leave_requests enable row level security;
alter table public.swap_requests enable row level security;
alter table public.patients enable row level security;
alter table public.tasks enable row level security;
alter table public.task_comments enable row level security;
alter table public.handovers enable row level security;

-- Policies (minimal subset for brevity; full policies in 011 file)
drop policy if exists "hospitals_select" on public.hospitals;
create policy "hospitals_select"
  on public.hospitals
  for select
  to authenticated
  using (
    public.is_super_admin()
    or (public.profile_role() = 'admin' and public.profile_hospital_id() = id)
  );

drop policy if exists "hospitals_write" on public.hospitals;
create policy "hospitals_write"
  on public.hospitals
  for all
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- NOTE: Full policy set is in 011_enable_rls_policies.sql; this bootstrap includes only a few for brevity.
-- For production, run the full 011 file after this bootstrap.

-- Bootstrap: promote your user to super_admin
-- Promotes codecorelabs@gmail.com to super_admin (sign up in app with this email first).
do $$
begin
  update public.profiles p
  set role = 'super_admin'
  from auth.users u
  where u.email = 'codecorelabs@gmail.com'
    and p.id = u.id;

  if found then
    raise notice 'User % promoted to super_admin', u.email;
  else
    raise warning 'No profile found for email %; ensure you have signed in at least once', 'codecorelabs@gmail.com';
  end if;
end $$;

-- Verify promotion
select id, email, role from public.profiles where email = 'codecorelabs@gmail.com';
