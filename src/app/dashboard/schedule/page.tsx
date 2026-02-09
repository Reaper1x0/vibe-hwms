import Link from "next/link";
import { redirect } from "next/navigation";
import { Fragment } from "react";

import { apiFetch } from "@/lib/api/origin";
import { isSupabaseConfigured } from "@/lib/env";

type ShiftRow = {
  id: string;
  hospital_id: string;
  department_id: string | null;
  assigned_user_id: string | null;
  shift_type: string | null;
  start_at: string;
  end_at: string;
  is_active: boolean;
};

type HospitalRow = {
  id: string;
  name: string;
};

async function createShift(formData: FormData) {
  "use server";

  const hospitalId = String(formData.get("hospital_id") ?? "");
  const startAt = String(formData.get("start_at") ?? "");
  const endAt = String(formData.get("end_at") ?? "");
  const shiftType = String(formData.get("shift_type") ?? "").trim();

  if (!hospitalId || !startAt || !endAt) {
    redirect("/dashboard/schedule?error=Please%20fill%20hospital%20and%20start%20and%20end%20times");
  }
  if (endAt <= startAt) {
    redirect("/dashboard/schedule?error=End%20time%20must%20be%20after%20start%20time");
  }

  const res = await apiFetch("/api/shifts", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      hospital_id: hospitalId,
      start_at: startAt,
      end_at: endAt,
      shift_type: shiftType || null,
    }),
    cache: "no-store",
  });

  if (res.ok) {
    redirect("/dashboard/schedule?success=1");
  }
}

export default async function SchedulePage({
  searchParams,
}: {
  searchParams?: { error?: string; success?: string; period?: string };
}) {
  if (!isSupabaseConfigured()) {
    return (
      <main className="mx-auto w-full max-w-5xl px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Schedule</h1>
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
  const userId = meJson?.data?.user?.id ?? null;
  const scopedHospitalId = meJson?.data?.profile?.hospital_id ?? null;

  let hospitals: HospitalRow[] = [];
  if (role === "super_admin") {
    const hospitalsRes = await apiFetch("/api/hospitals", { cache: "no-store" });
    const hospitalsJson = (await hospitalsRes.json().catch(() => ({ data: [] }))) as { data: HospitalRow[] };
    hospitals = hospitalsJson.data ?? [];
  }

  const shiftsRes = await apiFetch("/api/shifts", { cache: "no-store" });
  const shiftsJson = (await shiftsRes.json().catch(() => ({ data: [] }))) as { data: ShiftRow[] };
  const allShifts = shiftsJson.data ?? [];

  const now = new Date();
  const period = searchParams?.period ?? "upcoming";
  const shifts =
    period === "past"
      ? allShifts.filter((s) => new Date(s.end_at) < now)
      : period === "all"
        ? allShifts
        : allShifts.filter((s) => new Date(s.end_at) >= now);

  const canManage = role === "super_admin" || role === "admin" || role === "hod";

  const errorMessage = searchParams?.error ? decodeURIComponent(searchParams.error) : null;
  const showSuccess = searchParams?.success === "1";

  const shiftsByDay = shifts.reduce<Record<string, ShiftRow[]>>((acc, s) => {
    const day = new Date(s.start_at).toISOString().slice(0, 10);
    if (!acc[day]) acc[day] = [];
    acc[day].push(s);
    return acc;
  }, {});
  const sortedDays = Object.keys(shiftsByDay).sort();

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      {errorMessage ? (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900" role="alert">
          {errorMessage}
        </div>
      ) : null}
      {showSuccess ? (
        <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900" role="status">
          Shift created.
        </div>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Schedule</h1>
          <p className="mt-2 text-sm text-zinc-600">Shifts and duty roster.</p>
        </div>
        <div className="flex gap-2 text-sm">
          <a
            href="/dashboard/schedule?period=upcoming"
            className={`rounded-md px-3 py-1.5 font-medium ${period === "upcoming" ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"}`}
          >
            Upcoming
          </a>
          <a
            href="/dashboard/schedule?period=past"
            className={`rounded-md px-3 py-1.5 font-medium ${period === "past" ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"}`}
          >
            Past
          </a>
          <a
            href="/dashboard/schedule?period=all"
            className={`rounded-md px-3 py-1.5 font-medium ${period === "all" ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"}`}
          >
            All
          </a>
        </div>
      </div>

      {canManage ? (
        <section className="mt-8 rounded-lg border bg-white p-6">
          <h2 className="text-base font-semibold">Create shift</h2>
          <form action={createShift} className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-4">
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
              <span className="text-sm font-medium">Start</span>
              <input name="start_at" type="datetime-local" required className="mt-1 w-full rounded-md border px-3 py-2 text-sm" />
            </label>
            <label className="block">
              <span className="text-sm font-medium">End</span>
              <input name="end_at" type="datetime-local" required className="mt-1 w-full rounded-md border px-3 py-2 text-sm" />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-sm font-medium">Shift type</span>
              <input name="shift_type" className="mt-1 w-full rounded-md border px-3 py-2 text-sm" />
            </label>

            <div className="sm:col-span-4">
              <button type="submit" className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white">
                Create
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="mt-8 overflow-hidden rounded-lg border bg-white">
        <div className="border-b px-6 py-4">
          <h2 className="text-base font-semibold">Shifts</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm" aria-label="Schedule">
            <thead className="bg-zinc-50 text-zinc-600">
              <tr>
                <th scope="col" className="px-6 py-3 font-medium">Start</th>
                <th scope="col" className="px-6 py-3 font-medium">End</th>
                <th scope="col" className="px-6 py-3 font-medium">Type</th>
                <th scope="col" className="px-6 py-3 font-medium">Assigned</th>
                <th scope="col" className="px-6 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {sortedDays.length === 0 ? (
                <tr>
                  <td className="px-6 py-10 text-zinc-600" colSpan={5}>
                    No shifts in this view.
                  </td>
                </tr>
              ) : (
                sortedDays.map((day) => (
                  <Fragment key={day}>
                    <tr className="border-t bg-zinc-50">
                      <td colSpan={5} className="px-6 py-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
                        {new Date(day + "T12:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                      </td>
                    </tr>
                    {shiftsByDay[day].map((s) => {
                      const isPast = new Date(s.end_at) < now;
                      return (
                        <tr key={s.id} className={`border-t ${isPast ? "text-zinc-500" : ""}`}>
                          <td className="px-6 py-3 text-zinc-700">{new Date(s.start_at).toLocaleString()}</td>
                          <td className="px-6 py-3 text-zinc-700">{new Date(s.end_at).toLocaleString()}</td>
                          <td className="px-6 py-3 text-zinc-700">{s.shift_type ?? "—"}</td>
                          <td className="px-6 py-3 text-zinc-700">
                            {s.assigned_user_id
                              ? userId && s.assigned_user_id === userId
                                ? "You"
                                : "Assigned"
                              : "Unassigned"}
                          </td>
                          <td className="px-6 py-3">
                            <span className={s.is_active ? "text-emerald-700" : "text-zinc-500"}>{s.is_active ? "Active" : "Inactive"}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
