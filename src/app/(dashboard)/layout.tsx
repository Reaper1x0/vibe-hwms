import { redirect } from "next/navigation";
import Link from "next/link";

import { isSupabaseConfigured } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  if (!isSupabaseConfigured()) {
    redirect("/setup");
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-dvh bg-zinc-50 text-zinc-950">
      <header className="border-b bg-white">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/dashboard" className="text-sm font-semibold tracking-tight">
            HWMS
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link className="text-zinc-700 underline" href="/dashboard/hospitals">
              Hospitals
            </Link>
            <Link className="text-zinc-700 underline" href="/dashboard/departments">
              Departments
            </Link>
          </nav>
        </div>
      </header>
      {children}
    </div>
  );
}
