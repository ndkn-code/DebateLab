"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DEV_ADMIN_PROFILE, isDevAdminBypassEnabled } from "@/lib/dev-admin-bypass";
import { validateClubAssignmentInput } from "@/lib/api/admin-clubs-model";
import type { ClubAssignmentInput } from "@/lib/types/admin-clubs";

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function verifyAdmin(supabase: Supabase) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    if (isDevAdminBypassEnabled()) return DEV_ADMIN_PROFILE.id;
    throw new Error("Unauthorized");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    if (isDevAdminBypassEnabled()) return user.id;
    throw new Error("Forbidden");
  }

  return user.id;
}

function cleanString(value: FormDataEntryValue | string | null | undefined) {
  const text = typeof value === "string" ? value.trim() : "";
  return text.length > 0 ? text : null;
}

function isDevClubId(id: string) {
  return isDevAdminBypassEnabled() && id.startsWith("00000000-0000-4c00-8000-");
}

export async function createClub(formData: FormData) {
  const supabase = await createClient();
  const adminId = await verifyAdmin(supabase);
  const name = cleanString(formData.get("name"));
  if (!name) throw new Error("Club name is required");

  if (isDevAdminBypassEnabled()) {
    return "00000000-0000-4c00-8000-000000000002";
  }

  const code = cleanString(formData.get("code")) ?? `CLUB-${Date.now().toString(36).toUpperCase()}`;
  const { data, error } = await supabase
    .from("clubs")
    .insert({
      code,
      name,
      club_type: cleanString(formData.get("clubType")) ?? "school",
      city: cleanString(formData.get("city")),
      country: cleanString(formData.get("country")) ?? "VN",
      timezone: cleanString(formData.get("timezone")) ?? "Asia/Ho_Chi_Minh",
      owner_user_id: adminId,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  await supabase.from("club_memberships").upsert(
    {
      club_id: data.id,
      user_id: adminId,
      role: "owner",
      status: "active",
      invited_by: adminId,
    },
    { onConflict: "club_id,user_id,role" }
  );

  revalidatePath("/dashboard/admin/clubs");
  return data.id as string;
}

export async function createClubAssignment(input: ClubAssignmentInput) {
  const supabase = await createClient();
  const adminId = await verifyAdmin(supabase);
  const validation = validateClubAssignmentInput(input);
  if (!validation.ok) {
    throw new Error(validation.reason);
  }

  if (isDevClubId(input.clubId)) {
    return "00000000-0000-4c20-8000-000000000999";
  }

  const { data, error } = await supabase
    .from("club_assignments")
    .insert({
      club_id: input.clubId,
      class_id: input.classId ?? null,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      assignment_type: input.assignmentType ?? "practice",
      assigned_track: input.assignedTrack ?? "debate",
      topic_title: input.topicTitle?.trim() || null,
      topic_category: input.topicCategory?.trim() || null,
      due_at: input.dueAt ?? null,
      required_attempts: input.requiredAttempts ?? 1,
      rubric_key: input.rubricKey ?? (input.assignedTrack === "speaking" ? "speaking_v1" : "debate_v1"),
      rubric_version: input.rubricVersion ?? 1,
      status: input.status ?? "active",
      created_by: adminId,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/admin/clubs");
  revalidatePath(`/dashboard/admin/clubs/${input.clubId}`);
  return data.id as string;
}

export async function saveCoachReview(input: {
  clubId: string;
  performanceAttemptId: string;
  comment?: string | null;
  visibility?: "coach_only" | "student_visible";
  status?: "open" | "resolved";
  scoreAdjustments?: Record<string, unknown>;
}) {
  const supabase = await createClient();
  const adminId = await verifyAdmin(supabase);
  if (!input.clubId || !input.performanceAttemptId) throw new Error("Club and attempt are required");

  if (isDevClubId(input.clubId)) {
    return "dev-review";
  }

  const { data, error } = await supabase
    .from("coach_reviews")
    .insert({
      club_id: input.clubId,
      performance_attempt_id: input.performanceAttemptId,
      reviewer_id: adminId,
      comment: input.comment?.trim() || null,
      visibility: input.visibility ?? "coach_only",
      status: input.status ?? "open",
      score_adjustments: input.scoreAdjustments ?? {},
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  revalidatePath(`/dashboard/admin/clubs/${input.clubId}`);
  return data.id as string;
}
