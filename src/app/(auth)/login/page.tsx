import { redirect } from "next/navigation";

import { LoginFormContent } from "@/components/LoginForm";
import { isSupabaseConfigured } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type LoginPageProps = {
  searchParams?: {
    error?: string;
    next?: string;
  };
};

async function signIn(formData: FormData) {
  "use server";

  if (!isSupabaseConfigured()) {
    redirect("/setup");
  }

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    redirect("/login?error=Missing%20email%20or%20password");
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  const nextPathRaw = String(formData.get("next") ?? "");
  const nextPath = nextPathRaw.startsWith("/") && !nextPathRaw.startsWith("//") ? nextPathRaw : "/dashboard";
  redirect(nextPath);
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  if (!isSupabaseConfigured()) {
    redirect("/setup");
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  const errorMessage = searchParams?.error ? decodeURIComponent(searchParams.error) : null;
  const nextPath = searchParams?.next ? decodeURIComponent(searchParams.next) : "/dashboard";

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-12">
      <form action={signIn}>
        <LoginFormContent errorMessage={errorMessage} nextPath={nextPath} />
      </form>
    </main>
  );
}
