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
import type { Json, Tables } from "@/types/supabase";
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

  if (blueprint.length === 0) throw new Error("createAttempt: empty blueprint");
  const { data: attemptId, error: createError } = await admin.rpc(
    "ielts_create_attempt_with_blueprint",
    {
      p_user_id: userId,
      p_test_id: test.id,
      p_module: test.module,
      p_attempt_number: (count ?? 0) + 1,
      p_sections: blueprint.map((section) => ({
        skill: section.skill,
        section_order: section.sectionOrder,
        label: section.label,
        time_limit_seconds: section.timeLimitSeconds,
      })) as unknown as Json,
      p_club_id: org?.clubId ?? null,
      p_class_id: org?.classId ?? null,
      p_assignment_id: org?.assignmentId ?? null,
    },
  );
  if (createError || !attemptId) {
    throw new Error(`createAttempt: ${createError?.message ?? "no attempt returned"}`);
  }
  const { data: attempt, error: attemptError } = await admin
    .from("ielts_attempts")
    .select()
    .eq("id", attemptId)
    .single();
  if (attemptError) throw new Error(`createAttempt(load): ${attemptError.message}`);
  const { data: sections, error: sectionError } = await admin
    .from("ielts_attempt_sections")
    .select()
    .eq("attempt_id", attemptId)
    .order("section_order");
  if (sectionError) throw new Error(`createAttemptSections(load): ${sectionError.message}`);
  return { attempt, sections: sections ?? [] };
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
