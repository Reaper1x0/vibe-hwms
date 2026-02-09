do $$
begin
  if current_setting('app.seed_demo', true) is distinct from 'on' then
    raise notice 'Skipping demo seed. To enable: set app.seed_demo = ''on'';';
    return;
  end if;

  insert into public.hospitals (name, code, address, city, phone, email)
  values ('Demo Hospital', 'DEMO', '123 Demo Street', 'Demo City', '000-000-0000', 'demo@hwms.local')
  on conflict (code) do nothing;

  insert into public.departments (hospital_id, name, type)
  select h.id, d.name, d.type
  from public.hospitals h
  cross join (
    values
      ('Emergency', 'ER'),
      ('Cardiology', 'Clinical'),
      ('Radiology', 'Diagnostics')
  ) as d(name, type)
  where h.code = 'DEMO'
  on conflict (hospital_id, name) do nothing;

  insert into public.patients (hospital_id, department_id, mrn, full_name, date_of_birth, gender, notes)
  select h.id, dep.id, p.mrn, p.full_name, p.dob, p.gender, p.notes
  from public.hospitals h
  join public.departments dep on dep.hospital_id = h.id and dep.name = 'Emergency'
  cross join (
    values
      ('MRN-0001', 'John Doe', '1980-01-01'::date, 'male', 'Demo patient'),
      ('MRN-0002', 'Jane Smith', '1990-05-20'::date, 'female', 'Demo patient')
  ) as p(mrn, full_name, dob, gender, notes)
  where h.code = 'DEMO'
  on conflict (hospital_id, mrn) do nothing;

  insert into public.shifts (hospital_id, department_id, shift_type, start_at, end_at, notes)
  select h.id, dep.id, s.shift_type, s.start_at, s.end_at, s.notes
  from public.hospitals h
  join public.departments dep on dep.hospital_id = h.id and dep.name = 'Emergency'
  cross join (
    values
      ('Day', now() + interval '1 day', now() + interval '1 day' + interval '8 hours', 'Demo shift'),
      ('Night', now() + interval '1 day' + interval '12 hours', now() + interval '2 days' + interval '4 hours', 'Demo shift')
  ) as s(shift_type, start_at, end_at, notes)
  where h.code = 'DEMO'
    and not exists (
      select 1
      from public.shifts sh
      where sh.hospital_id = h.id
        and (sh.department_id is not distinct from dep.id)
        and sh.start_at = s.start_at
        and sh.end_at = s.end_at
        and sh.is_active
    );
end $$;
