import Link from "next/link";
import { redirect } from "next/navigation";

import { ConfirmActionButton } from "@/components/ConfirmActionForm";
import { apiFetch } from "@/lib/api/origin";
import { isSupabaseConfigured } from "@/lib/env";

type LeaveRow = {
  id: string;
  user_id: string;
  hospital_id: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  status: "pending" | "approved" | "rejected" | "cancelled";
  reviewed_by: string | null;
  reviewed_at: string | null;
};

async function createLeave(formData: FormData) {
  "use server";

  const startDate = String(formData.get("start_date") ?? "");
  const endDate = String(formData.get("end_date") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();

  if (!startDate || !endDate) {
    redirect("/dashboard/leaves?error=Please%20provide%20start%20and%20end%20dates");
  }
  if (endDate < startDate) {
    redirect("/dashboard/leaves?error=End%20date%20must%20be%20on%20or%20after%20start%20date");
  }

  const res = await apiFetch("/api/leaves", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      start_date: startDate,
      end_date: endDate,
      reason: reason || null,
    }),
    cache: "no-store",
  });

  if (res.ok) {
    redirect("/dashboard/leaves");
  }
}

async function setLeaveStatus(id: string, status: string) {
  "use server";

  const res = await apiFetch(`/api/leaves/${id}`, {
    method: "PUT",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ status }),
    cache: "no-store",
  });

  if (res.ok) {
    redirect("/dashboard/leaves");
  }
}

export default async function LeavesPage({
  searchParams,
}: {
  searchParams?: { view?: string; status?: string; error?: string };
}) {
  if (!isSupabaseConfigured()) {
    return (
      <main className="mx-auto w-full max-w-5xl px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Leaves</h1>
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
  const userId = meJson?.data?.user?.id;
  const hospitalId = meJson?.data?.profile?.hospital_id ?? null;

  const canReview = role === "super_admin" || role === "admin" || role === "hod";

  const leavesRes = await apiFetch("/api/leaves", { cache: "no-store" });
  const leavesJson = (await leavesRes.json().catch(() => ({ data: [] }))) as { data: LeaveRow[] };
  const allLeaves = leavesJson.data ?? [];
  const view = searchParams?.view ?? "all";
  const statusFilter = searchParams?.status ?? "all";
  const leaves = allLeaves.filter((l) => {
    if (view === "mine" && userId && l.user_id !== userId) return false;
    if (statusFilter !== "all" && l.status !== statusFilter) return false;
    return true;
  });

  const errorMessage = searchParams?.error ? decodeURIComponent(searchParams.error) : null;

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      {errorMessage ? (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900" role="alert">
          {errorMessage}
        </div>
      ) : null}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Leaves</h1>
        <p className="mt-2 text-sm text-zinc-600">Request leave and manage approvals.</p>
      </div>

      {hospitalId ? (
        <section className="mt-8 rounded-lg border bg-white p-6">
          <h2 className="text-base font-semibold">Request leave</h2>
          <form action={createLeave} className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-4">
            <label className="block">
              <span className="text-sm font-medium">Start date</span>
              <input name="start_date" type="date" required className="mt-1 w-full rounded-md border px-3 py-2 text-sm" />
            </label>
            <label className="block">
              <span className="text-sm font-medium">End date</span>
              <input name="end_date" type="date" required className="mt-1 w-full rounded-md border px-3 py-2 text-sm" />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-sm font-medium">Reason</span>
              <input name="reason" className="mt-1 w-full rounded-md border px-3 py-2 text-sm" />
            </label>
            <div className="sm:col-span-4">
              <button type="submit" className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white">
                Submit
              </button>
            </div>
          </form>
        </section>
      ) : (
        <section className="mt-8 rounded-lg border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
          Your account is not scoped to a hospital. Ask a Super Admin to assign your hospital.
        </section>
      )}

      <section className="mt-8 overflow-hidden rounded-lg border bg-white">
        <div className="border-b px-6 py-4">
          <h2 className="text-base font-semibold">Leave requests</h2>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <Link
              href="/dashboard/leaves?view=mine"
              className={`rounded-md px-3 py-1.5 font-medium ${view === "mine" ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"}`}
            >
              My requests
            </Link>
            <Link
              href="/dashboard/leaves?view=all"
              className={`rounded-md px-3 py-1.5 font-medium ${view === "all" ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"}`}
            >
              All requests
            </Link>
            <Link
              href="/dashboard/leaves?status=pending"
              className="rounded-md px-3 py-1.5 text-zinc-600 hover:bg-zinc-100"
            >
              Pending only
            </Link>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm" aria-label="Leave requests">
            <thead className="bg-zinc-50 text-zinc-600">
              <tr>
                <th scope="col" className="px-6 py-3 font-medium">Start</th>
                <th scope="col" className="px-6 py-3 font-medium">End</th>
                <th scope="col" className="px-6 py-3 font-medium">Reason</th>
                <th scope="col" className="px-6 py-3 font-medium">Status</th>
                <th scope="col" className="px-6 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {leaves.map((l) => {
                const isOwn = Boolean(userId && l.user_id === userId);
                const canCancelOwn = isOwn && l.status === "pending";
                const canApprove = canReview && l.status === "pending";

                return (
                  <tr key={l.id} className="border-t">
                    <td className="px-6 py-3 text-zinc-700">{l.start_date}</td>
                    <td className="px-6 py-3 text-zinc-700">{l.end_date}</td>
                    <td className="px-6 py-3 text-zinc-700">{l.reason ?? "—"}</td>
                    <td className="px-6 py-3 text-zinc-700">{l.status}</td>
                    <td className="px-6 py-3">
                      <div className="flex flex-wrap gap-2">
                        {canApprove ? (
                          <>
                            <form action={setLeaveStatus.bind(null, l.id, "approved")}>
                              <button type="submit" className="rounded-md border bg-white px-3 py-1 text-xs font-medium">
                                Approve
                              </button>
                            </form>
                            <ConfirmActionButton
                              action={setLeaveStatus.bind(null, l.id, "rejected")}
                              label="Reject"
                              confirmMessage="Reject this leave request?"
                            />
                          </>
                        ) : null}

                        {canCancelOwn ? (
                          <ConfirmActionButton
                            action={setLeaveStatus.bind(null, l.id, "cancelled")}
                            label="Cancel"
                            confirmMessage="Cancel this leave request?"
                          />
                        ) : null}

                        {!canApprove && !canCancelOwn ? <span className="text-xs text-zinc-500">—</span> : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {leaves.length === 0 ? (
                <tr>
                  <td className="px-6 py-10 text-center text-zinc-600" colSpan={5}>
                    {view === "mine" ? "You have no leave requests." : "No leave requests yet. Request leave using the form above."}
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
