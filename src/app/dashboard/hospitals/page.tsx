import Link from "next/link";
import { redirect } from "next/navigation";

import { AutoSubmitForm } from "@/components/AutoSubmitForm";
import { CreateFormToggle } from "@/components/CreateFormToggle";
import { isSupabaseConfigured } from "@/lib/env";
import { apiFetch } from "@/lib/api/origin";
import { DEFAULT_PAGE_SIZE, parseLimit, ROWS_PER_PAGE_OPTIONS } from "@/lib/table-pagination";

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

export default async function HospitalsPage({
  searchParams,
}: {
  searchParams?: { page?: string; limit?: string };
}) {
  if (!isSupabaseConfigured()) {
    return (
      <main className="mx-auto w-full max-w-5xl px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Hospitals</h1>
        <p className="mt-2 text-sm text-zinc-600">Supabase is not configured.</p>
        <Link className="ui-btn-primary mt-6 inline-flex rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white" href="/setup">
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

  const limit = parseLimit(searchParams?.limit);
  const page = Math.max(1, parseInt(String(searchParams?.page ?? "1"), 10) || 1);
  const offset = (page - 1) * limit;

  const params = new URLSearchParams();
  params.set("limit", String(limit));
  params.set("offset", String(offset));

  const res = await apiFetch(`/api/hospitals?${params.toString()}`, { cache: "no-store" });
  if (res.status === 403) {
    return (
      <main className="mx-auto w-full max-w-5xl px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Hospitals</h1>
        <p className="mt-2 text-sm text-zinc-600">You don’t have permission to manage hospitals.</p>
      </main>
    );
  }
  const json = (await res.json().catch(() => ({ data: [], pagination: { total: 0, limit: DEFAULT_PAGE_SIZE, offset: 0, hasMore: false } }))) as {
    data: HospitalRow[];
    pagination: { total: number; limit: number; offset: number; hasMore: boolean };
  };
  const hospitals = json.data ?? [];
  const pagination = json.pagination ?? { total: 0, limit: DEFAULT_PAGE_SIZE, offset: 0, hasMore: false };
  const totalPages = Math.max(1, Math.ceil(pagination.total / limit));

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-10 min-h-0">
      <div className="shrink-0">
        <h1 className="text-2xl font-semibold tracking-tight">Hospitals</h1>
        <p className="mt-2 text-sm text-zinc-600">Create and manage hospitals (SRS Module: Multi-Hospital Management).</p>
      </div>

      <CreateFormToggle title="Create hospital" buttonLabel="Add hospital">
        <form action={createHospital} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
            <button type="submit" className="ui-btn-primary rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white">
              Create
            </button>
          </div>
        </form>
      </CreateFormToggle>

      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border bg-white">
        <div className="shrink-0 border-b px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold">All hospitals</h2>
            <AutoSubmitForm className="flex items-center gap-1 text-xs">
              <input type="hidden" name="page" value="1" />
              <span className="text-zinc-600">Rows</span>
              <select
                name="limit"
                defaultValue={limit}
                className="rounded-md border bg-white px-2 py-1 text-xs"
              >
                {ROWS_PER_PAGE_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </AutoSubmitForm>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
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
                    {pagination.total === 0 ? "No hospitals yet." : "No hospitals on this page."}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        {totalPages > 1 ? (
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t px-6 py-3 text-sm text-zinc-600">
            <span>
              Page {page} of {totalPages} ({pagination.total} hospitals)
            </span>
            <div className="flex gap-2">
              {page > 1 ? (
                <Link
                  href={`/dashboard/hospitals?limit=${limit}&page=${page - 1}`}
                  className="ui-btn-secondary rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium"
                >
                  Previous
                </Link>
              ) : null}
              {page < totalPages ? (
                <Link
                  href={`/dashboard/hospitals?limit=${limit}&page=${page + 1}`}
                  className="ui-btn-secondary rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium"
                >
                  Next
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}
