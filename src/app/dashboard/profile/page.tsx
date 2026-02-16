import Link from "next/link";

import { apiFetch } from "@/lib/api/origin";
import { isSupabaseConfigured } from "@/lib/env";

type MeResponse = {
  data: {
    user: {
      id: string;
      email?: string | null;
    };
    profile: {
      id: string;
      email: string | null;
      full_name: string | null;
      role: string;
      hospital_id: string | null;
      department_id: string | null;
      is_active: boolean;
      created_at: string;
      updated_at: string;
    } | null;
  };
};

export default async function ProfilePage() {
  if (!isSupabaseConfigured()) {
    return (
      <main className="mx-auto w-full max-w-5xl px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
        <p className="mt-2 text-sm text-zinc-600">Supabase is not configured.</p>
        <Link className="ui-btn-primary mt-6 inline-flex rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white" href="/setup">
          Go to setup
        </Link>
      </main>
    );
  }

  const res = await apiFetch("/api/auth/me", { cache: "no-store" });
  const json = (await res.json().catch(() => null)) as MeResponse | null;

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
      <p className="mt-2 text-sm text-zinc-600">Your current session and role in the system.</p>

      <section className="mt-8 rounded-lg border bg-white p-6">
        {json?.data?.user && json.data.profile ? (
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-semibold text-zinc-900">Account</h2>
              <dl className="mt-2 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-zinc-500">Email</dt>
                  <dd className="mt-0.5 text-zinc-800">{json.data.profile.email ?? json.data.user.email ?? "—"}</dd>
                </div>
              </dl>
            </div>

            <div>
              <h2 className="text-base font-semibold text-zinc-900">Clinical profile</h2>
              <dl className="mt-2 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-zinc-500">Name</dt>
                  <dd className="mt-0.5 text-zinc-800">{json.data.profile.full_name ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-zinc-500">Role</dt>
                  <dd className="mt-0.5 text-zinc-800">{json.data.profile.role}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-zinc-500">Status</dt>
                  <dd className="mt-0.5 text-zinc-800">{json.data.profile.is_active ? "Active" : "Inactive"}</dd>
                </div>
              </dl>
            </div>

            <p className="mt-4 text-xs text-zinc-500">
              Ask a Super Admin to update your hospital/department if these values don&apos;t look right.
            </p>
          </div>
        ) : (
          <p className="text-sm text-zinc-600">No active session information found.</p>
        )}
      </section>
    </main>
  );
}
