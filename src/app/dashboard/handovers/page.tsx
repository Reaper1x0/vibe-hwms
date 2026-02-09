import Link from "next/link";
import { redirect } from "next/navigation";

import { apiFetch } from "@/lib/api/origin";
import { isSupabaseConfigured } from "@/lib/env";

type HandoverRow = {
  id: string;
  hospital_id: string;
  department_id: string | null;
  patient_id: string | null;
  shift_id: string | null;
  from_user_id: string;
  to_user_id: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
};

type PatientRow = {
  id: string;
  full_name: string;
};

type HospitalRow = {
  id: string;
  name: string;
};

async function createHandover(formData: FormData) {
  "use server";

  const hospitalId = String(formData.get("hospital_id") ?? "");
  const patientId = String(formData.get("patient_id") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  const res = await apiFetch("/api/handovers", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      hospital_id: hospitalId || undefined,
      patient_id: patientId || null,
      notes: notes || null,
    }),
    cache: "no-store",
  });

  if (res.ok) {
    redirect("/dashboard/handovers");
  }
}

export default async function HandoversPage() {
  if (!isSupabaseConfigured()) {
    return (
      <main className="mx-auto w-full max-w-5xl px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Handovers</h1>
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
          profile?: { role?: string; hospital_id?: string | null } | null;
        };
      }
    | null;

  const role = meJson?.data?.profile?.role;
  const scopedHospitalId = meJson?.data?.profile?.hospital_id ?? null;
  const userId = meJson?.data?.user?.id ?? null;

  let hospitals: HospitalRow[] = [];
  if (role === "super_admin") {
    const hospitalsRes = await apiFetch("/api/hospitals", { cache: "no-store" });
    const hospitalsJson = (await hospitalsRes.json().catch(() => ({ data: [] }))) as { data: HospitalRow[] };
    hospitals = hospitalsJson.data ?? [];
  }

  const patientsRes = await apiFetch("/api/patients", { cache: "no-store" });
  const patientsJson = (await patientsRes.json().catch(() => ({ data: [] }))) as { data: PatientRow[] };
  const patients = patientsJson.data ?? [];

  const handoversRes = await apiFetch("/api/handovers", { cache: "no-store" });
  if (handoversRes.status === 403) {
    return (
      <main className="mx-auto w-full max-w-5xl px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Handovers</h1>
        <p className="mt-2 text-sm text-zinc-600">You don’t have permission to view handovers.</p>
      </main>
    );
  }
  const handoversJson = (await handoversRes.json().catch(() => ({ data: [] }))) as { data: HandoverRow[] };
  const handovers = handoversJson.data ?? [];

  const patientNameById = new Map(patients.map((p) => [p.id, p.full_name]));

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Handovers</h1>
        <p className="mt-2 text-sm text-zinc-600">Shift handovers and continuity notes.</p>
      </div>

      <section className="mt-8 rounded-lg border bg-white p-6">
        <h2 className="text-base font-semibold">Create handover</h2>
        <form action={createHandover} className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-4">
          {role === "super_admin" ? (
            <label className="block sm:col-span-2">
              <span className="text-sm font-medium">Hospital</span>
              <select name="hospital_id" defaultValue="" className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm">
                <option value="">(auto)</option>
                {hospitals.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </select>
            </label>
          ) : scopedHospitalId ? (
            <div className="block sm:col-span-2">
              <span className="text-sm font-medium">Hospital</span>
              <div className="mt-1 rounded-md border bg-zinc-50 px-3 py-2 text-sm text-zinc-700">Assigned hospital</div>
              <input type="hidden" name="hospital_id" value={scopedHospitalId} />
            </div>
          ) : (
            <div className="sm:col-span-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Your account is not scoped to a hospital.
            </div>
          )}

          <label className="block sm:col-span-2">
            <span className="text-sm font-medium">Patient</span>
            <select name="patient_id" defaultValue="" className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm">
              <option value="">(none)</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name}
                </option>
              ))}
            </select>
          </label>

          <label className="block sm:col-span-4">
            <span className="text-sm font-medium">Notes</span>
            <textarea name="notes" className="mt-1 min-h-24 w-full rounded-md border px-3 py-2 text-sm" />
          </label>

          <div className="sm:col-span-4">
            <button type="submit" className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white">
              Create
            </button>
          </div>
        </form>
      </section>

      <section className="mt-8 overflow-hidden rounded-lg border bg-white">
        <div className="border-b px-6 py-4">
          <h2 className="text-base font-semibold">Handovers</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-zinc-600">
              <tr>
                <th className="px-6 py-3 font-medium">Notes</th>
                <th className="px-6 py-3 font-medium">Patient</th>
                <th className="px-6 py-3 font-medium">From</th>
                <th className="px-6 py-3 font-medium">To</th>
              </tr>
            </thead>
            <tbody>
              {handovers.map((h) => {
                const fromLabel = userId && h.from_user_id === userId ? "You" : "Colleague";
                const toLabel =
                  h.to_user_id == null ? "—" : userId && h.to_user_id === userId ? "You" : "Colleague";

                return (
                  <tr key={h.id} className="border-t">
                    <td className="px-6 py-3">
                      <Link className="font-medium text-zinc-900 underline" href={`/dashboard/handovers/${h.id}`}>
                        {h.notes ? h.notes.slice(0, 50) : "(no notes)"}
                      </Link>
                    </td>
                    <td className="px-6 py-3 text-zinc-700">
                      {h.patient_id ? patientNameById.get(h.patient_id) ?? "Linked patient" : "—"}
                    </td>
                    <td className="px-6 py-3 text-zinc-700">{fromLabel}</td>
                    <td className="px-6 py-3 text-zinc-700">{toLabel}</td>
                  </tr>
                );
              })}
              {handovers.length === 0 ? (
                <tr>
                  <td className="px-6 py-10 text-zinc-600" colSpan={4}>
                    No handovers yet.
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
