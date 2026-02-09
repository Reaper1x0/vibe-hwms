import Link from "next/link";
import { redirect } from "next/navigation";

import { isSupabaseConfigured } from "@/lib/env";
import { apiFetch } from "@/lib/api/origin";

type Hospital = {
  id: string;
  name: string;
  code: string;
  address: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

async function updateHospital(id: string, formData: FormData) {
  "use server";

  const name = String(formData.get("name") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const isActive = formData.get("is_active") === "on";

  await apiFetch(`/api/hospitals/${id}`, {
    method: "PUT",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      name,
      code,
      city: city || null,
      is_active: isActive,
    }),
    cache: "no-store",
  });

  redirect(`/dashboard/hospitals/${id}`);
}

export default async function HospitalDetailPage({ params }: { params: { id: string } }) {
  if (!isSupabaseConfigured()) {
    return (
      <main className="mx-auto w-full max-w-5xl px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Hospital</h1>
        <p className="mt-2 text-sm text-zinc-600">Supabase is not configured.</p>
        <Link className="mt-6 inline-flex rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white" href="/setup">
          Go to setup
        </Link>
      </main>
    );
  }

  const res = await apiFetch(`/api/hospitals/${params.id}`, { cache: "no-store" });
  if (res.status === 403) {
    return (
      <main className="mx-auto w-full max-w-5xl px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Hospital</h1>
        <p className="mt-2 text-sm text-zinc-600">You don’t have permission to view this hospital.</p>
        <Link className="mt-6 inline-flex rounded-md border bg-white px-4 py-2 text-sm font-medium" href="/dashboard">
          Back
        </Link>
      </main>
    );
  }
  const json = (await res.json().catch(() => null)) as { data?: Hospital } | null;
  const hospital = json?.data;

  if (!hospital) {
    return (
      <main className="mx-auto w-full max-w-5xl px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Hospital not found</h1>
        <Link className="mt-6 inline-flex rounded-md border bg-white px-4 py-2 text-sm font-medium" href="/dashboard/hospitals">
          Back
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      <div className="flex items-center justify-between gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{hospital.name}</h1>
          <p className="mt-2 text-sm text-zinc-600">Edit hospital details and status.</p>
        </div>
        <Link className="rounded-md border bg-white px-4 py-2 text-sm font-medium" href="/dashboard/hospitals">
          Back
        </Link>
      </div>

      <section className="mt-8 rounded-lg border bg-white p-6">
        <form action={updateHospital.bind(null, hospital.id)} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium">Name</span>
            <input defaultValue={hospital.name} name="name" required className="mt-1 w-full rounded-md border px-3 py-2 text-sm" />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Code</span>
            <input defaultValue={hospital.code} name="code" required className="mt-1 w-full rounded-md border px-3 py-2 text-sm" />
          </label>
          <label className="block">
            <span className="text-sm font-medium">City</span>
            <input defaultValue={hospital.city ?? ""} name="city" className="mt-1 w-full rounded-md border px-3 py-2 text-sm" />
          </label>

          <label className="flex items-center gap-2 pt-6">
            <input defaultChecked={hospital.is_active} name="is_active" type="checkbox" className="h-4 w-4 rounded border" />
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
