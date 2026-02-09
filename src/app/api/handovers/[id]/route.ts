import { z } from "zod";

import { jsonError, zodErrorToMessage } from "@/lib/api/http";
import { requireProfile } from "@/lib/api/rbac";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const paramsSchema = z.object({
  id: z.string().uuid(),
});

const updateHandoverSchema = z
  .object({
    department_id: z.string().uuid().optional().nullable(),
    patient_id: z.string().uuid().optional().nullable(),
    shift_id: z.string().uuid().optional().nullable(),
    to_user_id: z.string().uuid().optional().nullable(),
    notes: z.string().optional().nullable(),
    is_active: z.boolean().optional(),
  })
  .strict();

async function ensureEntityInHospital(opts: {
  supabase: ReturnType<typeof createSupabaseAdminClient>;
  table: "departments" | "patients" | "shifts";
  id: string;
  hospitalId: string;
}) {
  const { data, error } = await opts.supabase
    .from(opts.table)
    .select("id,hospital_id")
    .eq("id", opts.id)
    .single();

  if (error) {
    return { ok: false as const, error };
  }

  if (!data) {
    return { ok: false as const, error: null };
  }

  if (data.hospital_id !== opts.hospitalId) {
    return { ok: false as const, error: null };
  }

  return { ok: true as const, error: null };
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
    const { data: handover, error: dbError } = await supabase
      .from("handovers")
      .select(
        "id,hospital_id,department_id,patient_id,shift_id,from_user_id,to_user_id,notes,is_active,created_at,updated_at",
      )
      .eq("id", parsedParams.data.id)
      .single();

    if (dbError) {
      return jsonError(500, "DB_ERROR", dbError.message);
    }

    if (!handover) {
      return jsonError(404, "NOT_FOUND", "Handover not found");
    }

    if (profile.role !== "super_admin") {
      if (!profile.hospital_id || profile.hospital_id !== handover.hospital_id) {
        return jsonError(403, "FORBIDDEN", "Hospital access denied");
      }

      if (profile.role === "doctor" || profile.role === "nurse") {
        const isRelated = handover.from_user_id === user.id || handover.to_user_id === user.id;
        if (!isRelated) {
          return jsonError(403, "FORBIDDEN", "Handover access denied");
        }
      }
    }

    return Response.json({ data: handover });
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
  const parsedBody = updateHandoverSchema.safeParse(body);
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
      .from("handovers")
      .select("id,hospital_id,from_user_id,to_user_id")
      .eq("id", parsedParams.data.id)
      .single();

    if (existingError) {
      return jsonError(500, "DB_ERROR", existingError.message);
    }

    if (!existing) {
      return jsonError(404, "NOT_FOUND", "Handover not found");
    }

    if (profile.role !== "super_admin") {
      if (!profile.hospital_id || profile.hospital_id !== existing.hospital_id) {
        return jsonError(403, "FORBIDDEN", "Hospital access denied");
      }

      if (profile.role === "doctor" || profile.role === "nurse") {
        const isRelated = existing.from_user_id === user.id || existing.to_user_id === user.id;
        if (!isRelated) {
          return jsonError(403, "FORBIDDEN", "Handover access denied");
        }
      }
    }

    if (parsedBody.data.department_id) {
      const ok = await ensureEntityInHospital({
        supabase,
        table: "departments",
        id: parsedBody.data.department_id,
        hospitalId: existing.hospital_id,
      });
      if (!ok.ok && ok.error) {
        return jsonError(500, "DB_ERROR", ok.error.message);
      }
      if (!ok.ok) {
        return jsonError(400, "VALIDATION_ERROR", "department_id does not belong to hospital");
      }
    }

    if (parsedBody.data.patient_id) {
      const ok = await ensureEntityInHospital({
        supabase,
        table: "patients",
        id: parsedBody.data.patient_id,
        hospitalId: existing.hospital_id,
      });
      if (!ok.ok && ok.error) {
        return jsonError(500, "DB_ERROR", ok.error.message);
      }
      if (!ok.ok) {
        return jsonError(400, "VALIDATION_ERROR", "patient_id does not belong to hospital");
      }
    }

    if (parsedBody.data.shift_id) {
      const ok = await ensureEntityInHospital({
        supabase,
        table: "shifts",
        id: parsedBody.data.shift_id,
        hospitalId: existing.hospital_id,
      });
      if (!ok.ok && ok.error) {
        return jsonError(500, "DB_ERROR", ok.error.message);
      }
      if (!ok.ok) {
        return jsonError(400, "VALIDATION_ERROR", "shift_id does not belong to hospital");
      }
    }

    const { data, error: dbError } = await supabase
      .from("handovers")
      .update(parsedBody.data)
      .eq("id", parsedParams.data.id)
      .select(
        "id,hospital_id,department_id,patient_id,shift_id,from_user_id,to_user_id,notes,is_active,created_at,updated_at",
      )
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
