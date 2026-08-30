"use server";

/**
 * IELTS class-assignment server actions (WS-5.3). Teacher mutations (assign /
 * archive) are gated by class-specific manager access; the learner start action resolves
 * + authorizes the assignment, then stamps the new attempt with its club / class
 * / assignment ids. Every external input is validated with `parseInput`.
 */
import { revalidatePath } from "next/cache";
import { parseInput } from "@/lib/api/boundary";
import { createTypedServerClient } from "@/lib/supabase/server";
import { IELTS_ASSESSMENT_MODES_V1, IELTS_ENABLED } from "@/lib/features";
import { requireClassManager } from "@/lib/api/class-manager-access";
import { buildMockBlueprint } from "@/lib/ielts/mock-blueprint";
import {
  ArchiveIeltsAssignmentSchema,
  AssignIeltsMockSchema,
  StartAssignedAttemptSchema,
} from "@/lib/api/ielts/assignments-schema";
import {
  archiveIeltsMockAssignment,
  createIeltsMockAssignment,
} from "@/lib/api/ielts/assignments-repository";
import { resolveAssignmentForStart } from "@/lib/api/ielts/learner-assignments-repository";
import { createAttemptWithSections } from "@/lib/api/ielts/attempt-lifecycle";
import {
  getSkillsWithContent,
  loadAttemptState,
  loadMockStructure,
  type AttemptState,
} from "@/lib/api/ielts/mock-repository";

/** Teacher: assign a published mock to a class in their club. */
export async function assignIeltsMockToClass(raw: unknown): Promise<{ assignmentId: string }> {
  const input = parseInput(AssignIeltsMockSchema, raw);
  const supabase = await createTypedServerClient();
  const manager = await requireClassManager(supabase, input.classId);
  if (manager.clubId !== input.clubId) throw new Error("That class is not part of this club");

  const created = await createIeltsMockAssignment(
    {
      clubId: input.clubId,
      classId: input.classId,
      testId: input.testId,
      dueAt: input.dueAt ?? null,
      title: input.title ?? null,
      createdBy: manager.userId,
    },
    supabase,
  );

  revalidatePath(`/dashboard/clubs/${input.clubId}/ielts`);
  return { assignmentId: created.id };
}

/** Teacher: retire an assignment so it no longer surfaces to learners. */
export async function archiveIeltsAssignment(raw: unknown): Promise<void> {
  const input = parseInput(ArchiveIeltsAssignmentSchema, raw);
  const supabase = await createTypedServerClient();
  const { data: assignment, error: assignmentError } = await supabase
    .from("club_assignments")
    .select("class_id, club_id")
    .eq("id", input.assignmentId)
    .eq("club_id", input.clubId)
    .eq("assignment_type", "ielts_mock")
    .maybeSingle();
  if (assignmentError) throw new Error(assignmentError.message);
  if (!assignment?.class_id) throw new Error("Assignment not found");
  await requireClassManager(supabase, assignment.class_id);

  await archiveIeltsMockAssignment(input.clubId, input.assignmentId, supabase);

  revalidatePath(`/dashboard/clubs/${input.clubId}/ielts`);
  revalidatePath(`/dashboard/clubs/${input.clubId}/ielts/${input.assignmentId}`);
}

/**
 * Learner: begin a sitting of an assigned mock. The test is taken from the
 * assignment (not the caller), so a forged test id cannot be substituted, and
 * the attempt is stamped with the club / class / assignment for the teacher view.
 */
export async function startAssignedMockAttempt(raw: unknown): Promise<AttemptState> {
  if (!IELTS_ENABLED || !IELTS_ASSESSMENT_MODES_V1) {
    throw new Error("IELTS assessment is not available.");
  }
  const input = parseInput(StartAssignedAttemptSchema, raw);
  const resolved = await resolveAssignmentForStart(input.assignmentId);

  const structure = await loadMockStructure(resolved.testId);
  if (!structure) throw new Error("Test not available");

  const skillsWithContent = await getSkillsWithContent(resolved.testId);
  const blueprint = buildMockBlueprint({
    kind: structure.test.kind,
    skill: structure.test.skill,
    skillsWithContent,
  });
  if (blueprint.length === 0) throw new Error("Test has no sittable content");

  const { attempt } = await createAttemptWithSections({
    userId: resolved.userId,
    test: { id: structure.test.id, module: structure.test.module },
    blueprint,
    org: {
      clubId: resolved.clubId,
      classId: resolved.classId,
      assignmentId: input.assignmentId,
    },
  });

  const state = await loadAttemptState(attempt.id);
  if (!state) throw new Error("Attempt not found");
  return state;
}
