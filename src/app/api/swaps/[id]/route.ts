import { z } from "zod";

import { jsonError, zodErrorToMessage } from "@/lib/api/http";
import { requireProfile } from "@/lib/api/rbac";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const paramsSchema = z.object({
  id: z.string().uuid(),
});

const updateSwapSchema = z
  .object({
    status: z.enum(["pending", "approved", "rejected", "cancelled"]).optional(),
  })
  .strict();

function getJoinedShift<T extends { shifts: unknown }>(row: T): { hospital_id: string } | null {
  const shifts = (row as { shifts?: unknown }).shifts;
  if (!shifts) return null;
  if (Array.isArray(shifts)) {
    return (shifts[0] as { hospital_id: string } | undefined) ?? null;
  }
  return shifts as { hospital_id: string };
}

export async function GET(_request: Request, ctx: { params: { id: string } }) {
  const parsedParams = paramsSchema.safeParse(ctx.params);
  if (!parsedParams.success) {
    return jsonError(400, "VALIDATION_ERROR", zodErrorToMessage(parsedParams.error));
  }

  try {
    const { user, profile, error: authError } = await requireProfile();
    if (authError) {
      return jsonError(500, "AUTH_ERROR", authError.message);
    }
    if (!user || !profile) {
      return jsonError(401, "UNAUTHORIZED", "Authentication required");
    }

    const supabase = createSupabaseAdminClient();
    const { data: swap, error: dbError } = await supabase
      .from("swap_requests")
      .select(
        "id,shift_id,requester_id,requested_with_user_id,status,reason,reviewed_by,reviewed_at,is_active,created_at,updated_at, shifts!inner(hospital_id,start_at,end_at,assigned_user_id)",
      )
      .eq("id", parsedParams.data.id)
      .single();

    if (dbError) {
      return jsonError(500, "DB_ERROR", dbError.message);
    }

    if (!swap) {
      return jsonError(404, "NOT_FOUND", "Swap request not found");
    }

    const joinedShift = getJoinedShift(swap);
    if (!joinedShift) {
      return jsonError(500, "DB_ERROR", "Shift relation missing");
    }

    if (profile.role !== "super_admin") {
      if (!profile.hospital_id || profile.hospital_id !== joinedShift.hospital_id) {
        return jsonError(403, "FORBIDDEN", "Hospital access denied");
      }
    }

    if (profile.role === "doctor" || profile.role === "nurse") {
      const isRelated = swap.requester_id === user.id || swap.requested_with_user_id === user.id;
      if (!isRelated) {
        return jsonError(403, "FORBIDDEN", "Swap access denied");
      }
    }

    return Response.json({ data: swap });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return jsonError(500, "INTERNAL_ERROR", message);
  }
}

export async function PUT(request: Request, ctx: { params: { id: string } }) {
  const parsedParams = paramsSchema.safeParse(ctx.params);
  if (!parsedParams.success) {
    return jsonError(400, "VALIDATION_ERROR", zodErrorToMessage(parsedParams.error));
  }

  const body = await request.json().catch(() => null);
  const parsedBody = updateSwapSchema.safeParse(body);
  if (!parsedBody.success) {
    return jsonError(400, "VALIDATION_ERROR", zodErrorToMessage(parsedBody.error));
  }

  try {
    const { user, profile, error: authError } = await requireProfile();
    if (authError) {
      return jsonError(500, "AUTH_ERROR", authError.message);
    }
    if (!user || !profile) {
      return jsonError(401, "UNAUTHORIZED", "Authentication required");
    }

    const supabase = createSupabaseAdminClient();

    const { data: existing, error: existingError } = await supabase
      .from("swap_requests")
      .select("id,requester_id,requested_with_user_id,status, shifts!inner(hospital_id)")
      .eq("id", parsedParams.data.id)
      .single();

    if (existingError) {
      return jsonError(500, "DB_ERROR", existingError.message);
    }

    if (!existing) {
      return jsonError(404, "NOT_FOUND", "Swap request not found");
    }

    const joinedShift = getJoinedShift(existing);
    if (!joinedShift) {
      return jsonError(500, "DB_ERROR", "Shift relation missing");
    }

    if (profile.role !== "super_admin") {
      if (!profile.hospital_id || profile.hospital_id !== joinedShift.hospital_id) {
        return jsonError(403, "FORBIDDEN", "Hospital access denied");
      }
    }

    const nextStatus = parsedBody.data.status;
    if (!nextStatus) {
      return jsonError(400, "VALIDATION_ERROR", "Missing status");
    }

    const isStaff = profile.role === "doctor" || profile.role === "nurse";
    if (isStaff) {
      if (existing.requester_id !== user.id) {
        return jsonError(403, "FORBIDDEN", "Only the requester can update this swap");
      }
      if (nextStatus !== "cancelled") {
        return jsonError(403, "FORBIDDEN", "Only cancellation is allowed");
      }
      if (existing.status !== "pending") {
        return jsonError(400, "VALIDATION_ERROR", "Only pending requests can be cancelled");
      }
    } else {
      if (!(profile.role === "super_admin" || profile.role === "admin" || profile.role === "hod")) {
        return jsonError(403, "FORBIDDEN", "Insufficient permissions");
      }
      if (!(nextStatus === "approved" || nextStatus === "rejected" || nextStatus === "cancelled")) {
        return jsonError(400, "VALIDATION_ERROR", "Invalid status");
      }
    }

    const { data, error: dbError } = await supabase
      .from("swap_requests")
      .update({
        status: nextStatus,
        reviewed_by: isStaff ? null : user.id,
        reviewed_at: isStaff ? null : new Date().toISOString(),
      })
      .eq("id", parsedParams.data.id)
      .select("id,shift_id,requester_id,requested_with_user_id,status,reason,reviewed_by,reviewed_at,is_active,created_at,updated_at")
      .single();

    if (dbError) {
      return jsonError(500, "DB_ERROR", dbError.message);
    }

    return Response.json({ data });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return jsonError(500, "INTERNAL_ERROR", message);
  }
}
