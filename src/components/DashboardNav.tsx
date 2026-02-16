"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const roleLabels: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  hod: "HOD",
  doctor: "Doctor",
  nurse: "Nurse",
};

export function DashboardNav({ role }: { role: string | null }) {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname?.startsWith(href) ?? false;
  }

  function navLink(href: string, label: string) {
    const active = isActive(href);
    return (
      <Link
        href={href}
        className={`ui-link transition-colors ${
          active
            ? "text-zinc-900 font-semibold underline underline-offset-2"
            : "text-zinc-600 hover:text-zinc-900 underline underline-offset-2"
        }`}
      >
        {label}
      </Link>
    );
  }

  const roleLabel = role ? roleLabels[role] ?? role : null;

  const canAccessDepartments = role === "super_admin" || role === "admin" || role === "hod";
  const canAccessHospitals = role === "super_admin";

  return (
    <nav className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
      <span className="sr-only">Clinical</span>
      {navLink("/dashboard/schedule", "Schedule")}
      {navLink("/dashboard/tasks", "Tasks")}
      {navLink("/dashboard/patients", "Patients")}
      {navLink("/dashboard/handovers", "Handovers")}
      <span className="text-zinc-300" aria-hidden>
        |
      </span>
      <span className="sr-only">Requests &amp; admin</span>
      {navLink("/dashboard/leaves", "Leaves")}
      {navLink("/dashboard/swaps", "Swaps")}
      {canAccessDepartments ? navLink("/dashboard/departments", "Departments") : null}
      {canAccessHospitals ? navLink("/dashboard/hospitals", "Hospitals") : null}
      {navLink("/dashboard/analytics", "Analytics")}
      <span className="text-zinc-300" aria-hidden>
        |
      </span>
      {navLink("/dashboard/profile", "Profile")}
      {roleLabel ? (
        <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-700">
          {roleLabel}
        </span>
      ) : null}
    </nav>
  );
}
