import Link from "next/link";
import { redirect } from "next/navigation";

import { apiFetch } from "@/lib/api/origin";
import { isSupabaseConfigured } from "@/lib/env";

type Department = {
  id: string;
  hospital_id: string;
  name: string;
  type: string | null;
  hod_user_id: string | null;
  is_active: boolean;
};

async function updateDepartment(id: string, formData: FormData) {
  "use server";

  const name = String(formData.get("name") ?? "").trim();
  const type = String(formData.get("type") ?? "").trim();
  const hodUserId = String(formData.get("hod_user_id") ?? "").trim();
  const isActive = formData.get("is_active") === "on";

  await apiFetch(`/api/departments/${id}`, {
    method: "PUT",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      name,
      type: type || null,
      hod_user_id: hodUserId || null,
      is_active: isActive,
    }),
    cache: "no-store",
  });

  redirect(`/dashboard/departments/${id}`);
}

export default async function DepartmentDetailPage({ params }: { params: { id: string } }) {
  if (!isSupabaseConfigured()) {
    return (
      <main className="mx-auto w-full max-w-5xl px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Department</h1>
        <p className="mt-2 text-sm text-zinc-600">Supabase is not configured.</p>
        <Link className="mt-6 inline-flex rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white" href="/setup">
          Go to setup
        </Link>
      </main>
    );
  }

  const res = await apiFetch(`/api/departments/${params.id}`, { cache: "no-store" });
  if (res.status === 403) {
    return (
      <main className="mx-auto w-full max-w-5xl px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Department</h1>
        <p className="mt-2 text-sm text-zinc-600">You don’t have permission to view this department.</p>
        <Link className="mt-6 inline-flex rounded-md border bg-white px-4 py-2 text-sm font-medium" href="/dashboard/departments">
          Back
        </Link>
      </main>
    );
  }
  const json = (await res.json().catch(() => null)) as { data?: Department } | null;
  const dept = json?.data;

  if (!dept) {
    return (
      <main className="mx-auto w-full max-w-5xl px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Department not found</h1>
        <Link className="mt-6 inline-flex rounded-md border bg-white px-4 py-2 text-sm font-medium" href="/dashboard/departments">
          Back
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      <div className="flex items-center justify-between gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{dept.name}</h1>
          <p className="mt-2 text-sm text-zinc-600">Edit department details and status.</p>
        </div>
        <Link className="rounded-md border bg-white px-4 py-2 text-sm font-medium" href="/dashboard/departments">
          Back
        </Link>
      </div>

      <section className="mt-8 rounded-lg border bg-white p-6">
        <form action={updateDepartment.bind(null, dept.id)} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium">Name</span>
            <input defaultValue={dept.name} name="name" required className="mt-1 w-full rounded-md border px-3 py-2 text-sm" />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Type</span>
            <input defaultValue={dept.type ?? ""} name="type" className="mt-1 w-full rounded-md border px-3 py-2 text-sm" />
          </label>

          <label className="block">
            <span className="text-sm font-medium">HOD User ID (advanced)</span>
            <input
              defaultValue={dept.hod_user_id ?? ""}
              name="hod_user_id"
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              placeholder="Paste user ID only if you know it"
            />
          </label>

          <label className="flex items-center gap-2 pt-6">
            <input defaultChecked={dept.is_active} name="is_active" type="checkbox" className="h-4 w-4 rounded border" />
            <span className="text-sm font-medium">Active</span>
          </label>

          <div className="sm:col-span-2 pt-2">
            <button type="submit" className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white">
              Save
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
