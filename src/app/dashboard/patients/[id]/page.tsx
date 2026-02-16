import Link from "next/link";
import { redirect } from "next/navigation";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { apiFetch } from "@/lib/api/origin";
import { isSupabaseConfigured } from "@/lib/env";

type Patient = {
  id: string;
  hospital_id: string;
  department_id: string | null;
  mrn: string | null;
  full_name: string;
  date_of_birth: string | null;
  gender: string | null;
  notes: string | null;
  is_active: boolean;
};

async function updatePatient(id: string, formData: FormData) {
  "use server";

  const mrn = String(formData.get("mrn") ?? "").trim();
  const fullName = String(formData.get("full_name") ?? "").trim();
  const dob = String(formData.get("date_of_birth") ?? "");
  const gender = String(formData.get("gender") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const isActive = formData.get("is_active") === "on";

  await apiFetch(`/api/patients/${id}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      mrn: mrn || null,
      full_name: fullName,
      date_of_birth: dob || null,
      gender: gender || null,
      notes: notes || null,
      is_active: isActive,
    }),
    cache: "no-store",
  });

  redirect(`/dashboard/patients/${id}`);
}

export default async function PatientDetailPage({ params }: { params: { id: string } }) {
  if (!isSupabaseConfigured()) {
    return (
      <main className="mx-auto w-full max-w-5xl px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Patient</h1>
        <p className="mt-2 text-sm text-zinc-600">Supabase is not configured.</p>
        <Link className="ui-btn-primary mt-6 inline-flex rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white" href="/setup">
          Go to setup
        </Link>
      </main>
    );
  }

  const res = await apiFetch(`/api/patients/${params.id}`, { cache: "no-store" });
  const json = (await res.json().catch(() => null)) as { data?: Patient } | null;
  const patient = json?.data;

  if (!patient) {
    return (
      <main className="mx-auto w-full max-w-5xl px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Patient not found</h1>
        <Link className="ui-btn-secondary mt-6 inline-flex rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700" href="/dashboard/patients">
          Back
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      <Breadcrumbs items={[{ label: "Patients", href: "/dashboard/patients" }, { label: patient.full_name }]} />
      <div className="mt-4 flex items-center justify-between gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{patient.full_name}</h1>
          <p className="mt-2 text-sm text-zinc-600">Edit patient details.</p>
        </div>
        <Link
          className="inline-flex items-center gap-1 rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          href="/dashboard/patients"
        >
          <span aria-hidden>←</span> Back to patients
        </Link>
      </div>

      <section className="mt-8 rounded-lg border bg-white p-6">
        <form action={updatePatient.bind(null, patient.id)} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium">MRN</span>
            <input defaultValue={patient.mrn ?? ""} name="mrn" className="mt-1 w-full rounded-md border px-3 py-2 text-sm" />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Full name</span>
            <input defaultValue={patient.full_name} name="full_name" required className="mt-1 w-full rounded-md border px-3 py-2 text-sm" />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Date of birth</span>
            <input defaultValue={patient.date_of_birth ?? ""} name="date_of_birth" type="date" className="mt-1 w-full rounded-md border px-3 py-2 text-sm" />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Gender</span>
            <select
              defaultValue={patient.gender ?? ""}
              name="gender"
              className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm"
            >
              <option value="">Select…</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other / prefer not to say</option>
            </select>
          </label>
          <label className="block sm:col-span-2">
            <span className="text-sm font-medium">Notes</span>
            <textarea defaultValue={patient.notes ?? ""} name="notes" className="mt-1 min-h-24 w-full rounded-md border px-3 py-2 text-sm" />
          </label>

          <label className="flex items-center gap-2 pt-2">
            <input defaultChecked={patient.is_active} name="is_active" type="checkbox" className="h-4 w-4 rounded border" />
            <span className="text-sm font-medium">Active</span>
          </label>

          <div className="sm:col-span-2 pt-2">
            <button type="submit" className="ui-btn-primary rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white">
              Save
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
