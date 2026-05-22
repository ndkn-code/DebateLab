import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureDevelopmentLibraryCourses } from "@/lib/seed/ensure-development-library-courses";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { ok: false, strategy: "blocked", message: "Authentication required" },
      { status: 401 }
    );
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json(
      { ok: false, strategy: "blocked", message: profileError.message },
      { status: 500 }
    );
  }

  if (profile?.role !== "admin") {
    return NextResponse.json(
      { ok: false, strategy: "blocked", message: "Admin role required" },
      { status: 403 }
    );
  }

  const result = await ensureDevelopmentLibraryCourses(user.id);

  if (result.ok) {
    return NextResponse.json(result);
  }

  return NextResponse.json(result, {
    status:
      result.strategy === "skipped"
        ? 400
        : result.strategy === "blocked"
          ? 403
          : 500,
  });
}
