import Link from "next/link";
import { redirect } from "next/navigation";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { apiFetch } from "@/lib/api/origin";
import { isSupabaseConfigured } from "@/lib/env";

type Task = {
  id: string;
  hospital_id: string;
  patient_id: string | null;
  created_by: string;
  assigned_to: string | null;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_at: string | null;
  is_active: boolean;
};

type Patient = {
  id: string;
  full_name: string;
};

type Comment = {
  id: string;
  task_id: string;
  user_id: string;
  body: string;
  created_at: string;
};

async function updateTask(id: string, formData: FormData) {
  "use server";

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const status = String(formData.get("status") ?? "");
  const priority = String(formData.get("priority") ?? "");
  const isActive = formData.get("is_active") === "on";

  await apiFetch(`/api/tasks/${id}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      title,
      description: description || null,
      status,
      priority,
      is_active: isActive,
    }),
    cache: "no-store",
  });

  redirect(`/dashboard/tasks/${id}`);
}

async function assignToMe(taskId: string, userId: string) {
  "use server";
  await apiFetch(`/api/tasks/${taskId}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ assigned_to: userId }),
    cache: "no-store",
  });
  redirect(`/dashboard/tasks/${taskId}`);
}

async function addComment(id: string, formData: FormData) {
  "use server";

  const body = String(formData.get("body") ?? "").trim();
  if (!body) return;

  await apiFetch(`/api/tasks/${id}/comments`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ body }),
    cache: "no-store",
  });

  redirect(`/dashboard/tasks/${id}`);
}

export default async function TaskDetailPage({ params }: { params: { id: string } }) {
  if (!isSupabaseConfigured()) {
    return (
      <main className="mx-auto w-full max-w-5xl px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Task</h1>
        <p className="mt-2 text-sm text-zinc-600">Supabase is not configured.</p>
        <Link className="mt-6 inline-flex rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white" href="/setup">
          Go to setup
        </Link>
      </main>
    );
  }

  const res = await apiFetch(`/api/tasks/${params.id}`, { cache: "no-store" });
  const json = (await res.json().catch(() => null)) as { data?: Task } | null;
  const task = json?.data;

  if (!task) {
    return (
      <main className="mx-auto w-full max-w-5xl px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Task not found</h1>
        <Link className="mt-6 inline-flex rounded-md border bg-white px-4 py-2 text-sm font-medium" href="/dashboard/tasks">
          Back
        </Link>
      </main>
    );
  }

  const commentsRes = await apiFetch(`/api/tasks/${task.id}/comments`, { cache: "no-store" });
  const commentsJson = (await commentsRes.json().catch(() => ({ data: [] }))) as { data: Comment[] };
  const comments = commentsJson.data ?? [];

  const meRes = await apiFetch("/api/auth/me", { cache: "no-store" });
  const meJson = (await meRes.json().catch(() => null)) as
    | {
        data?: {
          user?: { id?: string };
        };
      }
    | null;
  const userId = meJson?.data?.user?.id ?? null;

  let patient: Patient | null = null;
  if (task.patient_id) {
    const patientRes = await apiFetch(`/api/patients/${task.patient_id}`, { cache: "no-store" });
    const patientJson = (await patientRes.json().catch(() => null)) as { data?: Patient } | null;
    patient = patientJson?.data ?? null;
  }

  const isAssignedToMe = userId && task.assigned_to === userId;

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      <Breadcrumbs items={[{ label: "Tasks", href: "/dashboard/tasks" }, { label: task.title }]} />
      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{task.title}</h1>
          <p className="mt-2 text-sm text-zinc-600">Clinical task linked to your schedule and patients.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {userId && !isAssignedToMe ? (
            <form action={assignToMe.bind(null, task.id, userId)}>
              <button type="submit" className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
                Assign to me
              </button>
            </form>
          ) : null}
          <Link
            className="inline-flex items-center gap-1 rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            href="/dashboard/tasks"
          >
            <span aria-hidden>←</span> Back to tasks
          </Link>
        </div>
      </div>

      <section className="mt-8 rounded-lg border bg-white p-6">
        {patient ? (
          <div className="mb-4 rounded-md border border-zinc-100 bg-zinc-50 px-4 py-3 text-sm">
            <div className="text-xs uppercase tracking-wide text-zinc-500">Linked patient</div>
            <div className="mt-1 font-medium text-zinc-900">{patient.full_name}</div>
            <div className="mt-1 text-xs">
              <Link href={`/dashboard/patients/${patient.id}`} className="text-zinc-700 underline">
                View patient chart
              </Link>
            </div>
          </div>
        ) : null}

        <form action={updateTask.bind(null, task.id)} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="text-sm font-medium">Title</span>
            <input defaultValue={task.title} name="title" required className="mt-1 w-full rounded-md border px-3 py-2 text-sm" />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Status</span>
            <select defaultValue={task.status} name="status" className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm">
              <option value="todo">To do</option>
              <option value="in_progress">In progress</option>
              <option value="done">Done</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium">Priority</span>
            <select defaultValue={task.priority} name="priority" className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm">
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </label>
          <label className="block sm:col-span-2">
            <span className="text-sm font-medium">Description</span>
            <textarea defaultValue={task.description ?? ""} name="description" className="mt-1 min-h-24 w-full rounded-md border px-3 py-2 text-sm" />
          </label>

          <label className="flex items-center gap-2 pt-2">
            <input defaultChecked={task.is_active} name="is_active" type="checkbox" className="h-4 w-4 rounded border" />
            <span className="text-sm font-medium">Active</span>
          </label>

          <div className="sm:col-span-2 pt-2">
            <button type="submit" className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white">
              Save
            </button>
          </div>
        </form>
      </section>

      <section className="mt-8 overflow-hidden rounded-lg border bg-white">
        <div className="border-b px-6 py-4">
          <h2 className="text-base font-semibold">Comments</h2>
        </div>

        <div className="px-6 py-4">
          <form action={addComment.bind(null, task.id)} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="block flex-1">
              <span className="text-sm font-medium">New comment</span>
              <input name="body" className="mt-1 w-full rounded-md border px-3 py-2 text-sm" />
            </label>
            <button type="submit" className="h-10 rounded-md bg-zinc-900 px-4 text-sm font-medium text-white">
              Add
            </button>
          </form>
        </div>

        <div className="divide-y">
          {comments.map((c) => {
            const authorLabel = userId && c.user_id === userId ? "You" : "Clinician";
            return (
              <div key={c.id} className="px-6 py-4 text-sm">
                <div className="text-zinc-700">{c.body}</div>
                <div className="mt-1 text-xs text-zinc-500">{authorLabel}</div>
              </div>
            );
          })}
          {comments.length === 0 ? <div className="px-6 py-10 text-sm text-zinc-600">No comments yet.</div> : null}
        </div>
      </section>
    </main>
  );
}
