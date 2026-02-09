import { z } from "zod";

import { jsonError, zodErrorToMessage } from "@/lib/api/http";
import { requireRole } from "@/lib/api/rbac";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const createHospitalSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  address: z.string().optional(),
  city: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
});

export async function GET() {
  try {
    const { allowed, error: authError } = await requireRole(["super_admin"] as const);
    if (authError) {
      return jsonError(500, "AUTH_ERROR", authError.message);
    }
    if (!allowed) {
      return jsonError(403, "FORBIDDEN", "Insufficient permissions");
    }

    const supabase = createSupabaseAdminClient();

    const { data, error: dbError } = await supabase
      .from("hospitals")
      .select("id,name,code,address,city,phone,email,is_active,created_at,updated_at")
      .order("created_at", { ascending: false });

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
    const { allowed, error: authError } = await requireRole(["super_admin"] as const);
    if (authError) {
      return jsonError(500, "AUTH_ERROR", authError.message);
    }
    if (!allowed) {
      return jsonError(403, "FORBIDDEN", "Insufficient permissions");
    }

    const supabase = createSupabaseAdminClient();

    const body = await request.json().catch(() => null);
    const parsed = createHospitalSchema.safeParse(body);

    if (!parsed.success) {
      return jsonError(400, "VALIDATION_ERROR", zodErrorToMessage(parsed.error));
    }

    const { data, error: dbError } = await supabase
      .from("hospitals")
      .insert({
        name: parsed.data.name,
        code: parsed.data.code,
        address: parsed.data.address ?? null,
        city: parsed.data.city ?? null,
        phone: parsed.data.phone ?? null,
        email: parsed.data.email ?? null,
      })
      .select("id,name,code,address,city,phone,email,is_active,created_at,updated_at")
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
