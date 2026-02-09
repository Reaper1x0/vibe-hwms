/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import { useEffect, useState } from "react";

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
      by_status: {
        todo: number;
        in_progress: number;
        done: number;
        cancelled: number;
      };
      by_priority: {
        low: number;
        medium: number;
        high: number;
        critical: number;
      };
    };
  };
};

export default function DashboardHomePage() {
  const [summary, setSummary] = useState<SummaryResponse["data"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/analytics/summary", { cache: "no-store" });
        if (!res.ok) {
          throw new Error("Failed to load analytics");
        }
        const json = (await res.json()) as SummaryResponse;
        if (!cancelled) {
          setSummary(json.data);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Unknown error");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const roleLabel =
    summary?.scope.role === "super_admin"
      ? "Super admin"
      : summary?.scope.role === "admin"
      ? "Admin"
      : summary?.scope.role === "hod"
      ? "Head of Department"
      : summary?.scope.role === "doctor"
      ? "Doctor"
      : summary?.scope.role === "nurse"
      ? "Nurse"
      : summary?.scope.role ?? "User";

  const totalCount =
    (summary?.counts.patients ?? 0) +
    (summary?.counts.shifts ?? 0) +
    (summary?.counts.tasks ?? 0) +
    (summary?.counts.leave_requests ?? 0) +
    (summary?.counts.swap_requests ?? 0) +
    (summary?.counts.handovers ?? 0);
  const isEmpty = !loading && !error && summary && totalCount === 0;

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-2 text-sm text-zinc-600">
            Overview of your hospital workforce: patients, schedules, tasks, and handovers.
          </p>
          {summary ? (
            <>
              <p className="mt-1 text-xs text-zinc-500">
                Signed in as <span className="font-medium">{roleLabel}</span>
                {summary.scope.hospital_id ? " (scoped to your hospital)" : " (all hospitals)"}
              </p>
              <p className="mt-0.5 text-xs text-zinc-400">Summary for your hospital.</p>
            </>
          ) : null}
        </div>
      </div>

      {isEmpty ? (
        <section className="mt-8 rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-center">
          <h2 className="text-base font-semibold text-zinc-900">Getting started</h2>
          <p className="mt-2 text-sm text-zinc-600">
            No data yet. Add patients, create shifts, or create a task to get started.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <a
              href="/dashboard/patients"
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
            >
              Add patients
            </a>
            <a
              href="/dashboard/schedule"
              className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Schedule
            </a>
            <a
              href="/dashboard/tasks"
              className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Create task
            </a>
          </div>
        </section>
      ) : null}

      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Active patients" href="/dashboard/patients" value={summary?.counts.patients} loading={loading} />
        <StatCard label="Upcoming shifts" href="/dashboard/schedule" value={summary?.counts.shifts} loading={loading} />
        <StatCard label="Open tasks" href="/dashboard/tasks?status=open" value={summary?.counts.tasks} loading={loading} />
        <StatCard label="Leave requests" href="/dashboard/leaves?status=pending" value={summary?.counts.leave_requests} loading={loading} />
        <StatCard label="Swap requests" href="/dashboard/swaps?status=pending" value={summary?.counts.swap_requests} loading={loading} />
        <StatCard label="Handovers" href="/dashboard/handovers" value={summary?.counts.handovers} loading={loading} />
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border bg-white p-4">
          <h2 className="text-sm font-semibold tracking-tight text-zinc-900">Tasks by status</h2>
          <p className="mt-1 text-xs text-zinc-500">Workload snapshot for you / your hospital. Click to filter.</p>
          {loading ? (
            <div className="mt-4 grid grid-cols-2 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-10 animate-pulse rounded-md bg-zinc-100" />
              ))}
            </div>
          ) : error ? (
            <p className="mt-4 text-sm text-red-600">Failed to load: {error}</p>
          ) : summary ? (
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <StatusItem label="To do" value={summary.tasks.by_status.todo} href="/dashboard/tasks?status=todo" className="bg-amber-50 text-amber-800" />
              <StatusItem
                label="In progress"
                value={summary.tasks.by_status.in_progress}
                href="/dashboard/tasks?status=in_progress"
                className="bg-blue-50 text-blue-800"
              />
              <StatusItem label="Done" value={summary.tasks.by_status.done} href="/dashboard/tasks?status=done" className="bg-emerald-50 text-emerald-800" />
              <StatusItem
                label="Cancelled"
                value={summary.tasks.by_status.cancelled}
                href="/dashboard/tasks?status=cancelled"
                className="bg-zinc-100 text-zinc-700"
              />
            </dl>
          ) : (
            <p className="mt-4 text-sm text-zinc-500">No task data yet.</p>
          )}
        </div>

        <div className="rounded-lg border bg-white p-4">
          <h2 className="text-sm font-semibold tracking-tight text-zinc-900">Tasks by priority</h2>
          <p className="mt-1 text-xs text-zinc-500">Helps you focus on what is most critical. Click to filter.</p>
          {loading ? (
            <div className="mt-4 grid grid-cols-2 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-10 animate-pulse rounded-md bg-zinc-100" />
              ))}
            </div>
          ) : error ? (
            <p className="mt-4 text-sm text-red-600">Failed to load: {error}</p>
          ) : summary ? (
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <StatusItem label="Low" value={summary.tasks.by_priority.low} href="/dashboard/tasks?priority=low" className="bg-zinc-50 text-zinc-700" />
              <StatusItem
                label="Medium"
                value={summary.tasks.by_priority.medium}
                href="/dashboard/tasks?priority=medium"
                className="bg-sky-50 text-sky-800"
              />
              <StatusItem label="High" value={summary.tasks.by_priority.high} href="/dashboard/tasks?priority=high" className="bg-red-50 text-red-700" />
              <StatusItem
                label="Critical"
                value={summary.tasks.by_priority.critical}
                href="/dashboard/tasks?priority=critical"
                className="bg-red-100 text-red-900"
              />
            </dl>
          ) : (
            <p className="mt-4 text-sm text-zinc-500">No task priority data yet.</p>
          )}
        </div>
      </section>
    </main>
  );
}

type StatCardProps = {
  label: string;
  value: number | undefined;
  loading: boolean;
  href?: string;
};

function StatCard({ label, value, loading, href }: StatCardProps) {
  const content = (
    <>
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      {loading ? (
        <p className="mt-3 h-7 w-14 animate-pulse rounded bg-zinc-100" />
      ) : (
        <p className="mt-3 text-2xl font-semibold text-zinc-900">{value ?? 0}</p>
      )}
    </>
  );

  return (
    <div className="rounded-lg border bg-white p-0 shadow-sm">
      {href ? (
        <a href={href} className="block p-4 hover:bg-zinc-50">
          {content}
        </a>
      ) : (
        <div className="p-4">{content}</div>
      )}
    </div>
  );
}

type StatusItemProps = {
  label: string;
  value: number;
  className: string;
  href?: string;
};

function StatusItem({ label, value, className, href }: StatusItemProps) {
  const content = (
    <>
      <dt className="text-xs font-medium uppercase tracking-wide">{label}</dt>
      <dd className="text-sm font-semibold">{value}</dd>
    </>
  );
  if (href) {
    return (
      <a href={href} className={`flex items-center justify-between rounded-md px-3 py-2 ${className} hover:opacity-90`}>
        {content}
      </a>
    );
  }
  return <div className={`flex items-center justify-between rounded-md px-3 py-2 ${className}`}>{content}</div>;
}

