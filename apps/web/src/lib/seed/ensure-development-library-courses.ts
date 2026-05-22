import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { seedLibraryMockCourses } from "./seed-library-mock-courses";

export interface EnsureDevelopmentLibraryCoursesResult {
  ok: boolean;
  strategy: "service-role" | "session-admin" | "skipped" | "blocked";
  message?: string;
}

export async function ensureDevelopmentLibraryCourses(
  userId?: string | null
): Promise<EnsureDevelopmentLibraryCoursesResult> {
  if (process.env.NODE_ENV === "production") {
    return { ok: false, strategy: "skipped", message: "Production build" };
  }

  const serviceRoleClient = getServiceRoleClient();

  if (serviceRoleClient && userId) {
    try {
      await seedLibraryMockCourses(serviceRoleClient, { userId });
      return { ok: true, strategy: "service-role" };
    } catch (error) {
      return {
        ok: false,
        strategy: "service-role",
        message: error instanceof Error ? error.message : "Service-role seeding failed",
      };
    }
  }

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, strategy: "blocked", message: "No authenticated user" };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    return { ok: false, strategy: "blocked", message: profileError.message };
  }

  if (profile?.role !== "admin") {
    return { ok: false, strategy: "blocked", message: "Admin role required" };
  }

  try {
    await seedLibraryMockCourses(supabase, { createdBy: user.id, userId: user.id });
    return { ok: true, strategy: "session-admin" };
  } catch (error) {
    return {
      ok: false,
      strategy: "session-admin",
      message: error instanceof Error ? error.message : "Session seeding failed",
    };
  }
}

function getServiceRoleClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
