import Link from "next/link";
import { redirect } from "next/navigation";

import { AutoSubmitForm } from "@/components/AutoSubmitForm";
import { ConfirmActionButton } from "@/components/ConfirmActionForm";
import { CreateFormToggle } from "@/components/CreateFormToggle";
import { FormSubmitButton } from "@/components/FormSubmitButton";
import { apiFetch } from "@/lib/api/origin";
import { isSupabaseConfigured } from "@/lib/env";
import { DEFAULT_PAGE_SIZE, parseLimit, ROWS_PER_PAGE_OPTIONS } from "@/lib/table-pagination";

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
  searchParams?: { view?: string; status?: string; error?: string; page?: string; limit?: string };
}) {
  if (!isSupabaseConfigured()) {
    return (
      <main className="mx-auto w-full max-w-5xl px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Leaves</h1>
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
          user?: { id?: string };
          profile?: { role?: string; hospital_id?: string | null } | null;
        };
      }
    | null;

  const role = meJson?.data?.profile?.role;
  const userId = meJson?.data?.user?.id;
  const hospitalId = meJson?.data?.profile?.hospital_id ?? null;

  const canReview = role === "super_admin" || role === "admin" || role === "hod";

  const view = searchParams?.view ?? "all";
  const statusFilter = searchParams?.status ?? "all";
  const limit = parseLimit(searchParams?.limit);
  const page = Math.max(1, parseInt(String(searchParams?.page ?? "1"), 10) || 1);
  const offset = (page - 1) * limit;

  const leavesParams = new URLSearchParams();
  leavesParams.set("limit", String(limit));
  leavesParams.set("offset", String(offset));
  if (view === "mine" && userId) {
    leavesParams.set("user_id", userId);
  }
  if (statusFilter !== "all") {
    leavesParams.set("status", statusFilter);
  }

  const leavesRes = await apiFetch(`/api/leaves?${leavesParams.toString()}`, { cache: "no-store" });
  const leavesJson = (await leavesRes.json().catch(() => ({ data: [], pagination: { total: 0, limit: DEFAULT_PAGE_SIZE, offset: 0, hasMore: false } }))) as {
    data: LeaveRow[];
    pagination: { total: number; limit: number; offset: number; hasMore: boolean };
  };
  const leaves = leavesJson.data ?? [];
  const pagination = leavesJson.pagination ?? { total: 0, limit: DEFAULT_PAGE_SIZE, offset: 0, hasMore: false };
  const totalPages = Math.max(1, Math.ceil(pagination.total / limit));

  const errorMessage = searchParams?.error ? decodeURIComponent(searchParams.error) : null;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-10 min-h-0">
      {errorMessage ? (
        <div className="shrink-0 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900" role="alert">
          {errorMessage}
        </div>
      ) : null}
      <div className="shrink-0">
        <h1 className="text-2xl font-semibold tracking-tight">Leaves</h1>
        <p className="mt-2 text-sm text-zinc-600">Request leave and manage approvals.</p>
      </div>

      {hospitalId ? (
        <CreateFormToggle title="Request leave" buttonLabel="Request leave">
          <form action={createLeave} className="grid grid-cols-1 gap-4 sm:grid-cols-4">
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
              <FormSubmitButton label="Submit" loadingLabel="Submitting…" />
            </div>
          </form>
        </CreateFormToggle>
      ) : (
        <section className="shrink-0 rounded-lg border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
          Your account is not scoped to a hospital. Ask a Super Admin to assign your hospital.
        </section>
      )}

      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border bg-white">
        <div className="shrink-0 border-b px-6 py-4">
          <h2 className="text-base font-semibold">Leave requests</h2>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <Link
              href={`/dashboard/leaves?view=mine&status=${statusFilter}&limit=${limit}`}
              className={`rounded-md px-3 py-1.5 font-medium ${view === "mine" ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"}`}
            >
              My requests
            </Link>
            <Link
              href={`/dashboard/leaves?view=all&status=${statusFilter}&limit=${limit}`}
              className={`rounded-md px-3 py-1.5 font-medium ${view === "all" ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"}`}
            >
              All requests
            </Link>
            <Link
              href={`/dashboard/leaves?view=${view}&status=pending&limit=${limit}`}
              className="rounded-md px-3 py-1.5 text-zinc-600 hover:bg-zinc-100"
            >
              Pending only
            </Link>
            <AutoSubmitForm className="flex items-center gap-1">
              <input type="hidden" name="view" value={view} />
              <input type="hidden" name="status" value={statusFilter} />
              <input type="hidden" name="page" value="1" />
              <span className="text-zinc-600 text-xs">Rows</span>
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
            </AutoSubmitForm>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
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
                    {pagination.total === 0
                      ? view === "mine"
                        ? "You have no leave requests."
                        : "No leave requests yet. Request leave using the form above."
                      : "No leave requests on this page."}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        {totalPages > 1 ? (
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t px-6 py-3 text-sm text-zinc-600">
            <span>
              Page {page} of {totalPages} ({pagination.total} requests)
            </span>
            <div className="flex gap-2">
              {page > 1 ? (
                <Link
                  href={`/dashboard/leaves?view=${view}&status=${statusFilter}&limit=${limit}&page=${page - 1}`}
                  className="ui-btn-secondary rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium"
                >
                  Previous
                </Link>
              ) : null}
              {page < totalPages ? (
                <Link
                  href={`/dashboard/leaves?view=${view}&status=${statusFilter}&limit=${limit}&page=${page + 1}`}
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
