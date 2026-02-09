import { jsonError } from "@/lib/api/http";
import { requireProfile } from "@/lib/api/rbac";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

async function getCount(query: PromiseLike<{ count: number | null; error: { message: string } | null }>) {
  const { count, error } = await query;
  if (error) {
    return { count: null, error } as const;
  }
  return { count: count ?? 0, error: null } as const;
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
    const hospitalIdParam = searchParams.get("hospital_id");

    const hospitalId = profile.role === "super_admin" ? hospitalIdParam : profile.hospital_id;

    if (profile.role !== "super_admin") {
      if (!profile.hospital_id) {
        return jsonError(403, "FORBIDDEN", "Hospital scope required");
      }
      if (hospitalIdParam && hospitalIdParam !== profile.hospital_id) {
        return jsonError(403, "FORBIDDEN", "Hospital access denied");
      }
    }

    const supabase = createSupabaseAdminClient();

    const isClinician = profile.role === "doctor" || profile.role === "nurse";

    const patientsQ = supabase
      .from("patients")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true)
      .match(hospitalId ? { hospital_id: hospitalId } : {});

    const shiftsBase = supabase
      .from("shifts")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true)
      .match(hospitalId ? { hospital_id: hospitalId } : {});

    const shiftsQ = isClinician ? shiftsBase.eq("assigned_user_id", user.id) : shiftsBase;

    const leavesBase = supabase
      .from("leave_requests")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true)
      .match(hospitalId ? { hospital_id: hospitalId } : {});

    const leavesQ = isClinician ? leavesBase.eq("user_id", user.id) : leavesBase;

    const tasksBase = supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true)
      .match(hospitalId ? { hospital_id: hospitalId } : {});

    const tasksQ =
      isClinician && profile.role !== "super_admin" ? tasksBase.or(`assigned_to.eq.${user.id},created_by.eq.${user.id}`) : tasksBase;

    const swapsBase = supabase
      .from("swap_requests")
      .select("id, shifts!inner(hospital_id)", { count: "exact", head: true })
      .eq("is_active", true);

    let swapsScoped = swapsBase;
    if (hospitalId) {
      swapsScoped = swapsScoped.eq("shifts.hospital_id", hospitalId);
    }

    const swapsQ = isClinician
      ? swapsScoped.or(`requester_id.eq.${user.id},requested_with_user_id.eq.${user.id}`)
      : swapsScoped;

    const handoversBase = supabase
      .from("handovers")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true)
      .match(hospitalId ? { hospital_id: hospitalId } : {});

    const handoversQ = isClinician ? handoversBase.or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`) : handoversBase;

    const [
      patientsCount,
      shiftsCount,
      leavesCount,
      tasksCount,
      swapsCount,
      handoversCount,
      tasksTodo,
      tasksInProgress,
      tasksDone,
      tasksCancelled,
      tasksLow,
      tasksMedium,
      tasksHigh,
      tasksCritical,
    ] = await Promise.all([
      getCount(patientsQ),
      getCount(shiftsQ),
      getCount(leavesQ),
      getCount(tasksQ),
      getCount(swapsQ),
      getCount(handoversQ),
      getCount(
        (isClinician ? tasksBase.or(`assigned_to.eq.${user.id},created_by.eq.${user.id}`) : tasksBase).eq("status", "todo"),
      ),
      getCount(
        (isClinician ? tasksBase.or(`assigned_to.eq.${user.id},created_by.eq.${user.id}`) : tasksBase).eq("status", "in_progress"),
      ),
      getCount(
        (isClinician ? tasksBase.or(`assigned_to.eq.${user.id},created_by.eq.${user.id}`) : tasksBase).eq("status", "done"),
      ),
      getCount(
        (isClinician ? tasksBase.or(`assigned_to.eq.${user.id},created_by.eq.${user.id}`) : tasksBase).eq("status", "cancelled"),
      ),
      getCount(
        (isClinician ? tasksBase.or(`assigned_to.eq.${user.id},created_by.eq.${user.id}`) : tasksBase).eq("priority", "low"),
      ),
      getCount(
        (isClinician ? tasksBase.or(`assigned_to.eq.${user.id},created_by.eq.${user.id}`) : tasksBase).eq("priority", "medium"),
      ),
      getCount(
        (isClinician ? tasksBase.or(`assigned_to.eq.${user.id},created_by.eq.${user.id}`) : tasksBase).eq("priority", "high"),
      ),
      getCount(
        (isClinician ? tasksBase.or(`assigned_to.eq.${user.id},created_by.eq.${user.id}`) : tasksBase).eq("priority", "critical"),
      ),
    ]);

    const results = [
      patientsCount,
      shiftsCount,
      leavesCount,
      tasksCount,
      swapsCount,
      handoversCount,
      tasksTodo,
      tasksInProgress,
      tasksDone,
      tasksCancelled,
      tasksLow,
      tasksMedium,
      tasksHigh,
      tasksCritical,
    ];

    const firstError = results.find((r) => r.error);
    if (firstError?.error) {
      return jsonError(500, "DB_ERROR", firstError.error.message);
    }

    return Response.json({
      data: {
        scope: {
          hospital_id: hospitalId ?? null,
          role: profile.role,
        },
        counts: {
          patients: patientsCount.count ?? 0,
          shifts: shiftsCount.count ?? 0,
          leave_requests: leavesCount.count ?? 0,
          tasks: tasksCount.count ?? 0,
          swap_requests: swapsCount.count ?? 0,
          handovers: handoversCount.count ?? 0,
        },
        tasks: {
          by_status: {
            todo: tasksTodo.count ?? 0,
            in_progress: tasksInProgress.count ?? 0,
            done: tasksDone.count ?? 0,
            cancelled: tasksCancelled.count ?? 0,
          },
          by_priority: {
            low: tasksLow.count ?? 0,
            medium: tasksMedium.count ?? 0,
            high: tasksHigh.count ?? 0,
            critical: tasksCritical.count ?? 0,
          },
        },
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return jsonError(500, "INTERNAL_ERROR", message);
  }
}
