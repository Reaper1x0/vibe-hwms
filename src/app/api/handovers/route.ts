import { z } from "zod";

import { jsonError, zodErrorToMessage } from "@/lib/api/http";
import { requireProfile } from "@/lib/api/rbac";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const createHandoverSchema = z.object({
  hospital_id: z.string().uuid().optional(),
  department_id: z.string().uuid().optional().nullable(),
  patient_id: z.string().uuid().optional().nullable(),
  shift_id: z.string().uuid().optional().nullable(),
  to_user_id: z.string().uuid().optional().nullable(),
  notes: z.string().optional().nullable(),
});

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
    const departmentId = searchParams.get("department_id");
    const patientId = searchParams.get("patient_id");
    const shiftId = searchParams.get("shift_id");
    const fromUserId = searchParams.get("from_user_id");
    const toUserId = searchParams.get("to_user_id");

    const supabase = createSupabaseAdminClient();

    let query = supabase
      .from("handovers")
      .select(
        "id,hospital_id,department_id,patient_id,shift_id,from_user_id,to_user_id,notes,is_active,created_at,updated_at",
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
        query = query.or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`);
      }
    }

    if (departmentId) query = query.eq("department_id", departmentId);
    if (patientId) query = query.eq("patient_id", patientId);
    if (shiftId) query = query.eq("shift_id", shiftId);
    if (fromUserId) query = query.eq("from_user_id", fromUserId);
    if (toUserId) query = query.eq("to_user_id", toUserId);

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

    const body = await request.json().catch(() => null);
    const parsed = createHandoverSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(400, "VALIDATION_ERROR", zodErrorToMessage(parsed.error));
    }

    const hospitalId = profile.role === "super_admin" ? parsed.data.hospital_id : profile.hospital_id;
    if (!hospitalId) {
      return jsonError(400, "VALIDATION_ERROR", "hospital_id is required");
    }

    if (profile.role !== "super_admin") {
      if (!profile.hospital_id) {
        return jsonError(403, "FORBIDDEN", "Hospital scope required");
      }
      if (hospitalId !== profile.hospital_id) {
        return jsonError(403, "FORBIDDEN", "Hospital access denied");
      }
    }

    const supabase = createSupabaseAdminClient();

    if (parsed.data.department_id) {
      const ok = await ensureEntityInHospital({
        supabase,
        table: "departments",
        id: parsed.data.department_id,
        hospitalId,
      });
      if (!ok.ok && ok.error) {
        return jsonError(500, "DB_ERROR", ok.error.message);
      }
      if (!ok.ok) {
        return jsonError(400, "VALIDATION_ERROR", "department_id does not belong to hospital");
      }
    }

    if (parsed.data.patient_id) {
      const ok = await ensureEntityInHospital({
        supabase,
        table: "patients",
        id: parsed.data.patient_id,
        hospitalId,
      });
      if (!ok.ok && ok.error) {
        return jsonError(500, "DB_ERROR", ok.error.message);
      }
      if (!ok.ok) {
        return jsonError(400, "VALIDATION_ERROR", "patient_id does not belong to hospital");
      }
    }

    if (parsed.data.shift_id) {
      const ok = await ensureEntityInHospital({
        supabase,
        table: "shifts",
        id: parsed.data.shift_id,
        hospitalId,
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
      .insert({
        hospital_id: hospitalId,
        department_id: parsed.data.department_id ?? profile.department_id ?? null,
        patient_id: parsed.data.patient_id ?? null,
        shift_id: parsed.data.shift_id ?? null,
        from_user_id: user.id,
        to_user_id: parsed.data.to_user_id ?? null,
        notes: parsed.data.notes ?? null,
      })
      .select(
        "id,hospital_id,department_id,patient_id,shift_id,from_user_id,to_user_id,notes,is_active,created_at,updated_at",
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
