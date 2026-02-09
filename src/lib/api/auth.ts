import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function requireUser() {
  try {
    const supabase = createSupabaseServerClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      return { user: null, error } as const;
    }

    if (!user) {
      return { user: null, error: null } as const;
    }

    return { user, error: null } as const;
  } catch (e) {
    const error = e instanceof Error ? e : new Error("Unknown error");
    return { user: null, error } as const;
  }
}
