import Link from "next/link";
import { redirect } from "next/navigation";

import { ConfirmActionButton } from "@/components/ConfirmActionForm";
import { FormSubmitButton } from "@/components/FormSubmitButton";
import { apiFetch } from "@/lib/api/origin";
import { isSupabaseConfigured } from "@/lib/env";

type SwapRow = {
  id: string;
  shift_id: string;
  requester_id: string;
  requested_with_user_id: string | null;
  status: "pending" | "approved" | "rejected" | "cancelled";
  reason: string | null;
  shifts: {
    hospital_id: string;
    start_at: string;
    end_at: string;
    assigned_user_id: string | null;
  };
};

type ShiftRow = {
  id: string;
  start_at: string;
  end_at: string;
  assigned_user_id: string | null;
};

async function createSwap(formData: FormData) {
  "use server";

  const shiftId = String(formData.get("shift_id") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();

  if (!shiftId) {
    redirect("/dashboard/swaps?error=Please%20select%20a%20shift");
    return;
  }

  try {
    const res = await apiFetch("/api/swaps", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        shift_id: shiftId,
        reason: reason || null,
      }),
      cache: "no-store",
    });

    if (res.ok) {
      redirect("/dashboard/swaps?success=1");
    } else {
      const error = await res.json().catch(() => ({ error: "Failed to create swap request" }));
      redirect(`/dashboard/swaps?error=${encodeURIComponent(error.error || "Failed to create swap request")}`);
    }
  } catch (e) {
    redirect(`/dashboard/swaps?error=${encodeURIComponent(e instanceof Error ? e.message : "Unknown error")}`);
  }
}

async function setSwapStatus(id: string, status: string) {
  "use server";

  const res = await apiFetch(`/api/swaps/${id}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ status }),
    cache: "no-store",
  });

  if (res.ok) {
    redirect("/dashboard/swaps");
  }
}

export default async function SwapsPage({
  searchParams,
}: {
  searchParams?: { page?: string; success?: string; error?: string };
}) {
  if (!isSupabaseConfigured()) {
    return (
      <main className="mx-auto w-full max-w-5xl px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Swap Requests</h1>
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

  const canReview = role === "super_admin" || role === "admin" || role === "hod";

  const page = Math.max(1, parseInt(String(searchParams?.page ?? "1"), 10) || 1);
  const SWAPS_PAGE_SIZE = 25;
  const offset = (page - 1) * SWAPS_PAGE_SIZE;

  const swapsParams = new URLSearchParams();
  swapsParams.set("limit", String(SWAPS_PAGE_SIZE));
  swapsParams.set("offset", String(offset));

  const swapsRes = await apiFetch(`/api/swaps?${swapsParams.toString()}`, { cache: "no-store" });
  const swapsJson = (await swapsRes.json().catch(() => ({ data: [], pagination: { total: 0, limit: SWAPS_PAGE_SIZE, offset: 0, hasMore: false } }))) as {
    data: SwapRow[];
    pagination: { total: number; limit: number; offset: number; hasMore: boolean };
  };
  const swaps = swapsJson.data ?? [];
  const pagination = swapsJson.pagination ?? { total: 0, limit: SWAPS_PAGE_SIZE, offset: 0, hasMore: false };
  const totalPages = Math.max(1, Math.ceil(pagination.total / SWAPS_PAGE_SIZE));

  const shiftsRes = await apiFetch("/api/shifts?limit=1000", { cache: "no-store" });
  const shiftsJson = (await shiftsRes.json().catch(() => ({ data: [] }))) as { data: ShiftRow[] };
  const allShifts = shiftsJson.data ?? [];

  const myShifts =
    userId != null ? allShifts.filter((s) => s.assigned_user_id === userId) : allShifts;

  function statusClasses(status: SwapRow["status"]) {
    if (status === "approved") return "inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800";
    if (status === "rejected") return "inline-flex rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700";
    if (status === "cancelled") return "inline-flex rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700";
    return "inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800";
  }

  const errorMessage = searchParams?.error ? decodeURIComponent(searchParams.error) : null;
  const showSuccess = searchParams?.success === "1";

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      {errorMessage ? (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900" role="alert">
          {errorMessage}
        </div>
      ) : null}
      {showSuccess ? (
        <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900" role="status">
          Swap request created.
        </div>
      ) : null}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Swap Requests</h1>
        <p className="mt-2 text-sm text-zinc-600">Request shift swaps and manage approvals.</p>
      </div>

      <section className="mt-8 rounded-lg border bg-white p-6">
        <h2 className="text-base font-semibold">Create swap request</h2>
        <form action={createSwap} className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-4">
          <label className="block">
            <span className="text-sm font-medium">Shift</span>
            <select
              name="shift_id"
              required
              defaultValue=""
              className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm"
            >
              <option value="" disabled>
                {myShifts.length ? "Select one of your shifts" : "No shifts available"}
              </option>
              {myShifts.map((s) => (
                <option key={s.id} value={s.id}>
                  {new Date(s.start_at).toLocaleString()} – {new Date(s.end_at).toLocaleString()}
                </option>
              ))}
            </select>
          </label>
          <label className="block sm:col-span-2">
            <span className="text-sm font-medium">Reason</span>
            <input name="reason" className="mt-1 w-full rounded-md border px-3 py-2 text-sm" />
          </label>
          <div className="sm:col-span-4">
            <FormSubmitButton label="Submit" loadingLabel="Submitting…" />
          </div>
        </form>
      </section>

      <section className="mt-8 overflow-hidden rounded-lg border bg-white">
        <div className="border-b px-6 py-4">
          <h2 className="text-base font-semibold">Swap requests</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-zinc-600">
              <tr>
                <th className="px-6 py-3 font-medium">Shift</th>
                <th className="px-6 py-3 font-medium">Requester</th>
                <th className="px-6 py-3 font-medium">With</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {swaps.map((s) => {
                const isRequester = Boolean(userId && s.requester_id === userId);
                const canCancelOwn = isRequester && s.status === "pending";
                const canApprove = canReview && s.status === "pending";

                const requesterLabel = isRequester ? "You" : "Colleague";
                const withLabel =
                  s.requested_with_user_id == null
                    ? "Any staff (pool)"
                    : userId && s.requested_with_user_id === userId
                    ? "You"
                    : "Colleague";

                return (
                  <tr key={s.id} className="border-t">
                    <td className="px-6 py-3 text-zinc-700">
                      <div className="text-sm text-zinc-700">
                        {new Date(s.shifts.start_at).toLocaleString()} –{" "}
                        {new Date(s.shifts.end_at).toLocaleString()}
                      </div>
                    </td>
                    <td className="px-6 py-3 text-zinc-700">{requesterLabel}</td>
                    <td className="px-6 py-3 text-zinc-700">{withLabel}</td>
                    <td className="px-6 py-3 text-zinc-700">
                      <span className={statusClasses(s.status)}>{s.status}</span>
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex flex-wrap gap-2">
                        {canApprove ? (
                          <>
                            <form action={setSwapStatus.bind(null, s.id, "approved")}>
                              <button type="submit" className="rounded-md border bg-white px-3 py-1 text-xs font-medium">
                                Approve
                              </button>
                            </form>
                            <ConfirmActionButton
                              action={setSwapStatus.bind(null, s.id, "rejected")}
                              label="Reject"
                              confirmMessage="Reject this swap request?"
                            />
                          </>
                        ) : null}

                        {canCancelOwn ? (
                          <ConfirmActionButton
                            action={setSwapStatus.bind(null, s.id, "cancelled")}
                            label="Cancel"
                            confirmMessage="Cancel this swap request?"
                          />
                        ) : null}

                        {!canApprove && !canCancelOwn ? <span className="text-xs text-zinc-500">—</span> : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {swaps.length === 0 ? (
                <tr>
                  <td className="px-6 py-10 text-zinc-600" colSpan={5}>
                    {pagination.total === 0 ? "No swap requests yet." : "No swap requests on this page."}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        {totalPages > 1 ? (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t px-6 py-3 text-sm text-zinc-600">
            <span>
              Page {page} of {totalPages} ({pagination.total} requests)
            </span>
            <div className="flex gap-2">
              {page > 1 ? (
                <Link
                  href={`/dashboard/swaps?page=${page - 1}`}
                  className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-zinc-50"
                >
                  Previous
                </Link>
              ) : null}
              {page < totalPages ? (
                <Link
                  href={`/dashboard/swaps?page=${page + 1}`}
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
