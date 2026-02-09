import Link from "next/link";

import { apiFetch } from "@/lib/api/origin";
import { isSupabaseConfigured } from "@/lib/env";

type SummaryResponse = {
  data: {
    scope: {
      hospital_id: string | null;
      role: string;
    };
    counts: {
      patients: number;
      shifts: number;
      leave_requests: number;
      tasks: number;
      swap_requests: number;
      handovers: number;
    };
    tasks: {
      by_status: Record<string, number>;
      by_priority: Record<string, number>;
    };
  };
};

export default async function AnalyticsPage() {
  if (!isSupabaseConfigured()) {
    return (
      <main className="mx-auto w-full max-w-5xl px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
        <p className="mt-2 text-sm text-zinc-600">Supabase is not configured.</p>
        <Link className="mt-6 inline-flex rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white" href="/setup">
          Go to setup
        </Link>
      </main>
    );
  }

  const res = await apiFetch("/api/analytics/summary", { cache: "no-store" });
  if (res.status === 403) {
    return (
      <main className="mx-auto w-full max-w-5xl px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
        <p className="mt-2 text-sm text-zinc-600">You don’t have permission to view analytics.</p>
      </main>
    );
  }

  const json = (await res.json().catch(() => null)) as SummaryResponse | null;

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
        <p className="mt-2 text-sm text-zinc-600">Operational metrics for your scope. The dashboard home shows a live snapshot; this page shows the same counts in a dedicated view.</p>
      </div>

      <section className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border bg-white p-5">
          <div className="text-sm text-zinc-600">Patients</div>
          <div className="mt-2 text-2xl font-semibold">{json?.data?.counts?.patients ?? "—"}</div>
        </div>
        <div className="rounded-lg border bg-white p-5">
          <div className="text-sm text-zinc-600">Tasks</div>
          <div className="mt-2 text-2xl font-semibold">{json?.data?.counts?.tasks ?? "—"}</div>
        </div>
        <div className="rounded-lg border bg-white p-5">
          <div className="text-sm text-zinc-600">Handovers</div>
          <div className="mt-2 text-2xl font-semibold">{json?.data?.counts?.handovers ?? "—"}</div>
        </div>
        <div className="rounded-lg border bg-white p-5">
          <div className="text-sm text-zinc-600">Shifts</div>
          <div className="mt-2 text-2xl font-semibold">{json?.data?.counts?.shifts ?? "—"}</div>
        </div>
        <div className="rounded-lg border bg-white p-5">
          <div className="text-sm text-zinc-600">Leave requests</div>
          <div className="mt-2 text-2xl font-semibold">{json?.data?.counts?.leave_requests ?? "—"}</div>
        </div>
        <div className="rounded-lg border bg-white p-5">
          <div className="text-sm text-zinc-600">Swap requests</div>
          <div className="mt-2 text-2xl font-semibold">{json?.data?.counts?.swap_requests ?? "—"}</div>
        </div>
      </section>

      <section className="mt-8 rounded-lg border bg-white p-6">
        <h2 className="text-base font-semibold">Raw</h2>
        <pre className="mt-4 overflow-x-auto text-xs text-zinc-900">{JSON.stringify(json, null, 2)}</pre>
      </section>
    </main>
  );
}
