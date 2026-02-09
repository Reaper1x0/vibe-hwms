import { z } from "zod";

import { jsonError, zodErrorToMessage } from "@/lib/api/http";
import { requireProfile } from "@/lib/api/rbac";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const createSwapSchema = z.object({
  shift_id: z.string().uuid(),
  requested_with_user_id: z.string().uuid().optional().nullable(),
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

    const { searchParams } = new URL(request.url);
    const hospitalId = searchParams.get("hospital_id");
    const status = searchParams.get("status");
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "25", 10)));
    const offset = Math.max(0, parseInt(searchParams.get("offset") || "0", 10));

    const supabase = createSupabaseAdminClient();

    let query = supabase
      .from("swap_requests")
      .select(
        "id,shift_id,requester_id,requested_with_user_id,status,reason,reviewed_by,reviewed_at,is_active,created_at,updated_at, shifts!inner(hospital_id,start_at,end_at,assigned_user_id)",
        { count: "exact" },
      )
      .order("created_at", { ascending: false });

    if (profile.role === "super_admin") {
      if (hospitalId) {
        query = query.eq("shifts.hospital_id", hospitalId);
      }
    } else {
      if (!profile.hospital_id) {
        return jsonError(403, "FORBIDDEN", "Hospital scope required");
      }
      if (hospitalId && hospitalId !== profile.hospital_id) {
        return jsonError(403, "FORBIDDEN", "Hospital access denied");
      }
      query = query.eq("shifts.hospital_id", profile.hospital_id);
    }

    if (profile.role === "doctor" || profile.role === "nurse") {
      query = query.or(`requester_id.eq.${user.id},requested_with_user_id.eq.${user.id}`);
    }

    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    query = query.range(offset, offset + limit - 1);

    const { data, error: dbError, count } = await query;
    if (dbError) {
      return jsonError(500, "DB_ERROR", dbError.message);
    }

    return Response.json({
      data: data ?? [],
      pagination: {
        total: count ?? 0,
        limit,
        offset,
        hasMore: (count ?? 0) > offset + limit,
      },
    });
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

    const body = await request.json().catch(() => null);
    const parsed = createSwapSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(400, "VALIDATION_ERROR", zodErrorToMessage(parsed.error));
    }

    const supabase = createSupabaseAdminClient();

    const { data: shift, error: shiftError } = await supabase
      .from("shifts")
      .select("id,hospital_id,assigned_user_id")
      .eq("id", parsed.data.shift_id)
      .single();

    if (shiftError) {
      return jsonError(500, "DB_ERROR", shiftError.message);
    }

    if (!shift) {
      return jsonError(404, "NOT_FOUND", "Shift not found");
    }

    if (profile.role !== "super_admin") {
      if (!profile.hospital_id || profile.hospital_id !== shift.hospital_id) {
        return jsonError(403, "FORBIDDEN", "Hospital access denied");
      }
    }

    if (profile.role === "doctor" || profile.role === "nurse") {
      if (shift.assigned_user_id !== user.id) {
        return jsonError(403, "FORBIDDEN", "Only the assigned staff can request a swap");
      }
    }

    const { data, error: dbError } = await supabase
      .from("swap_requests")
      .insert({
        shift_id: parsed.data.shift_id,
        requester_id: user.id,
        requested_with_user_id: parsed.data.requested_with_user_id ?? null,
        reason: parsed.data.reason ?? null,
        status: "pending",
      })
      .select(
        "id,shift_id,requester_id,requested_with_user_id,status,reason,reviewed_by,reviewed_at,is_active,created_at,updated_at",
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
