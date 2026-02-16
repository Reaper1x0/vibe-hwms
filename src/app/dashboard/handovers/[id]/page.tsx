import Link from "next/link";
import { redirect } from "next/navigation";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { apiFetch } from "@/lib/api/origin";
import { isSupabaseConfigured } from "@/lib/env";

type Handover = {
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
  updated_at: string;
};

type Patient = {
  id: string;
  full_name: string;
};

async function updateHandover(id: string, formData: FormData) {
  "use server";

  const notes = String(formData.get("notes") ?? "").trim();
  const isActive = formData.get("is_active") === "on";

  await apiFetch(`/api/handovers/${id}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      notes: notes || null,
      is_active: isActive,
    }),
    cache: "no-store",
  });

  redirect(`/dashboard/handovers/${id}`);
}

export default async function HandoverDetailPage({ params }: { params: { id: string } }) {
  if (!isSupabaseConfigured()) {
    return (
      <main className="mx-auto w-full max-w-5xl px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Handover</h1>
        <p className="mt-2 text-sm text-zinc-600">Supabase is not configured.</p>
        <Link className="ui-btn-primary mt-6 inline-flex rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white" href="/setup">
          Go to setup
        </Link>
      </main>
    );
  }

  const res = await apiFetch(`/api/handovers/${params.id}`, { cache: "no-store" });
  if (res.status === 403) {
    return (
      <main className="mx-auto w-full max-w-5xl px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Handover</h1>
        <p className="mt-2 text-sm text-zinc-600">You don’t have permission to view this handover.</p>
        <Link className="ui-btn-secondary mt-6 inline-flex rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700" href="/dashboard/handovers">
          Back
        </Link>
      </main>
    );
  }

  const json = (await res.json().catch(() => null)) as { data?: Handover } | null;
  const handover = json?.data;

  if (!handover) {
    return (
      <main className="mx-auto w-full max-w-5xl px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Handover not found</h1>
        <Link className="ui-btn-secondary mt-6 inline-flex rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700" href="/dashboard/handovers">
          Back
        </Link>
      </main>
    );
  }

  let patient: Patient | null = null;
  if (handover?.patient_id) {
    const patientRes = await apiFetch(`/api/patients/${handover.patient_id}`, { cache: "no-store" });
    const patientJson = (await patientRes.json().catch(() => null)) as { data?: Patient } | null;
    patient = patientJson?.data ?? null;
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      <Breadcrumbs items={[{ label: "Handovers", href: "/dashboard/handovers" }, { label: "Handover" }]} />
      <div className="mt-4 flex items-center justify-between gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Handover</h1>
          <p className="mt-2 text-sm text-zinc-600">Clinical handover between team members.</p>
          <p className="mt-1 text-xs text-zinc-500">
            Created at {new Date(handover.created_at).toLocaleString()}
          </p>
        </div>
        <Link
          className="inline-flex items-center gap-1 rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          href="/dashboard/handovers"
        >
          <span aria-hidden>←</span> Back to handovers
        </Link>
      </div>

      <section className="mt-8 rounded-lg border bg-white p-6">
        {patient ? (
          <div className="mb-4 rounded-md border border-zinc-100 bg-zinc-50 px-4 py-3 text-sm">
            <div className="text-xs uppercase tracking-wide text-zinc-500">Patient</div>
            <div className="mt-1 font-medium text-zinc-900">{patient.full_name}</div>
            <div className="mt-1 text-xs">
              <Link href={`/dashboard/patients/${patient.id}`} className="ui-link text-zinc-700 underline">
                View patient chart
              </Link>
            </div>
          </div>
        ) : null}

        <form action={updateHandover.bind(null, handover.id)} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="text-sm font-medium">Notes</span>
            <textarea defaultValue={handover.notes ?? ""} name="notes" className="mt-1 min-h-24 w-full rounded-md border px-3 py-2 text-sm" />
          </label>

          <label className="flex items-center gap-2 pt-2">
            <input defaultChecked={handover.is_active} name="is_active" type="checkbox" className="h-4 w-4 rounded border" />
            <span className="text-sm font-medium">Active</span>
          </label>

          <div className="sm:col-span-2 pt-2">
            <button type="submit" className="ui-btn-primary rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white">
              Save
            </button>
          </div>
        </form>
      </section>

      {/* Raw section removed for clinicians; can be reintroduced in a separate admin/debug view if needed */}
    </main>
  );
}
