import Link from "next/link";

export default function SetupPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">HWMS Setup</h1>
      <p className="mt-2 text-sm text-zinc-600">
        Supabase is not configured yet. Add the following to <code className="rounded bg-zinc-100 px-1">web/.env</code> or <code className="rounded bg-zinc-100 px-1">.env.local</code>. See <code className="rounded bg-zinc-100 px-1">SETUP.md</code> in the project root for step-by-step instructions.
      </p>

      <pre className="mt-6 overflow-x-auto rounded-lg border bg-white p-4 text-xs text-zinc-900">
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
      </pre>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link className="ui-btn-primary rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white" href="/login">
          Go to Login
        </Link>
        <a
          className="ui-btn-secondary rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700"
          href="https://supabase.com/docs/guides/getting-started"
          target="_blank"
          rel="noreferrer"
        >
          Supabase Docs
        </a>
      </div>
    </main>
  );
}
