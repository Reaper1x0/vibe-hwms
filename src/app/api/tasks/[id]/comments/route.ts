import { z } from "zod";

import { jsonError, zodErrorToMessage } from "@/lib/api/http";
import { requireProfile } from "@/lib/api/rbac";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const paramsSchema = z.object({
  id: z.string().uuid(),
});

const createCommentSchema = z.object({
  body: z.string().min(1),
});

async function canAccessTask(args: { taskId: string; userId: string; role: string; hospitalId: string | null }) {
  const supabase = createSupabaseAdminClient();
  const { data: task, error } = await supabase
    .from("tasks")
    .select("id,hospital_id,created_by,assigned_to")
    .eq("id", args.taskId)
    .single();

  if (error) {
    return { ok: false as const, code: "DB_ERROR" as const, message: error.message };
  }

  if (!task) {
    return { ok: false as const, code: "NOT_FOUND" as const, message: "Task not found" };
  }

  if (args.role !== "super_admin") {
    if (!args.hospitalId || args.hospitalId !== task.hospital_id) {
      return { ok: false as const, code: "FORBIDDEN" as const, message: "Hospital access denied" };
    }

    if (args.role === "doctor" || args.role === "nurse") {
      const isRelated = task.assigned_to === args.userId || task.created_by === args.userId;
      if (!isRelated) {
        return { ok: false as const, code: "FORBIDDEN" as const, message: "Task access denied" };
      }
    }
  }

  return { ok: true as const, task };
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

    const access = await canAccessTask({
      taskId: parsedParams.data.id,
      userId: user.id,
      role: profile.role,
      hospitalId: profile.hospital_id,
    });

    if (!access.ok) {
      const status = access.code === "NOT_FOUND" ? 404 : access.code === "FORBIDDEN" ? 403 : 500;
      return jsonError(status, access.code, access.message);
    }

    const supabase = createSupabaseAdminClient();
    const { data, error: dbError } = await supabase
      .from("task_comments")
      .select("id,task_id,user_id,body,is_active,created_at,updated_at")
      .eq("task_id", parsedParams.data.id)
      .order("created_at", { ascending: true });

    if (dbError) {
      return jsonError(500, "DB_ERROR", dbError.message);
    }

    return Response.json({ data });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return jsonError(500, "INTERNAL_ERROR", message);
  }
}

export async function POST(request: Request, ctx: { params: { id: string } }) {
  const parsedParams = paramsSchema.safeParse(ctx.params);
  if (!parsedParams.success) {
    return jsonError(400, "VALIDATION_ERROR", zodErrorToMessage(parsedParams.error));
  }

  const body = await request.json().catch(() => null);
  const parsedBody = createCommentSchema.safeParse(body);
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

    const access = await canAccessTask({
      taskId: parsedParams.data.id,
      userId: user.id,
      role: profile.role,
      hospitalId: profile.hospital_id,
    });

    if (!access.ok) {
      const status = access.code === "NOT_FOUND" ? 404 : access.code === "FORBIDDEN" ? 403 : 500;
      return jsonError(status, access.code, access.message);
    }

    const supabase = createSupabaseAdminClient();
    const { data, error: dbError } = await supabase
      .from("task_comments")
      .insert({
        task_id: parsedParams.data.id,
        user_id: user.id,
        body: parsedBody.data.body,
      })
      .select("id,task_id,user_id,body,is_active,created_at,updated_at")
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
