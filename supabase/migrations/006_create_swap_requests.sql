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
