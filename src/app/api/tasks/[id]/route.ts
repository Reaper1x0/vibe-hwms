import { z } from "zod";

import { jsonError, zodErrorToMessage } from "@/lib/api/http";
import { requireProfile } from "@/lib/api/rbac";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const paramsSchema = z.object({
  id: z.string().uuid(),
});

const updateTaskSchema = z
  .object({
    assigned_to: z.string().uuid().optional().nullable(),
    title: z.string().min(1).optional(),
    description: z.string().optional().nullable(),
    status: z.enum(["todo", "in_progress", "done", "cancelled"]).optional(),
    priority: z.enum(["low", "medium", "high", "critical"]).optional(),
    due_at: z.string().optional().nullable(),
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
    const { data: task, error: dbError } = await supabase
      .from("tasks")
      .select(
        "id,hospital_id,department_id,patient_id,created_by,assigned_to,title,description,status,priority,due_at,is_active,created_at,updated_at",
      )
      .eq("id", parsedParams.data.id)
      .single();

    if (dbError) {
      return jsonError(500, "DB_ERROR", dbError.message);
    }

    if (!task) {
      return jsonError(404, "NOT_FOUND", "Task not found");
    }

    if (profile.role !== "super_admin") {
      if (!profile.hospital_id || profile.hospital_id !== task.hospital_id) {
        return jsonError(403, "FORBIDDEN", "Hospital access denied");
      }

      if (profile.role === "doctor" || profile.role === "nurse") {
        const isRelated = task.assigned_to === user.id || task.created_by === user.id;
        if (!isRelated) {
          return jsonError(403, "FORBIDDEN", "Task access denied");
        }
      }
    }

    return Response.json({ data: task });
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
  const parsedBody = updateTaskSchema.safeParse(body);
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
      .from("tasks")
      .select("id,hospital_id,created_by,assigned_to")
      .eq("id", parsedParams.data.id)
      .single();

    if (existingError) {
      return jsonError(500, "DB_ERROR", existingError.message);
    }

    if (!existing) {
      return jsonError(404, "NOT_FOUND", "Task not found");
    }

    if (profile.role !== "super_admin") {
      if (!profile.hospital_id || profile.hospital_id !== existing.hospital_id) {
        return jsonError(403, "FORBIDDEN", "Hospital access denied");
      }

      if (profile.role === "doctor" || profile.role === "nurse") {
        const isRelated = existing.assigned_to === user.id || existing.created_by === user.id;
        if (!isRelated) {
          return jsonError(403, "FORBIDDEN", "Task access denied");
        }
      }
    }

    const { data, error: dbError } = await supabase
      .from("tasks")
      .update(parsedBody.data)
      .eq("id", parsedParams.data.id)
      .select(
        "id,hospital_id,department_id,patient_id,created_by,assigned_to,title,description,status,priority,due_at,is_active,created_at,updated_at",
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
