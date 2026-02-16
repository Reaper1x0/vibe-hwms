# Deployment (Vercel)

Frontend is deployed to **Vercel**.

## Vercel project

- **Project ID:** `prj_XnSBhxa68DIbJ2gb3hyCZvWSxhrh`
- **Dashboard:** [vercel.com](https://vercel.com) → your project

## Prerequisites

1. **Vercel CLI** (optional; script uses `npx vercel`):
   ```bash
   npm i -g vercel
   ```
2. **Log in once:**
   ```bash
   npx vercel login
   ```
3. **Environment variables in Vercel**  
   In Vercel: **Project → Settings → Environment Variables**, add the same names as in `.env`:

   | Name | Notes |
   |------|--------|
   | `NEXT_PUBLIC_SUPABASE_URL` | From `.env` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | From `.env` |
   | `SUPABASE_SERVICE_ROLE_KEY` | From `.env` (server-only; keep secret) |

   Use the same values as in your local `.env` (or your production Supabase project).

## Deploy

From the project root:

```bash
npm run deploy
```

Or run the script directly:

```bash
node scripts/deploy-to-vercel.js
```

The script:

1. Reads `.env` and checks that required variables are set.
2. Deploys to Vercel production using project ID `prj_XnSBhxa68DIbJ2gb3hyCZvWSxhrh`.

Ensure `.env` (and Vercel env vars) are set before deploying so the app can reach Supabase.
