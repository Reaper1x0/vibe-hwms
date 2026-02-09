import { z } from "zod";

import { jsonError, zodErrorToMessage } from "@/lib/api/http";
import { requireProfile } from "@/lib/api/rbac";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const createTaskSchema = z.object({
  hospital_id: z.string().uuid().optional(),
  department_id: z.string().uuid().optional().nullable(),
  patient_id: z.string().uuid().optional().nullable(),
  assigned_to: z.string().uuid().optional().nullable(),
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  status: z.enum(["todo", "in_progress", "done", "cancelled"]).optional(),
  priority: z.enum(["low", "medium", "high", "critical"]).optional(),
  due_at: z.string().optional().nullable(),
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
    const patientId = searchParams.get("patient_id");
    const assignedTo = searchParams.get("assigned_to");

    const supabase = createSupabaseAdminClient();

    let query = supabase
      .from("tasks")
      .select(
        "id,hospital_id,department_id,patient_id,created_by,assigned_to,title,description,status,priority,due_at,is_active,created_at,updated_at",
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
        query = query.or(`assigned_to.eq.${user.id},created_by.eq.${user.id}`);
      }
    }

    if (patientId) {
      query = query.eq("patient_id", patientId);
    }

    if (assignedTo) {
      query = query.eq("assigned_to", assignedTo);
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
    const parsed = createTaskSchema.safeParse(body);
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
    const { data, error: dbError } = await supabase
      .from("tasks")
      .insert({
        hospital_id: hospitalId,
        department_id: parsed.data.department_id ?? profile.department_id ?? null,
        patient_id: parsed.data.patient_id ?? null,
        created_by: user.id,
        assigned_to: parsed.data.assigned_to ?? null,
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        status: parsed.data.status ?? "todo",
        priority: parsed.data.priority ?? "medium",
        due_at: parsed.data.due_at ?? null,
      })
      .select(
        "id,hospital_id,department_id,patient_id,created_by,assigned_to,title,description,status,priority,due_at,is_active,created_at,updated_at",
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
