import Link from "next/link";
import { redirect } from "next/navigation";

import { isSupabaseConfigured } from "@/lib/env";
import { apiFetch } from "@/lib/api/origin";

type HospitalRow = {
  id: string;
  name: string;
  code: string;
  city: string | null;
  is_active: boolean;
  created_at: string;
};

async function createHospital(formData: FormData) {
  "use server";

  const name = String(formData.get("name") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();

  if (!name || !code) {
    return;
  }

  const res = await apiFetch("/api/hospitals", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      name,
      code,
      city: city || undefined,
    }),
    cache: "no-store",
  });

  if (res.ok) {
    redirect("/dashboard/hospitals");
  }

  if (res.status === 403) {
    redirect("/dashboard");
  }
}

export default async function HospitalsPage() {
  if (!isSupabaseConfigured()) {
    return (
      <main className="mx-auto w-full max-w-5xl px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Hospitals</h1>
        <p className="mt-2 text-sm text-zinc-600">Supabase is not configured.</p>
        <Link className="mt-6 inline-flex rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white" href="/setup">
          Go to setup
        </Link>
      </main>
    );
  }

  const meRes = await apiFetch("/api/auth/me", { cache: "no-store" });
  const meJson = (await meRes.json().catch(() => null)) as
    | {
        data?: {
          profile?: {
            role?: string;
          } | null;
        };
      }
    | null;

  const role = meJson?.data?.profile?.role;
  if (role !== "super_admin") {
    return (
      <main className="mx-auto w-full max-w-5xl px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Hospitals</h1>
        <p className="mt-2 text-sm text-zinc-600">You don’t have permission to manage hospitals.</p>
        <Link className="mt-6 inline-flex rounded-md border bg-white px-4 py-2 text-sm font-medium" href="/dashboard/profile">
          View profile
        </Link>
      </main>
    );
  }

  const res = await apiFetch("/api/hospitals", { cache: "no-store" });
  if (res.status === 403) {
    return (
      <main className="mx-auto w-full max-w-5xl px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Hospitals</h1>
        <p className="mt-2 text-sm text-zinc-600">You don’t have permission to manage hospitals.</p>
      </main>
    );
  }
  const json = (await res.json().catch(() => ({ data: [] }))) as { data: HospitalRow[] };
  const hospitals = json.data ?? [];

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Hospitals</h1>
          <p className="mt-2 text-sm text-zinc-600">Create and manage hospitals (SRS Module: Multi-Hospital Management).</p>
        </div>
      </div>

      <section className="mt-8 rounded-lg border bg-white p-6">
        <h2 className="text-base font-semibold">Create hospital</h2>
        <form action={createHospital} className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <label className="block">
            <span className="text-sm font-medium">Name</span>
            <input name="name" required className="mt-1 w-full rounded-md border px-3 py-2 text-sm" />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Code</span>
            <input name="code" required className="mt-1 w-full rounded-md border px-3 py-2 text-sm" />
          </label>
          <label className="block">
            <span className="text-sm font-medium">City</span>
            <input name="city" className="mt-1 w-full rounded-md border px-3 py-2 text-sm" />
          </label>
          <div className="sm:col-span-3">
            <button type="submit" className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white">
              Create
            </button>
          </div>
        </form>
      </section>

      <section className="mt-8 overflow-hidden rounded-lg border bg-white">
        <div className="border-b px-6 py-4">
          <h2 className="text-base font-semibold">All hospitals</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-zinc-600">
              <tr>
                <th className="px-6 py-3 font-medium">Name</th>
                <th className="px-6 py-3 font-medium">Code</th>
                <th className="px-6 py-3 font-medium">City</th>
                <th className="px-6 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {hospitals.map((h) => (
                <tr key={h.id} className="border-t">
                  <td className="px-6 py-3">
                    <Link className="font-medium text-zinc-900 underline" href={`/dashboard/hospitals/${h.id}`}>
                      {h.name}
                    </Link>
                  </td>
                  <td className="px-6 py-3 text-zinc-700">{h.code}</td>
                  <td className="px-6 py-3 text-zinc-700">{h.city ?? "—"}</td>
                  <td className="px-6 py-3">
                    <span className={h.is_active ? "text-emerald-700" : "text-zinc-500"}>{h.is_active ? "Active" : "Inactive"}</span>
                  </td>
                </tr>
              ))}
              {hospitals.length === 0 ? (
                <tr>
                  <td className="px-6 py-10 text-zinc-600" colSpan={4}>
                    No hospitals yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
