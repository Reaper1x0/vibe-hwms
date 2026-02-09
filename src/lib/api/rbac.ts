import { createSupabaseServerClient } from "@/lib/supabase/server";

export type UserRole = "super_admin" | "admin" | "hod" | "doctor" | "nurse";

export type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: UserRole;
  hospital_id: string | null;
  department_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export function roleIn(role: UserRole, allowed: readonly UserRole[]) {
  return allowed.includes(role);
}

export async function requireProfile() {
  try {
    const supabase = createSupabaseServerClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      return { user: null, profile: null, error: userError } as const;
    }

    if (!user) {
      return { user: null, profile: null, error: null } as const;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id,email,full_name,role,hospital_id,department_id,is_active,created_at,updated_at")
      .eq("id", user.id)
      .single();

    if (profileError) {
      return { user, profile: null, error: profileError } as const;
    }

    if (!profile) {
      return { user, profile: null, error: null } as const;
    }

    return { user, profile: profile as Profile, error: null } as const;
  } catch (e) {
    const error = e instanceof Error ? e : new Error("Unknown error");
    return { user: null, profile: null, error } as const;
  }
}

export async function requireRole(allowed: readonly UserRole[]) {
  const { user, profile, error } = await requireProfile();

  if (error) {
    return { user: null, profile: null, error, allowed: false } as const;
  }

  if (!user || !profile) {
    return { user: null, profile: null, error: null, allowed: false } as const;
  }

  if (!profile.is_active) {
    return { user, profile, error: null, allowed: false } as const;
  }

  return { user, profile, error: null, allowed: roleIn(profile.role, allowed) } as const;
}
