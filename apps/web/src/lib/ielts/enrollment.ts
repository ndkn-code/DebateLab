import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createTypedServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";
import { isEligibleIeltsClass } from "@/lib/api/class-manager-model";

export type IeltsEnrollmentClient = SupabaseClient<Database>;

async function hasActiveClassEnrollment(
  supabase: IeltsEnrollmentClient,
  userId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("class_memberships")
    .select("class_id")
    .eq("user_id", userId)
    .eq("member_role", "student")
    .eq("status", "active")
    .limit(100);

  if (error) throw error;
  if (!data?.length) return false;

  const classIds = data.map((row) => row.class_id).filter(Boolean);
  const { data: ieltsClasses, error: classError } = await supabase
    .from("classes")
    .select("id, program_type, status")
    .in("id", classIds)
    .eq("program_type", "ielts")
    .neq("status", "archived")
    .limit(1);
  if (classError) throw classError;
  return Boolean(
    ieltsClasses?.some((row) => isEligibleIeltsClass(row.program_type, row.status)),
  );
}

/**
 * Whether this user is an enrolled teaching-center student for the B2B IELTS
 * experience. This is intentionally server-only and non-throwing: any transient
 * read/auth problem resolves to false, so gates fail closed instead of exposing
 * course-only surfaces to B2C learners.
 */
export async function isEnrolledStudent(
  userId: string | null | undefined,
  client?: IeltsEnrollmentClient,
): Promise<boolean> {
  if (!userId) return false;

  try {
    const supabase = client ?? (await createTypedServerClient());
    return await hasActiveClassEnrollment(supabase, userId);
  } catch {
    return false;
  }
}

/** The shell must distinguish unavailable enrollment navigation from not enrolled. */
export async function loadIeltsEnrollmentState(userId: string, client?: IeltsEnrollmentClient): Promise<
  { status: "available"; enrolled: boolean } | { status: "unavailable" }
> {
  try {
    return { status: "available", enrolled: await hasActiveClassEnrollment(client ?? await createTypedServerClient(), userId) };
  } catch {
    return { status: "unavailable" };
  }
}
