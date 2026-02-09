# HWMS (Hospital Workforce Management System)

**Quick setup:** see [SETUP.md](../SETUP.md) in the repo root for a full checklist (Supabase, env, run locally, deploy to Vercel).

Next.js 14 + Supabase project implementing the SRS modules:

- Org Management (Hospitals, Departments)
- Scheduling (Shifts, Leave Requests, Swap Requests)
- Task Hub (Patients, Tasks, Comments, Handovers)
- Analytics (basic summary)

## Requirements

- Node.js `>= 18.18`
- A Supabase project

## Environment variables

Copy `.env.example` to `.env.local` and fill in:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Where to find keys:

- Supabase Dashboard -> Project Settings -> API
- Use the **anon** key for `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Use the **service_role** key for `SUPABASE_SERVICE_ROLE_KEY` (server-only; do not expose)

## Database migrations

SQL migrations live in `supabase/migrations`.

Apply them using one of these options:

### Option A: Supabase CLI

1. Install the Supabase CLI
2. Link the project / login
3. Run the migrations

### Option B: Supabase Dashboard

Run the migration SQL files in order (`001_...` -> latest) in the SQL Editor.

## Bootstrap first super_admin

1. Create a user via Supabase Auth (email/password) and log in once (this creates the `profiles` row).
2. In Supabase Dashboard -> SQL Editor, run:

```sql
-- Replace with your email
update public.profiles p
set role = 'super_admin'
from auth.users u
where u.email = 'codecorelabs@gmail.com'
  and p.id = u.id;

select id, email, role from public.profiles where email = 'codecorelabs@gmail.com';
```

## Optional: seed demo data

There is an optional demo seed migration: `supabase/migrations/012_seed_demo_data.sql`.

By default it **does nothing** unless you enable it for the SQL session:

```sql
set app.seed_demo = 'on';
```

Then run the file contents in the SQL Editor.

## Deployment (Supabase + Vercel)

**Full step-by-step guide:** see [DEPLOYMENT.md](../DEPLOYMENT.md) in the repo root (Supabase project + migrations, then Vercel with env vars and live URL).

**Deployment checklist:** see [DEPLOYMENT_CHECKLIST.md](../DEPLOYMENT_CHECKLIST.md) for a comprehensive pre-deployment verification list.

Short version:

1. Create a new Vercel project and set the **Root Directory** to `web`.
2. Set environment variables (Project Settings -> Environment Variables):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

3. Use:

- Build Command: `npm run build`
- Install Command: `npm install`
- Output: Next.js default

4. **After deployment:**
   - Add your Vercel URL to Supabase Auth redirect URLs
   - Verify all features work on the live URL
   - Check error handling and 404 pages

## RLS verification checklist

RLS policies are enabled in `supabase/migrations/011_enable_rls_policies.sql`.

To simulate requests in the SQL editor, set JWT claims for the session:

```sql
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '<USER_UUID>', 'role', 'authenticated')::text,
  true
);

select auth.uid();
```

Suggested checks (replace IDs):

```sql
-- Super admin can see hospitals
select id, name, code from public.hospitals where is_active;

-- Hospital member scoping examples
select count(*) from public.patients where hospital_id = '<HOSPITAL_UUID>';
select count(*) from public.tasks where hospital_id = '<HOSPITAL_UUID>';
select count(*) from public.handovers where hospital_id = '<HOSPITAL_UUID>';

-- Swap requests are scoped via shifts join
select count(*)
from public.swap_requests sr
join public.shifts s on s.id = sr.shift_id
where s.hospital_id = '<HOSPITAL_UUID>';
```

## Run the app

```bash
npm install
npm run dev
```

Open:

- `http://localhost:3000/login`
- `http://localhost:3000/dashboard`

## Notes

- Most API routes use the Supabase **service role** key for DB access and enforce access using app-side RBAC.
- A baseline RLS migration exists (`011_enable_rls_policies.sql`) for production hardening.
