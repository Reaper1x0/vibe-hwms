import { z } from "zod";

import { jsonError, zodErrorToMessage } from "@/lib/api/http";
import { requireProfile } from "@/lib/api/rbac";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const createPatientSchema = z.object({
  hospital_id: z.string().uuid(),
  department_id: z.string().uuid().optional().nullable(),
  mrn: z.string().min(1).optional().nullable(),
  full_name: z.string().min(1),
  date_of_birth: z.string().optional().nullable(),
  gender: z.string().optional().nullable(),
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

    const { searchParams } = new URL(request.url);
    const hospitalId = searchParams.get("hospital_id");
    const departmentId = searchParams.get("department_id");

    const supabase = createSupabaseAdminClient();

    let query = supabase
      .from("patients")
      .select("id,hospital_id,department_id,mrn,full_name,date_of_birth,gender,notes,is_active,created_at,updated_at")
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

    if (departmentId) {
      query = query.eq("department_id", departmentId);
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

    const body = await request.json().catch(() => null);
    const parsed = createPatientSchema.safeParse(body);
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
      .from("patients")
      .insert({
        hospital_id: parsed.data.hospital_id,
        department_id: parsed.data.department_id ?? null,
        mrn: parsed.data.mrn ?? null,
        full_name: parsed.data.full_name,
        date_of_birth: parsed.data.date_of_birth ?? null,
        gender: parsed.data.gender ?? null,
        notes: parsed.data.notes ?? null,
      })
      .select("id,hospital_id,department_id,mrn,full_name,date_of_birth,gender,notes,is_active,created_at,updated_at")
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
