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

const ENTITY_LINKS = [
  { key: "patients", label: "Patients", href: "/dashboard/patients", color: "bg-emerald-500" },
  { key: "tasks", label: "Tasks", href: "/dashboard/tasks", color: "bg-sky-500" },
  { key: "handovers", label: "Handovers", href: "/dashboard/handovers", color: "bg-violet-500" },
  { key: "shifts", label: "Shifts", href: "/dashboard/schedule", color: "bg-amber-500" },
  { key: "leave_requests", label: "Leave requests", href: "/dashboard/leaves", color: "bg-rose-500" },
  { key: "swap_requests", label: "Swap requests", href: "/dashboard/swaps", color: "bg-teal-500" },
] as const;

const STATUS_LABELS: Record<string, string> = {
  todo: "To do",
  in_progress: "In progress",
  done: "Done",
  cancelled: "Cancelled",
};

const STATUS_COLORS: Record<string, string> = {
  todo: "bg-zinc-400",
  in_progress: "bg-sky-500",
  done: "bg-emerald-500",
  cancelled: "bg-zinc-300",
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-zinc-400",
  medium: "bg-sky-500",
  high: "bg-amber-500",
  critical: "bg-red-500",
};

function BarSegment({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className="w-28 shrink-0 text-sm text-zinc-600">{label}</div>
      <div className="min-w-0 flex-1">
        <div className="h-6 overflow-hidden rounded-md bg-zinc-100">
          <div
            className={`h-full rounded-md ${color} transition-all duration-500`}
            style={{ width: `${Math.max(pct, value > 0 ? 2 : 0)}%` }}
            title={`${value} (${pct}%)`}
          />
        </div>
      </div>
      <div className="w-12 shrink-0 text-right text-sm font-medium text-zinc-800">{value}</div>
    </div>
  );
}

export default async function AnalyticsPage() {
  if (!isSupabaseConfigured()) {
    return (
      <main className="mx-auto w-full max-w-5xl px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
        <p className="mt-2 text-sm text-zinc-600">Supabase is not configured.</p>
        <Link className="ui-btn-primary mt-6 inline-flex rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white" href="/setup">
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
        <p className="mt-2 text-sm text-zinc-600">You don&apos;t have permission to view analytics.</p>
      </main>
    );
  }

  const json = (await res.json().catch(() => null)) as SummaryResponse | null;
  const counts = json?.data?.counts ?? {};
  const tasksByStatus = json?.data?.tasks?.by_status ?? {};
  const tasksByPriority = json?.data?.tasks?.by_priority ?? {};

  const totalEntities = ENTITY_LINKS.reduce((sum, { key }) => sum + (counts[key as keyof typeof counts] ?? 0), 0);
  const totalTasksStatus = Object.values(tasksByStatus).reduce((a, b) => a + b, 0);
  const totalTasksPriority = Object.values(tasksByPriority).reduce((a, b) => a + b, 0);

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Operational metrics and infographics for your scope.
        </p>
      </div>

      {/* Summary cards with links */}
      <section className="mt-8">
        <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">Overview</h2>
        <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {ENTITY_LINKS.map(({ key, label, href, color }) => {
            const value = counts[key as keyof typeof counts] ?? 0;
            return (
              <Link
                key={key}
                href={href}
                className="group flex flex-col rounded-xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:border-zinc-300 hover:shadow"
              >
                <div className={`mb-2 h-1 w-8 rounded-full ${color}`} aria-hidden />
                <div className="text-xs font-medium text-zinc-500">{label}</div>
                <div className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900 group-hover:text-zinc-700">
                  {value}
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Donut: entity distribution */}
      {totalEntities > 0 && (
        <section className="mt-10">
          <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">Entity distribution</h2>
          <div className="mt-3 flex flex-col gap-6 rounded-xl border border-zinc-200 bg-white p-6 sm:flex-row sm:items-center sm:gap-10">
            <div className="relative h-44 w-44 shrink-0 sm:h-52 sm:w-52" aria-hidden>
              <div
                className="h-full w-full rounded-full"
                style={{
                  background: (() => {
                    const colorMap: Record<string, string> = {
                      "bg-emerald-500": "#22c55e",
                      "bg-sky-500": "#0ea5e9",
                      "bg-violet-500": "#8b5cf6",
                      "bg-amber-500": "#f59e0b",
                      "bg-rose-500": "#f43f5e",
                      "bg-teal-500": "#14b8a6",
                    };
                    let cum = 0;
                    const parts: string[] = [];
                    ENTITY_LINKS.forEach(({ key, color }) => {
                      const value = counts[key as keyof typeof counts] ?? 0;
                      const hex = colorMap[color] ?? "#71717a";
                      const startPct = totalEntities > 0 ? (cum / totalEntities) * 100 : 0;
                      cum += value;
                      const endPct = totalEntities > 0 ? (cum / totalEntities) * 100 : 0;
                      if (value > 0) parts.push(`${hex} ${startPct}% ${endPct}%`);
                    });
                    return parts.length > 0 ? `conic-gradient(${parts.join(", ")})` : "transparent";
                  })(),
                }}
              />
              <div className="absolute inset-[50%] flex h-2/3 w-2/3 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-zinc-50">
                <span className="text-2xl font-bold tabular-nums text-zinc-800">{totalEntities}</span>
              </div>
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              {ENTITY_LINKS.map(({ key, label, color }) => {
                const value = counts[key as keyof typeof counts] ?? 0;
                const pct = totalEntities > 0 ? Math.round((value / totalEntities) * 100) : 0;
                return (
                  <div key={key} className="flex items-center gap-2 text-sm">
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${color}`} />
                    <span className="text-zinc-600">{label}</span>
                    <span className="ml-auto font-medium tabular-nums text-zinc-900">
                      {value}
                      <span className="ml-1 font-normal text-zinc-500">({pct}%)</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Tasks by status */}
      <section className="mt-10">
        <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">Tasks by status</h2>
        <div className="mt-3 rounded-xl border border-zinc-200 bg-white p-6">
          <div className="space-y-0">
            {(["todo", "in_progress", "done", "cancelled"] as const).map((status) => (
              <BarSegment
                key={status}
                label={STATUS_LABELS[status] ?? status}
                value={tasksByStatus[status] ?? 0}
                total={totalTasksStatus}
                color={STATUS_COLORS[status] ?? "bg-zinc-400"}
              />
            ))}
          </div>
          <div className="mt-3 border-t border-zinc-100 pt-3 text-xs text-zinc-500">
            Total tasks: <span className="font-medium text-zinc-700">{totalTasksStatus}</span>
          </div>
        </div>
      </section>

      {/* Tasks by priority */}
      <section className="mt-10">
        <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">Tasks by priority</h2>
        <div className="mt-3 rounded-xl border border-zinc-200 bg-white p-6">
          <div className="space-y-0">
            {(["low", "medium", "high", "critical"] as const).map((priority) => (
              <BarSegment
                key={priority}
                label={priority.charAt(0).toUpperCase() + priority.slice(1)}
                value={tasksByPriority[priority] ?? 0}
                total={totalTasksPriority}
                color={PRIORITY_COLORS[priority] ?? "bg-zinc-400"}
              />
            ))}
          </div>
          <div className="mt-3 border-t border-zinc-100 pt-3 text-xs text-zinc-500">
            Total tasks: <span className="font-medium text-zinc-700">{totalTasksPriority}</span>
          </div>
        </div>
      </section>
    </main>
  );
}
