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

drop policy if exists "departments_select" on public.departments;
create policy "departments_select"
  on public.departments
  for select
  to authenticated
  using (public.is_hospital_member(hospital_id));

drop policy if exists "departments_write" on public.departments;
create policy "departments_write"
  on public.departments
  for all
  to authenticated
  using (
    public.profile_role() in ('super_admin', 'admin', 'hod')
    and public.is_hospital_member(hospital_id)
  )
  with check (
    public.profile_role() in ('super_admin', 'admin', 'hod')
    and public.is_hospital_member(hospital_id)
  );

drop policy if exists "patients_select" on public.patients;
create policy "patients_select"
  on public.patients
  for select
  to authenticated
  using (public.is_hospital_member(hospital_id));

drop policy if exists "patients_write" on public.patients;
create policy "patients_write"
  on public.patients
  for all
  to authenticated
  using (public.is_hospital_member(hospital_id))
  with check (public.is_hospital_member(hospital_id));

drop policy if exists "shifts_select" on public.shifts;
create policy "shifts_select"
  on public.shifts
  for select
  to authenticated
  using (
    public.is_hospital_member(hospital_id)
    and (
      public.profile_role() not in ('doctor', 'nurse')
      or assigned_user_id = auth.uid()
    )
  );

drop policy if exists "shifts_write" on public.shifts;
create policy "shifts_write"
  on public.shifts
  for all
  to authenticated
  using (
    public.profile_role() in ('super_admin', 'admin', 'hod')
    and public.is_hospital_member(hospital_id)
  )
  with check (
    public.profile_role() in ('super_admin', 'admin', 'hod')
    and public.is_hospital_member(hospital_id)
  );

drop policy if exists "leave_requests_select" on public.leave_requests;
create policy "leave_requests_select"
  on public.leave_requests
  for select
  to authenticated
  using (
    public.is_hospital_member(hospital_id)
    and (
      public.profile_role() not in ('doctor', 'nurse')
      or user_id = auth.uid()
    )
  );

drop policy if exists "leave_requests_insert" on public.leave_requests;
create policy "leave_requests_insert"
  on public.leave_requests
  for insert
  to authenticated
  with check (
    public.is_hospital_member(hospital_id)
    and user_id = auth.uid()
  );

drop policy if exists "leave_requests_update" on public.leave_requests;
create policy "leave_requests_update"
  on public.leave_requests
  for update
  to authenticated
  using (
    public.is_hospital_member(hospital_id)
    and (
      public.profile_role() in ('super_admin', 'admin', 'hod')
      or user_id = auth.uid()
    )
  )
  with check (
    public.is_hospital_member(hospital_id)
    and (
      public.profile_role() in ('super_admin', 'admin', 'hod')
      or user_id = auth.uid()
    )
  );

drop policy if exists "tasks_select" on public.tasks;
create policy "tasks_select"
  on public.tasks
  for select
  to authenticated
  using (
    public.is_hospital_member(hospital_id)
    and (
      public.profile_role() not in ('doctor', 'nurse')
      or assigned_to = auth.uid()
      or created_by = auth.uid()
    )
  );

drop policy if exists "tasks_insert" on public.tasks;
create policy "tasks_insert"
  on public.tasks
  for insert
  to authenticated
  with check (
    public.is_hospital_member(hospital_id)
    and created_by = auth.uid()
  );

drop policy if exists "tasks_update" on public.tasks;
create policy "tasks_update"
  on public.tasks
  for update
  to authenticated
  using (
    public.is_hospital_member(hospital_id)
    and (
      public.profile_role() in ('super_admin', 'admin', 'hod')
      or (
        public.profile_role() in ('doctor', 'nurse')
        and (assigned_to = auth.uid() or created_by = auth.uid())
      )
    )
  )
  with check (
    public.is_hospital_member(hospital_id)
    and (
      public.profile_role() in ('super_admin', 'admin', 'hod')
      or (
        public.profile_role() in ('doctor', 'nurse')
        and (assigned_to = auth.uid() or created_by = auth.uid())
      )
    )
  );

drop policy if exists "task_comments_select" on public.task_comments;
create policy "task_comments_select"
  on public.task_comments
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.tasks t
      where t.id = task_id
        and public.is_hospital_member(t.hospital_id)
        and (
          public.profile_role() not in ('doctor', 'nurse')
          or t.assigned_to = auth.uid()
          or t.created_by = auth.uid()
        )
    )
  );

drop policy if exists "task_comments_insert" on public.task_comments;
create policy "task_comments_insert"
  on public.task_comments
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.tasks t
      where t.id = task_id
        and public.is_hospital_member(t.hospital_id)
        and (
          public.profile_role() not in ('doctor', 'nurse')
          or t.assigned_to = auth.uid()
          or t.created_by = auth.uid()
        )
    )
  );

drop policy if exists "task_comments_update" on public.task_comments;
create policy "task_comments_update"
  on public.task_comments
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "handovers_select" on public.handovers;
create policy "handovers_select"
  on public.handovers
  for select
  to authenticated
  using (
    public.is_hospital_member(hospital_id)
    and (
      public.profile_role() not in ('doctor', 'nurse')
      or from_user_id = auth.uid()
      or to_user_id = auth.uid()
    )
  );

drop policy if exists "handovers_insert" on public.handovers;
create policy "handovers_insert"
  on public.handovers
  for insert
  to authenticated
  with check (
    public.is_hospital_member(hospital_id)
    and from_user_id = auth.uid()
  );

drop policy if exists "handovers_update" on public.handovers;
create policy "handovers_update"
  on public.handovers
  for update
  to authenticated
  using (
    public.is_hospital_member(hospital_id)
    and (
      public.profile_role() in ('super_admin', 'admin', 'hod')
      or from_user_id = auth.uid()
      or to_user_id = auth.uid()
    )
  )
  with check (
    public.is_hospital_member(hospital_id)
    and (
      public.profile_role() in ('super_admin', 'admin', 'hod')
      or from_user_id = auth.uid()
      or to_user_id = auth.uid()
    )
  );

drop policy if exists "swap_requests_select" on public.swap_requests;
create policy "swap_requests_select"
  on public.swap_requests
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.shifts s
      where s.id = shift_id
        and public.is_hospital_member(s.hospital_id)
    )
    and (
      public.profile_role() not in ('doctor', 'nurse')
      or requester_id = auth.uid()
      or requested_with_user_id = auth.uid()
    )
  );

drop policy if exists "swap_requests_insert" on public.swap_requests;
create policy "swap_requests_insert"
  on public.swap_requests
  for insert
  to authenticated
  with check (
    requester_id = auth.uid()
    and exists (
      select 1
      from public.shifts s
      where s.id = shift_id
        and public.is_hospital_member(s.hospital_id)
        and (
          public.profile_role() not in ('doctor', 'nurse')
          or s.assigned_user_id = auth.uid()
        )
    )
  );

drop policy if exists "swap_requests_update" on public.swap_requests;
create policy "swap_requests_update"
  on public.swap_requests
  for update
  to authenticated
  using (
    requester_id = auth.uid()
    or (
      public.profile_role() in ('super_admin', 'admin', 'hod')
      and exists (
        select 1
        from public.shifts s
        where s.id = shift_id
          and public.is_hospital_member(s.hospital_id)
      )
    )
  )
  with check (
    requester_id = auth.uid()
    or (
      public.profile_role() in ('super_admin', 'admin', 'hod')
      and exists (
        select 1
        from public.shifts s
        where s.id = shift_id
          and public.is_hospital_member(s.hospital_id)
      )
    )
  );
