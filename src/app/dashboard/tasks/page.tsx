import Link from "next/link";
import { redirect } from "next/navigation";

import { FormSubmitButton } from "@/components/FormSubmitButton";
import { apiFetch } from "@/lib/api/origin";
import { isSupabaseConfigured } from "@/lib/env";

type TaskRow = {
  id: string;
  title: string;
  status: string;
  priority: string;
  patient_id: string | null;
  assigned_to: string | null;
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

async function createTask(formData: FormData) {
  "use server";

  const hospitalId = String(formData.get("hospital_id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const patientId = String(formData.get("patient_id") ?? "").trim();

  if (!title) {
    redirect("/dashboard/tasks?error=Title%20is%20required");
    return;
  }

  try {
    const res = await apiFetch("/api/tasks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        hospital_id: hospitalId || undefined,
        title,
        description: description || null,
        patient_id: patientId || null,
      }),
      cache: "no-store",
    });

    if (res.ok) {
      redirect("/dashboard/tasks?success=1");
    } else {
      const error = await res.json().catch(() => ({ error: "Failed to create task" }));
      redirect(`/dashboard/tasks?error=${encodeURIComponent(error.error || "Failed to create task")}`);
    }
  } catch (e) {
    redirect(`/dashboard/tasks?error=${encodeURIComponent(e instanceof Error ? e.message : "Unknown error")}`);
  }
}

const TASKS_PAGE_SIZE = 25;

export default async function TasksPage({
  searchParams,
}: {
  searchParams?: { status?: string; priority?: string; mine?: string; page?: string; success?: string; error?: string };
}) {
  if (!isSupabaseConfigured()) {
    return (
      <main className="mx-auto w-full max-w-5xl px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
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
          user?: { id?: string };
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

  const patientsRes = await apiFetch("/api/patients?limit=1000", { cache: "no-store" });
  const patientsJson = (await patientsRes.json().catch(() => ({ data: [] }))) as { data: PatientRow[] };
  const patients = patientsJson.data ?? [];

  const statusFilter = searchParams?.status ?? "all";
  const priorityFilter = searchParams?.priority ?? "all";
  const mineFilter = searchParams?.mine === "1";
  const page = Math.max(1, parseInt(String(searchParams?.page ?? "1"), 10) || 1);
  const offset = (page - 1) * TASKS_PAGE_SIZE;

  const tasksParams = new URLSearchParams();
  tasksParams.set("limit", String(TASKS_PAGE_SIZE));
  tasksParams.set("offset", String(offset));
  if (statusFilter !== "all") {
    tasksParams.set("status", statusFilter);
  }
  if (priorityFilter !== "all") {
    tasksParams.set("priority", priorityFilter);
  }
  if (mineFilter && userId) {
    tasksParams.set("assigned_to", userId);
  }

  const tasksRes = await apiFetch(`/api/tasks?${tasksParams.toString()}`, { cache: "no-store" });
  const tasksJson = (await tasksRes.json().catch(() => ({ data: [], pagination: { total: 0, limit: TASKS_PAGE_SIZE, offset: 0, hasMore: false } }))) as {
    data: TaskRow[];
    pagination: { total: number; limit: number; offset: number; hasMore: boolean };
  };
  const tasks = tasksJson.data ?? [];
  const pagination = tasksJson.pagination ?? { total: 0, limit: TASKS_PAGE_SIZE, offset: 0, hasMore: false };

  const patientNameById = new Map(patients.map((p) => [p.id, p.full_name]));

  const totalPages = Math.max(1, Math.ceil(pagination.total / TASKS_PAGE_SIZE));

  function formatStatus(status: string) {
    if (status === "in_progress") return "In progress";
    if (status === "todo") return "To do";
    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  function statusClasses(status: string) {
    if (status === "in_progress") return "inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-800";
    if (status === "done") return "inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800";
    if (status === "cancelled") return "inline-flex rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700";
    return "inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800";
  }

  function priorityClasses(priority: string) {
    if (priority === "critical") return "inline-flex rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-900";
    if (priority === "high") return "inline-flex rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700";
    if (priority === "medium") return "inline-flex rounded-full bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-800";
    if (priority === "low") return "inline-flex rounded-full bg-zinc-50 px-2 py-0.5 text-xs font-medium text-zinc-700";
    return "inline-flex rounded-full bg-zinc-50 px-2 py-0.5 text-xs font-medium text-zinc-700";
  }

  const showSuccess = searchParams?.success === "1";

  const errorMessage = searchParams?.error ? decodeURIComponent(searchParams.error) : null;

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      {errorMessage ? (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900" role="alert">
          {errorMessage}
        </div>
      ) : null}
      {showSuccess ? (
        <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900" role="status">
          Task created.
        </div>
      ) : null}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
        <p className="mt-2 text-sm text-zinc-600">Task list for patient care.</p>
      </div>

      <section className="mt-8 rounded-lg border bg-white p-6">
        <h2 className="text-base font-semibold">Create task</h2>
        <form action={createTask} className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-4">
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
            <span className="text-sm font-medium">Title</span>
            <input name="title" required className="mt-1 w-full rounded-md border px-3 py-2 text-sm" />
          </label>

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
            <span className="text-sm font-medium">Description</span>
            <textarea name="description" className="mt-1 min-h-24 w-full rounded-md border px-3 py-2 text-sm" />
          </label>

          <div className="sm:col-span-4">
            <FormSubmitButton label="Create" loadingLabel="Creating…" />
          </div>
        </form>
      </section>

      <section className="mt-8 overflow-hidden rounded-lg border bg-white">
        <div className="border-b px-6 py-4">
          <h2 className="text-base font-semibold">Tasks</h2>
          <form className="mt-3 flex flex-wrap items-center gap-3 text-xs" method="GET">
            <label className="flex items-center gap-1">
              <span className="text-zinc-600">Status</span>
              <select
                name="status"
                defaultValue={statusFilter}
                className="rounded-md border bg-white px-2 py-1 text-xs"
              >
                <option value="all">All</option>
                <option value="open">Open (To do / In progress)</option>
                <option value="todo">To do</option>
                <option value="in_progress">In progress</option>
                <option value="done">Done</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </label>
            <label className="flex items-center gap-1">
              <span className="text-zinc-600">Priority</span>
              <select
                name="priority"
                defaultValue={priorityFilter}
                className="rounded-md border bg-white px-2 py-1 text-xs"
              >
                <option value="all">All</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </label>
            <label className="flex items-center gap-1">
              <span className="text-zinc-600">Assigned</span>
              <select
                name="mine"
                defaultValue={mineFilter ? "1" : ""}
                className="rounded-md border bg-white px-2 py-1 text-xs"
              >
                <option value="">All</option>
                <option value="1">Assigned to me</option>
              </select>
            </label>
            <input type="hidden" name="page" value="1" />
            <button
              type="submit"
              className="rounded-md border bg-white px-3 py-1 text-xs font-medium text-zinc-700"
            >
              Apply
            </button>
          </form>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm" aria-label="Tasks list">
            <thead className="bg-zinc-50 text-zinc-600">
              <tr>
                <th scope="col" className="px-6 py-3 font-medium">Task</th>
                <th scope="col" className="px-6 py-3 font-medium">Status</th>
                <th scope="col" className="px-6 py-3 font-medium">Priority</th>
                <th scope="col" className="px-6 py-3 font-medium">Patient</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((t) => (
                <tr key={t.id} className="border-t">
                  <td className="px-6 py-3">
                    <Link className="font-medium text-zinc-900 underline" href={`/dashboard/tasks/${t.id}`}>
                      {t.title}
                    </Link>
                    <p className="mt-1 text-xs text-zinc-500">{new Date(t.created_at).toLocaleString()}</p>
                  </td>
                  <td className="px-6 py-3 text-zinc-700">
                    <span className={statusClasses(t.status)}>{formatStatus(t.status)}</span>
                  </td>
                  <td className="px-6 py-3 text-zinc-700">
                    <span className={priorityClasses(t.priority)}>{t.priority.charAt(0).toUpperCase() + t.priority.slice(1)}</span>
                  </td>
                  <td className="px-6 py-3 text-zinc-700">
                    {t.patient_id ? patientNameById.get(t.patient_id) ?? "Linked patient" : "—"}
                  </td>
                </tr>
              ))}
              {tasks.length === 0 ? (
                <tr>
                  <td className="px-6 py-10 text-center text-zinc-600" colSpan={4}>
                    {pagination.total === 0 ? (
                      <>
                        No tasks match the current filters.{" "}
                        <Link href="/dashboard/tasks" className="font-medium text-zinc-900 underline">
                          Clear filters
                        </Link>{" "}
                        or create a task above.
                      </>
                    ) : (
                      "No tasks on this page."
                    )}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        {totalPages > 1 ? (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t px-6 py-3 text-sm text-zinc-600">
            <span>
              Page {page} of {totalPages} ({pagination.total} tasks)
            </span>
            <div className="flex gap-2">
              {page > 1 ? (
                <Link
                  href={`/dashboard/tasks?status=${statusFilter}&priority=${priorityFilter}&mine=${mineFilter ? "1" : ""}&page=${page - 1}`}
                  className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-zinc-50"
                >
                  Previous
                </Link>
              ) : null}
              {page < totalPages ? (
                <Link
                  href={`/dashboard/tasks?status=${statusFilter}&priority=${priorityFilter}&mine=${mineFilter ? "1" : ""}&page=${page + 1}`}
                  className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-zinc-50"
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
