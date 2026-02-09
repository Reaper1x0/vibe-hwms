import { jsonError } from "@/lib/api/http";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = createSupabaseServerClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      return jsonError(500, "AUTH_ERROR", userError.message);
    }

    if (!user) {
      return jsonError(401, "UNAUTHORIZED", "Authentication required");
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id,email,full_name,role,hospital_id,department_id,is_active,created_at,updated_at")
      .eq("id", user.id)
      .single();

    if (profileError) {
      return jsonError(500, "DB_ERROR", profileError.message);
    }

    return Response.json({
      data: {
        user: {
          id: user.id,
          email: user.email,
        },
        profile,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return jsonError(500, "INTERNAL_ERROR", message);
  }
}
