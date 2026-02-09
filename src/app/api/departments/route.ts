import { z } from "zod";

import { requireRole } from "@/lib/api/rbac";
import { jsonError, zodErrorToMessage } from "@/lib/api/http";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const createDepartmentSchema = z.object({
  hospital_id: z.string().uuid(),
  name: z.string().min(1),
  type: z.string().optional(),
  hod_user_id: z.string().uuid().optional().nullable(),
});

export async function GET(request: Request) {
  try {
    const { allowed, profile, error: authError } = await requireRole(["super_admin", "admin", "hod"] as const);
    if (authError) {
      return jsonError(500, "AUTH_ERROR", authError.message);
    }
    if (!allowed || !profile) {
      return jsonError(403, "FORBIDDEN", "Insufficient permissions");
    }

    const { searchParams } = new URL(request.url);
    const hospitalId = searchParams.get("hospital_id");

    const supabase = createSupabaseAdminClient();

    let query = supabase
      .from("departments")
      .select("id,hospital_id,name,type,hod_user_id,is_active,created_at,updated_at")
      .order("created_at", { ascending: false });

    if (profile.role === "super_admin") {
      if (hospitalId) {
        query = query.eq("hospital_id", hospitalId);
      }
    } else {
      if (!profile.hospital_id) {
        return jsonError(403, "FORBIDDEN", "Hospital scope required");
      }
      if (hospitalId && hospitalId !== profile.hospital_id) {
        return jsonError(403, "FORBIDDEN", "Hospital access denied");
      }
      query = query.eq("hospital_id", profile.hospital_id);
    }

    const { data, error: dbError } = await query;
    if (dbError) {
      return jsonError(500, "DB_ERROR", dbError.message);
    }

    return Response.json({ data });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return jsonError(500, "INTERNAL_ERROR", message);
  }
}

export async function POST(request: Request) {
  try {
    const { allowed, profile, error: authError } = await requireRole(["super_admin", "admin", "hod"] as const);
    if (authError) {
      return jsonError(500, "AUTH_ERROR", authError.message);
    }
    if (!allowed || !profile) {
      return jsonError(403, "FORBIDDEN", "Insufficient permissions");
    }

    const supabase = createSupabaseAdminClient();

    const body = await request.json().catch(() => null);
    const parsed = createDepartmentSchema.safeParse(body);

    if (!parsed.success) {
      return jsonError(400, "VALIDATION_ERROR", zodErrorToMessage(parsed.error));
    }

    if (profile.role !== "super_admin" && profile.hospital_id !== parsed.data.hospital_id) {
      return jsonError(403, "FORBIDDEN", "Hospital access denied");
    }

    const { data, error: dbError } = await supabase
      .from("departments")
      .insert({
        hospital_id: parsed.data.hospital_id,
        name: parsed.data.name,
        type: parsed.data.type ?? null,
        hod_user_id: parsed.data.hod_user_id ?? null,
      })
      .select("id,hospital_id,name,type,hod_user_id,is_active,created_at,updated_at")
      .single();

    if (dbError) {
      return jsonError(500, "DB_ERROR", dbError.message);
    }

    return Response.json({ data }, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return jsonError(500, "INTERNAL_ERROR", message);
  }
}
