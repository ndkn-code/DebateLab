import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createTypedServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";

export type IeltsEnrollmentClient = SupabaseClient<Database>;

async function hasActiveClassEnrollment(
  supabase: IeltsEnrollmentClient,
  userId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("class_memberships")
    .select("id")
    .eq("user_id", userId)
    .eq("member_role", "student")
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (error) return false;
  return Boolean(data);
}

async function hasActiveClubEnrollment(
  supabase: IeltsEnrollmentClient,
  userId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("club_memberships")
    .select("id")
    .eq("user_id", userId)
    .eq("role", "student")
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (error) return false;
  return Boolean(data);
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
    const [classEnrollment, clubEnrollment] = await Promise.all([
      hasActiveClassEnrollment(supabase, userId),
      hasActiveClubEnrollment(supabase, userId),
    ]);

    return classEnrollment || clubEnrollment;
  } catch {
    return false;
  }
}
