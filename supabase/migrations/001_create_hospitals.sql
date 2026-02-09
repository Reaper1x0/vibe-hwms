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
