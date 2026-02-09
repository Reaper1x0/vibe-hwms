import { z } from "zod";

import { jsonError, zodErrorToMessage } from "@/lib/api/http";
import { requireRole } from "@/lib/api/rbac";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const paramsSchema = z.object({
  id: z.string().uuid(),
});

const updateHospitalSchema = z.object({
  name: z.string().min(1).optional(),
  code: z.string().min(1).optional(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  is_active: z.boolean().optional(),
});

export async function GET(_request: Request, ctx: { params: { id: string } }) {
  const parsedParams = paramsSchema.safeParse(ctx.params);
  if (!parsedParams.success) {
    return jsonError(400, "VALIDATION_ERROR", zodErrorToMessage(parsedParams.error));
  }

  try {
    const { allowed, profile, error: authError } = await requireRole(["super_admin", "admin"] as const);
    if (authError) {
      return jsonError(500, "AUTH_ERROR", authError.message);
    }
    if (!allowed || !profile) {
      return jsonError(403, "FORBIDDEN", "Insufficient permissions");
    }

    if (profile.role === "admin" && profile.hospital_id !== parsedParams.data.id) {
      return jsonError(403, "FORBIDDEN", "Hospital access denied");
    }

    const supabase = createSupabaseAdminClient();

    const { data, error: dbError } = await supabase
      .from("hospitals")
      .select("id,name,code,address,city,phone,email,is_active,created_at,updated_at")
      .eq("id", parsedParams.data.id)
      .single();

    if (dbError) {
      return jsonError(500, "DB_ERROR", dbError.message);
    }

    if (!data) {
      return jsonError(404, "NOT_FOUND", "Hospital not found");
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
  const parsedBody = updateHospitalSchema.safeParse(body);
  if (!parsedBody.success) {
    return jsonError(400, "VALIDATION_ERROR", zodErrorToMessage(parsedBody.error));
  }

  try {
    const { allowed, profile, error: authError } = await requireRole(["super_admin", "admin"] as const);
    if (authError) {
      return jsonError(500, "AUTH_ERROR", authError.message);
    }
    if (!allowed || !profile) {
      return jsonError(403, "FORBIDDEN", "Insufficient permissions");
    }

    if (profile.role === "admin" && profile.hospital_id !== parsedParams.data.id) {
      return jsonError(403, "FORBIDDEN", "Hospital access denied");
    }

    const supabase = createSupabaseAdminClient();

    const { data, error: dbError } = await supabase
      .from("hospitals")
      .update(parsedBody.data)
      .eq("id", parsedParams.data.id)
      .select("id,name,code,address,city,phone,email,is_active,created_at,updated_at")
      .single();

    if (dbError) {
      return jsonError(500, "DB_ERROR", dbError.message);
    }

    if (!data) {
      return jsonError(404, "NOT_FOUND", "Hospital not found");
    }

    return Response.json({ data });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return jsonError(500, "INTERNAL_ERROR", message);
  }
}
