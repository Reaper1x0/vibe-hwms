import Link from "next/link";
import { redirect } from "next/navigation";

import { AutoSubmitForm } from "@/components/AutoSubmitForm";
import { CreateFormToggle } from "@/components/CreateFormToggle";
import { FormSubmitButton } from "@/components/FormSubmitButton";
import { apiFetch } from "@/lib/api/origin";
import { isSupabaseConfigured } from "@/lib/env";
import { DEFAULT_PAGE_SIZE, parseLimit, ROWS_PER_PAGE_OPTIONS } from "@/lib/table-pagination";

type PatientRow = {
  id: string;
  hospital_id: string;
  mrn: string | null;
  full_name: string;
  date_of_birth: string | null;
  gender: string | null;
  is_active: boolean;
};

type HospitalRow = {
  id: string;
  name: string;
};

async function createPatient(formData: FormData) {
  "use server";

  const hospitalId = String(formData.get("hospital_id") ?? "");
  const mrn = String(formData.get("mrn") ?? "").trim();
  const fullName = String(formData.get("full_name") ?? "").trim();
  const dob = String(formData.get("date_of_birth") ?? "");
  const gender = String(formData.get("gender") ?? "").trim();

  if (!hospitalId || !fullName) {
    redirect("/dashboard/patients?error=Hospital%20and%20name%20are%20required");
    return;
  }

  try {
    const res = await apiFetch("/api/patients", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        hospital_id: hospitalId,
        mrn: mrn || null,
        full_name: fullName,
        date_of_birth: dob || null,
        gender: gender || null,
      }),
      cache: "no-store",
    });

    if (res.ok) {
      redirect("/dashboard/patients?success=1");
    } else {
      const error = await res.json().catch(() => ({ error: "Failed to create patient" }));
      redirect(`/dashboard/patients?error=${encodeURIComponent(error.error || "Failed to create patient")}`);
    }
  } catch (e) {
    redirect(`/dashboard/patients?error=${encodeURIComponent(e instanceof Error ? e.message : "Unknown error")}`);
  }
}

export default async function PatientsPage({
  searchParams,
}: {
  searchParams?: { q?: string; active?: string; page?: string; limit?: string; success?: string; error?: string };
}) {
  if (!isSupabaseConfigured()) {
    return (
      <main className="mx-auto w-full max-w-5xl px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Patients</h1>
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
          profile?: { role?: string; hospital_id?: string | null } | null;
        };
      }
    | null;

  const role = meJson?.data?.profile?.role;
  const scopedHospitalId = meJson?.data?.profile?.hospital_id ?? null;

  let hospitals: HospitalRow[] = [];
  if (role === "super_admin") {
    const hospitalsRes = await apiFetch("/api/hospitals", { cache: "no-store" });
    const hospitalsJson = (await hospitalsRes.json().catch(() => ({ data: [] }))) as { data: HospitalRow[] };
    hospitals = hospitalsJson.data ?? [];
  }

  const q = searchParams?.q ?? "";
  const activeFilter = searchParams?.active ?? "all";
  const limit = parseLimit(searchParams?.limit);
  const page = Math.max(1, parseInt(String(searchParams?.page ?? "1"), 10) || 1);
  const offset = (page - 1) * limit;

  const patientsParams = new URLSearchParams();
  patientsParams.set("limit", String(limit));
  patientsParams.set("offset", String(offset));
  if (q) {
    patientsParams.set("q", q);
  }
  if (activeFilter !== "all") {
    patientsParams.set("active", activeFilter);
  }

  const patientsRes = await apiFetch(`/api/patients?${patientsParams.toString()}`, { cache: "no-store" });
  const patientsJson = (await patientsRes.json().catch(() => ({ data: [], pagination: { total: 0, limit: DEFAULT_PAGE_SIZE, offset: 0, hasMore: false } }))) as {
    data: PatientRow[];
    pagination: { total: number; limit: number; offset: number; hasMore: boolean };
  };
  const patients = patientsJson.data ?? [];
  const pagination = patientsJson.pagination ?? { total: 0, limit: DEFAULT_PAGE_SIZE, offset: 0, hasMore: false };

  const totalPages = Math.max(1, Math.ceil(pagination.total / limit));

  const showSuccess = searchParams?.success === "1";

  const errorMessage = searchParams?.error ? decodeURIComponent(searchParams.error) : null;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-10 min-h-0">
      {errorMessage ? (
        <div className="shrink-0 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900" role="alert">
          {errorMessage}
        </div>
      ) : null}
      {showSuccess ? (
        <div className="shrink-0 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900" role="status">
          Patient created.
        </div>
      ) : null}
      <div className="shrink-0">
        <h1 className="text-2xl font-semibold tracking-tight">Patients</h1>
        <p className="mt-2 text-sm text-zinc-600">Patient directory for task linking.</p>
      </div>

      <CreateFormToggle title="Create patient" buttonLabel="Add patient">
        <form action={createPatient} className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          {role === "super_admin" ? (
            <label className="block sm:col-span-2">
              <span className="text-sm font-medium">Hospital</span>
              <select name="hospital_id" required defaultValue="" className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm">
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

          <label className="block">
            <span className="text-sm font-medium">MRN</span>
            <input
              name="mrn"
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              placeholder="e.g. ER-2026-0001"
            />
            <p className="mt-1 text-xs text-zinc-500">Use the medical record number used in your hospital.</p>
          </label>

          <label className="block sm:col-span-2">
            <span className="text-sm font-medium">Full name</span>
            <input name="full_name" required className="mt-1 w-full rounded-md border px-3 py-2 text-sm" />
          </label>

          <label className="block">
            <span className="text-sm font-medium">Date of birth</span>
            <input name="date_of_birth" type="date" className="mt-1 w-full rounded-md border px-3 py-2 text-sm" />
          </label>

          <label className="block">
            <span className="text-sm font-medium">Gender</span>
            <select name="gender" className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm" defaultValue="">
              <option value="">Select…</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other / prefer not to say</option>
            </select>
          </label>

          <div className="sm:col-span-4">
            <FormSubmitButton label="Create" loadingLabel="Creating…" />
          </div>
        </form>
      </CreateFormToggle>

      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border bg-white">
        <div className="shrink-0 border-b px-6 py-4">
          <h2 className="text-base font-semibold">Patients</h2>
          <AutoSubmitForm className="mt-3 flex flex-wrap items-center gap-3 text-xs">
            <input type="hidden" name="page" value="1" />
            <label className="flex items-center gap-1">
              <span className="text-zinc-600">Search</span>
              <input
                name="q"
                defaultValue={searchParams?.q ?? ""}
                placeholder="Name or MRN (Enter to apply)"
                className="w-40 rounded-md border px-2 py-1 text-xs"
              />
            </label>
            <label className="flex items-center gap-1">
              <span className="text-zinc-600">Status</span>
              <select
                name="active"
                defaultValue={activeFilter}
                className="rounded-md border bg-white px-2 py-1 text-xs"
              >
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
            <label className="flex items-center gap-1">
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
            </label>
          </AutoSubmitForm>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full text-left text-sm" aria-label="Patients list">
            <thead className="bg-zinc-50 text-zinc-600">
              <tr>
                <th scope="col" className="px-6 py-3 font-medium">MRN</th>
                <th scope="col" className="px-6 py-3 font-medium">Name</th>
                <th scope="col" className="px-6 py-3 font-medium">DOB</th>
                <th scope="col" className="px-6 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {patients.map((p) => (
                <tr key={p.id} className="border-t">
                  <td className="px-6 py-3 text-zinc-700">{p.mrn ?? "—"}</td>
                  <td className="px-6 py-3">
                    <Link className="ui-link font-medium text-zinc-900 underline" href={`/dashboard/patients/${p.id}`}>
                      {p.full_name}
                    </Link>
                  </td>
                  <td className="px-6 py-3 text-zinc-700">{p.date_of_birth ?? "—"}</td>
                  <td className="px-6 py-3">
                    <span className={p.is_active ? "text-emerald-700" : "text-zinc-500"}>{p.is_active ? "Active" : "Inactive"}</span>
                  </td>
                </tr>
              ))}
              {patients.length === 0 ? (
                <tr>
                  <td className="px-6 py-10 text-center text-zinc-600" colSpan={4}>
                    {pagination.total === 0
                      ? "No patients yet. Add a patient using the form above."
                      : "No patients on this page."}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        {totalPages > 1 ? (
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t px-6 py-3 text-sm text-zinc-600">
            <span>
              Page {page} of {totalPages} ({pagination.total} patients)
            </span>
            <div className="flex gap-2">
              {page > 1 ? (
                <Link
                  href={`/dashboard/patients?q=${encodeURIComponent(searchParams?.q ?? "")}&active=${activeFilter}&limit=${limit}&page=${page - 1}`}
                  className="ui-btn-secondary rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium"
                >
                  Previous
                </Link>
              ) : null}
              {page < totalPages ? (
                <Link
                  href={`/dashboard/patients?q=${encodeURIComponent(searchParams?.q ?? "")}&active=${activeFilter}&limit=${limit}&page=${page + 1}`}
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
