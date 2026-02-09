import { z } from "zod";

import { requireRole } from "@/lib/api/rbac";
import { jsonError, zodErrorToMessage } from "@/lib/api/http";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const paramsSchema = z.object({
  id: z.string().uuid(),
});

const updateDepartmentSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.string().optional().nullable(),
  hod_user_id: z.string().uuid().optional().nullable(),
  is_active: z.boolean().optional(),
});

export async function GET(_request: Request, ctx: { params: { id: string } }) {
  const parsedParams = paramsSchema.safeParse(ctx.params);
  if (!parsedParams.success) {
    return jsonError(400, "VALIDATION_ERROR", zodErrorToMessage(parsedParams.error));
  }

  try {
    const { allowed, profile, error: authError } = await requireRole(["super_admin", "admin", "hod"] as const);
    if (authError) {
      return jsonError(500, "AUTH_ERROR", authError.message);
    }
    if (!allowed || !profile) {
      return jsonError(403, "FORBIDDEN", "Insufficient permissions");
    }

    const supabase = createSupabaseAdminClient();

    const { data, error: dbError } = await supabase
      .from("departments")
      .select("id,hospital_id,name,type,hod_user_id,is_active,created_at,updated_at")
      .eq("id", parsedParams.data.id)
      .single();

    if (dbError) {
      return jsonError(500, "DB_ERROR", dbError.message);
    }

    if (!data) {
      return jsonError(404, "NOT_FOUND", "Department not found");
    }

    if (profile.role !== "super_admin" && profile.hospital_id !== data.hospital_id) {
      return jsonError(403, "FORBIDDEN", "Hospital access denied");
    }

    return Response.json({ data });
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
  const parsedBody = updateDepartmentSchema.safeParse(body);
  if (!parsedBody.success) {
    return jsonError(400, "VALIDATION_ERROR", zodErrorToMessage(parsedBody.error));
  }

  try {
    const { allowed, profile, error: authError } = await requireRole(["super_admin", "admin", "hod"] as const);
    if (authError) {
      return jsonError(500, "AUTH_ERROR", authError.message);
    }
    if (!allowed || !profile) {
      return jsonError(403, "FORBIDDEN", "Insufficient permissions");
    }

    const supabase = createSupabaseAdminClient();

    const { data: existing, error: existingError } = await supabase
      .from("departments")
      .select("id,hospital_id")
      .eq("id", parsedParams.data.id)
      .single();

    if (existingError) {
      return jsonError(500, "DB_ERROR", existingError.message);
    }

    if (!existing) {
      return jsonError(404, "NOT_FOUND", "Department not found");
    }

    if (profile.role !== "super_admin" && profile.hospital_id !== existing.hospital_id) {
      return jsonError(403, "FORBIDDEN", "Hospital access denied");
    }

    const { data, error: dbError } = await supabase
      .from("departments")
      .update(parsedBody.data)
      .eq("id", parsedParams.data.id)
      .select("id,hospital_id,name,type,hod_user_id,is_active,created_at,updated_at")
      .single();

    if (dbError) {
      return jsonError(500, "DB_ERROR", dbError.message);
    }

    if (!data) {
      return jsonError(404, "NOT_FOUND", "Department not found");
    }

    return Response.json({ data });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return jsonError(500, "INTERNAL_ERROR", message);
  }
}
