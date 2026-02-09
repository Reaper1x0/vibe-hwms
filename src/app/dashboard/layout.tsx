import Link from "next/link";
import { redirect } from "next/navigation";

import { DashboardNav } from "@/components/DashboardNav";
import { isSupabaseConfigured } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  async function signOut() {
    "use server";

    const supabase = createSupabaseServerClient();
    await supabase.auth.signOut();
    redirect("/login");
  }

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

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <div className="min-h-dvh bg-zinc-50 text-zinc-950">
      <header className="border-b bg-white">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/dashboard" className="text-sm font-semibold tracking-tight">
            HWMS
          </Link>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <DashboardNav role={profile?.role ?? null} />
            <form action={signOut}>
              <button
                type="submit"
                className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              >
                Log out
              </button>
            </form>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
