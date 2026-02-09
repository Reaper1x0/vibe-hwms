import { z } from "zod";

import { jsonError, zodErrorToMessage } from "@/lib/api/http";
import { requireProfile } from "@/lib/api/rbac";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const paramsSchema = z.object({
  id: z.string().uuid(),
});

const updatePatientSchema = z
  .object({
    department_id: z.string().uuid().optional().nullable(),
    mrn: z.string().min(1).optional().nullable(),
    full_name: z.string().min(1).optional(),
    date_of_birth: z.string().optional().nullable(),
    gender: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
    is_active: z.boolean().optional(),
  })
  .strict();

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
    const { data: patient, error: dbError } = await supabase
      .from("patients")
      .select("id,hospital_id,department_id,mrn,full_name,date_of_birth,gender,notes,is_active,created_at,updated_at")
      .eq("id", parsedParams.data.id)
      .single();

    if (dbError) {
      return jsonError(500, "DB_ERROR", dbError.message);
    }

    if (!patient) {
      return jsonError(404, "NOT_FOUND", "Patient not found");
    }

    if (profile.role !== "super_admin") {
      if (!profile.hospital_id || profile.hospital_id !== patient.hospital_id) {
        return jsonError(403, "FORBIDDEN", "Hospital access denied");
      }
    }

    return Response.json({ data: patient });
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
  const parsedBody = updatePatientSchema.safeParse(body);
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
      .from("patients")
      .select("id,hospital_id")
      .eq("id", parsedParams.data.id)
      .single();

    if (existingError) {
      return jsonError(500, "DB_ERROR", existingError.message);
    }

    if (!existing) {
      return jsonError(404, "NOT_FOUND", "Patient not found");
    }

    if (profile.role !== "super_admin") {
      if (!profile.hospital_id || profile.hospital_id !== existing.hospital_id) {
        return jsonError(403, "FORBIDDEN", "Hospital access denied");
      }
    }

    const { data, error: dbError } = await supabase
      .from("patients")
      .update(parsedBody.data)
      .eq("id", parsedParams.data.id)
      .select("id,hospital_id,department_id,mrn,full_name,date_of_birth,gender,notes,is_active,created_at,updated_at")
      .single();

    if (dbError) {
      return jsonError(500, "DB_ERROR", dbError.message);
    }

    if (!data) {
      return jsonError(404, "NOT_FOUND", "Patient not found");
    }

    return Response.json({ data });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return jsonError(500, "INTERNAL_ERROR", message);
  }
}
