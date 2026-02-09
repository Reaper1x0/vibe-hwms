import { z } from "zod";

import { jsonError, zodErrorToMessage } from "@/lib/api/http";
import { requireProfile } from "@/lib/api/rbac";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const createShiftSchema = z.object({
  hospital_id: z.string().uuid(),
  department_id: z.string().uuid().optional().nullable(),
  assigned_user_id: z.string().uuid().optional().nullable(),
  shift_type: z.string().optional().nullable(),
  start_at: z.string().min(1),
  end_at: z.string().min(1),
  notes: z.string().optional().nullable(),
});

export async function GET(request: Request) {
  try {
    const { user, profile, error: authError } = await requireProfile();
    if (authError) {
      return jsonError(500, "AUTH_ERROR", authError.message);
    }
    if (!user || !profile) {
      return jsonError(401, "UNAUTHORIZED", "Authentication required");
    }

    const supabase = createSupabaseAdminClient();

    const { searchParams } = new URL(request.url);
    const hospitalId = searchParams.get("hospital_id");
    const departmentId = searchParams.get("department_id");

    let query = supabase
      .from("shifts")
      .select("id,hospital_id,department_id,assigned_user_id,shift_type,start_at,end_at,notes,is_active,created_at,updated_at")
      .order("start_at", { ascending: true });

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

    if (departmentId) {
      query = query.eq("department_id", departmentId);
    }

    if (profile.role === "doctor" || profile.role === "nurse") {
      query = query.eq("assigned_user_id", user.id);
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
    const { user, profile, error: authError } = await requireProfile();
    if (authError) {
      return jsonError(500, "AUTH_ERROR", authError.message);
    }
    if (!user || !profile) {
      return jsonError(401, "UNAUTHORIZED", "Authentication required");
    }

    if (!(profile.role === "super_admin" || profile.role === "admin" || profile.role === "hod")) {
      return jsonError(403, "FORBIDDEN", "Insufficient permissions");
    }

    const body = await request.json().catch(() => null);
    const parsed = createShiftSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(400, "VALIDATION_ERROR", zodErrorToMessage(parsed.error));
    }

    if (profile.role !== "super_admin") {
      if (!profile.hospital_id) {
        return jsonError(403, "FORBIDDEN", "Hospital scope required");
      }
      if (parsed.data.hospital_id !== profile.hospital_id) {
        return jsonError(403, "FORBIDDEN", "Hospital access denied");
      }
    }

    const supabase = createSupabaseAdminClient();
    const { data, error: dbError } = await supabase
      .from("shifts")
      .insert({
        hospital_id: parsed.data.hospital_id,
        department_id: parsed.data.department_id ?? null,
        assigned_user_id: parsed.data.assigned_user_id ?? null,
        shift_type: parsed.data.shift_type ?? null,
        start_at: parsed.data.start_at,
        end_at: parsed.data.end_at,
        notes: parsed.data.notes ?? null,
      })
      .select("id,hospital_id,department_id,assigned_user_id,shift_type,start_at,end_at,notes,is_active,created_at,updated_at")
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
