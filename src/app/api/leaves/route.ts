import { z } from "zod";

import { jsonError, zodErrorToMessage } from "@/lib/api/http";
import { requireProfile } from "@/lib/api/rbac";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const createLeaveSchema = z.object({
  start_date: z.string().min(1),
  end_date: z.string().min(1),
  reason: z.string().optional().nullable(),
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

    let query = supabase
      .from("leave_requests")
      .select(
        "id,user_id,hospital_id,department_id,start_date,end_date,reason,status,reviewed_by,reviewed_at,is_active,created_at,updated_at",
      )
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

      if (profile.role === "doctor" || profile.role === "nurse") {
        query = query.eq("user_id", user.id);
      }
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

    if (!profile.hospital_id) {
      return jsonError(403, "FORBIDDEN", "Hospital scope required");
    }

    const body = await request.json().catch(() => null);
    const parsed = createLeaveSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(400, "VALIDATION_ERROR", zodErrorToMessage(parsed.error));
    }

    const supabase = createSupabaseAdminClient();
    const { data, error: dbError } = await supabase
      .from("leave_requests")
      .insert({
        user_id: user.id,
        hospital_id: profile.hospital_id,
        department_id: profile.department_id,
        start_date: parsed.data.start_date,
        end_date: parsed.data.end_date,
        reason: parsed.data.reason ?? null,
        status: "pending",
      })
      .select(
        "id,user_id,hospital_id,department_id,start_date,end_date,reason,status,reviewed_by,reviewed_at,is_active,created_at,updated_at",
      )
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
