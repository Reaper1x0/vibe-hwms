import Link from "next/link";
import { redirect } from "next/navigation";

import { apiFetch } from "@/lib/api/origin";
import { isSupabaseConfigured } from "@/lib/env";

type HospitalRow = {
  id: string;
  name: string;
};

type DepartmentRow = {
  id: string;
  hospital_id: string;
  name: string;
  type: string | null;
  is_active: boolean;
};

async function createDepartment(formData: FormData) {
  "use server";

  const hospitalId = String(formData.get("hospital_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const type = String(formData.get("type") ?? "").trim();
  const hodUserId = String(formData.get("hod_user_id") ?? "").trim();

  if (!hospitalId || !name) {
    return;
  }

  const res = await apiFetch("/api/departments", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      hospital_id: hospitalId,
      name,
      type: type || undefined,
      hod_user_id: hodUserId || undefined,
    }),
    cache: "no-store",
  });

  if (res.ok) {
    redirect("/dashboard/departments");
  }
}

export default async function DepartmentsPage() {
  if (!isSupabaseConfigured()) {
    return (
      <main className="mx-auto w-full max-w-5xl px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Departments</h1>
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
            hospital_id?: string | null;
          } | null;
        };
      }
    | null;

  const role = meJson?.data?.profile?.role;
  const scopedHospitalId = meJson?.data?.profile?.hospital_id ?? null;

  let hospitals: HospitalRow[] = [];
  let scopedHospitalName: string | null = null;

  if (role === "super_admin") {
    const hospitalsRes = await apiFetch("/api/hospitals", { cache: "no-store" });
    const hospitalsJson = (await hospitalsRes.json().catch(() => ({ data: [] }))) as { data: HospitalRow[] };
    hospitals = hospitalsJson.data ?? [];
  } else if (role === "admin" && scopedHospitalId) {
    const hospitalRes = await apiFetch(`/api/hospitals/${scopedHospitalId}`, { cache: "no-store" });
    const hospitalJson = (await hospitalRes.json().catch(() => null)) as { data?: { name?: string } } | null;
    scopedHospitalName = hospitalJson?.data?.name ?? null;
  }

  const deptRes = await apiFetch("/api/departments", { cache: "no-store" });
  if (deptRes.status === 403) {
    return (
      <main className="mx-auto w-full max-w-5xl px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Departments</h1>
        <p className="mt-2 text-sm text-zinc-600">You don’t have permission to manage departments.</p>
      </main>
    );
  }
  const deptJson = (await deptRes.json().catch(() => ({ data: [] }))) as { data: DepartmentRow[] };
  const departments = deptJson.data ?? [];

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Departments</h1>
        <p className="mt-2 text-sm text-zinc-600">Create and manage departments.</p>
      </div>

      <section className="mt-8 rounded-lg border bg-white p-6">
        <h2 className="text-base font-semibold">Create department</h2>
        <form action={createDepartment} className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {role === "super_admin" ? (
            <label className="block">
              <span className="text-sm font-medium">Hospital</span>
              <select
                name="hospital_id"
                required
                defaultValue=""
                className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm"
              >
                <option value="" disabled>
                  Select a hospital
                </option>
                {hospitals.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </select>
            </label>
          ) : scopedHospitalId ? (
            <div className="block">
              <span className="text-sm font-medium">Hospital</span>
              <div className="mt-1 rounded-md border bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
                {scopedHospitalName ?? "Assigned hospital"}
              </div>
              <input type="hidden" name="hospital_id" value={scopedHospitalId} />
            </div>
          ) : (
            <div className="sm:col-span-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Your account is not scoped to a hospital. Ask a Super Admin to assign your hospital.
            </div>
          )}

          <label className="block">
            <span className="text-sm font-medium">Name</span>
            <input name="name" required className="mt-1 w-full rounded-md border px-3 py-2 text-sm" />
          </label>

          <label className="block">
            <span className="text-sm font-medium">Type</span>
            <input name="type" className="mt-1 w-full rounded-md border px-3 py-2 text-sm" />
          </label>

          <label className="block">
            <span className="text-sm font-medium">HOD User ID (advanced)</span>
            <input
              name="hod_user_id"
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              placeholder="Paste user ID only if you know it"
            />
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
          <h2 className="text-base font-semibold">All departments</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-zinc-600">
              <tr>
                <th className="px-6 py-3 font-medium">Name</th>
                <th className="px-6 py-3 font-medium">Type</th>
                <th className="px-6 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {departments.map((d) => (
                <tr key={d.id} className="border-t">
                  <td className="px-6 py-3">
                    <Link className="font-medium text-zinc-900 underline" href={`/dashboard/departments/${d.id}`}>
                      {d.name}
                    </Link>
                  </td>
                  <td className="px-6 py-3 text-zinc-700">{d.type ?? "—"}</td>
                  <td className="px-6 py-3">
                    <span className={d.is_active ? "text-emerald-700" : "text-zinc-500"}>{d.is_active ? "Active" : "Inactive"}</span>
                  </td>
                </tr>
              ))}
              {departments.length === 0 ? (
                <tr>
                  <td className="px-6 py-10 text-zinc-600" colSpan={3}>
                    No departments yet.
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
