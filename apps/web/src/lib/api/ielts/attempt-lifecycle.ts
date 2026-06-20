/**
 * Server-authoritative attempt creation + status transitions (WS-2.1).
 *
 * Learners have SELECT-own RLS but NO insert/update policy on attempt tables —
 * every write here is the service-role client, exactly the duel-server-clock
 * security model. Attempt CREATION is not timing-critical (no section clock runs
 * until the learner enters a section via the SECURITY DEFINER RPC), so it lives
 * in TS; the per-section clocks are owned by the DB.
 */
import "server-only";
import { createTypedAdminClient } from "@/lib/supabase/admin";
import type { Tables } from "@/types/supabase";
import type { SectionBlueprint } from "@/lib/ielts/mock-blueprint";

export interface CreatedAttempt {
  attempt: Tables<"ielts_attempts">;
  sections: Tables<"ielts_attempt_sections">[];
}

/**
 * Optional Club OS context stamped on an attempt when it is started from a
 * teacher assignment (WS-5.3). Omitted for self-serve sittings (all null).
 */
export interface AttemptOrgContext {
  clubId: string | null;
  classId: string | null;
  assignmentId: string | null;
}

/** Create an attempt and its timed sections from a blueprint (service-role). */
export async function createAttemptWithSections(params: {
  userId: string;
  test: Pick<Tables<"ielts_tests">, "id" | "module">;
  blueprint: SectionBlueprint[];
  org?: AttemptOrgContext;
}): Promise<CreatedAttempt> {
  const admin = createTypedAdminClient();
  const { userId, test, blueprint, org } = params;

  const { count } = await admin
    .from("ielts_attempts")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("test_id", test.id);

  const { data: attempt, error } = await admin
    .from("ielts_attempts")
    .insert({
      user_id: userId,
      test_id: test.id,
      module: test.module,
      status: "in_progress",
      attempt_number: (count ?? 0) + 1,
      club_id: org?.clubId ?? null,
      class_id: org?.classId ?? null,
      assignment_id: org?.assignmentId ?? null,
    })
    .select()
    .single();
  if (error) throw new Error(`createAttempt: ${error.message}`);

  if (blueprint.length === 0) {
    return { attempt, sections: [] };
  }

  const { data: sections, error: sectionError } = await admin
    .from("ielts_attempt_sections")
    .insert(
      blueprint.map((section) => ({
        attempt_id: attempt.id,
        user_id: userId,
        skill: section.skill,
        section_order: section.sectionOrder,
        label: section.label,
        time_limit_seconds: section.timeLimitSeconds,
      })),
    )
    .select();
  if (sectionError) throw new Error(`createAttemptSections: ${sectionError.message}`);

  return { attempt, sections: (sections ?? []).sort((a, b) => a.section_order - b.section_order) };
}

/** Mark an attempt submitted (idempotent-friendly; service-role). */
export async function markAttemptSubmitted(attemptId: string): Promise<void> {
  const admin = createTypedAdminClient();
  const nowIso = new Date().toISOString();
  const { error } = await admin
    .from("ielts_attempts")
    .update({ status: "submitted", submitted_at: nowIso, updated_at: nowIso })
    .eq("id", attemptId)
    .eq("status", "in_progress");
  if (error) throw new Error(`markAttemptSubmitted: ${error.message}`);
}
