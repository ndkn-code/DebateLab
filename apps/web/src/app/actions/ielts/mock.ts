"use server";

/**
 * Timed mock-engine server actions (WS-2.1). The mutation surface for the Assess
 * mode. Timing transitions call the SECURITY DEFINER RPCs through the LEARNER's
 * session client (so auth.uid() is the learner and the DB enforces ownership +
 * deadlines); attempt creation and grading use the service-role services.
 * Every external input is validated with `parseInput` at the boundary.
 */
import { parseInput } from "@/lib/api/boundary";
import { createTypedServerClient } from "@/lib/supabase/server";
import type { Json } from "@/types/supabase";
import { buildMockBlueprint } from "@/lib/ielts/mock-blueprint";
import {
  SaveResponseSchema,
  SectionActionSchema,
  StartMockAttemptSchema,
  SubmitAttemptSchema,
} from "@/lib/api/ielts/mock-schema";
import {
  loadAttemptState,
  loadMockStructure,
  getSkillsWithContent,
  type AttemptState,
} from "@/lib/api/ielts/mock-repository";
import {
  createAttemptWithSections,
  markAttemptSubmitted,
} from "@/lib/api/ielts/attempt-lifecycle";
import { gradeAttemptObjective } from "@/lib/api/ielts/grade-attempt";
import type { AttemptGrade } from "@/lib/scoring/ielts/grade-objective";

type SessionClient = Awaited<ReturnType<typeof createTypedServerClient>>;

async function requireSession(): Promise<{ supabase: SessionClient; userId: string }> {
  const supabase = await createTypedServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, userId: user.id };
}

/** Load the caller's own attempt state, or throw if they don't own it (RLS). */
async function ownAttemptState(attemptId: string): Promise<AttemptState> {
  const state = await loadAttemptState(attemptId);
  if (!state) throw new Error("Attempt not found");
  return state;
}

/** Begin a sitting of a test: build the timed-section blueprint and persist it. */
export async function startMockAttempt(raw: unknown): Promise<AttemptState> {
  const input = parseInput(StartMockAttemptSchema, raw);
  const { userId } = await requireSession();

  const structure = await loadMockStructure(input.testId);
  if (!structure) throw new Error("Test not available");

  const skillsWithContent = await getSkillsWithContent(input.testId);
  const blueprint = buildMockBlueprint({
    kind: structure.test.kind,
    skill: structure.test.skill,
    skillsWithContent,
  });
  if (blueprint.length === 0) throw new Error("Test has no sittable content");

  const { attempt } = await createAttemptWithSections({
    userId,
    test: { id: structure.test.id, module: structure.test.module },
    blueprint,
  });
  return ownAttemptState(attempt.id);
}

/** Re-read the caller's own attempt state (used to re-sync after expiry). */
export async function getAttemptState(raw: unknown): Promise<AttemptState> {
  const input = parseInput(SubmitAttemptSchema, raw);
  await requireSession();
  return ownAttemptState(input.attemptId);
}

/** Enter (start the server clock for) a section. Idempotent: resume-safe. */
export async function enterSection(raw: unknown): Promise<AttemptState> {
  const input = parseInput(SectionActionSchema, raw);
  const { supabase } = await requireSession();
  const { error } = await supabase.rpc("ielts_start_attempt_section", {
    p_section_id: input.sectionId,
  });
  if (error) throw new Error(error.message);
  return ownAttemptState(input.attemptId);
}

/** Pause the section clock (freeze remaining time). */
export async function pauseSection(raw: unknown): Promise<AttemptState> {
  const input = parseInput(SectionActionSchema, raw);
  const { supabase } = await requireSession();
  const { error } = await supabase.rpc("ielts_pause_attempt_section", {
    p_section_id: input.sectionId,
  });
  if (error) throw new Error(error.message);
  return ownAttemptState(input.attemptId);
}

/** Resume a paused section (deadline pushed out by the frozen duration). */
export async function resumeSection(raw: unknown): Promise<AttemptState> {
  const input = parseInput(SectionActionSchema, raw);
  const { supabase } = await requireSession();
  const { error } = await supabase.rpc("ielts_resume_attempt_section", {
    p_section_id: input.sectionId,
  });
  if (error) throw new Error(error.message);
  return ownAttemptState(input.attemptId);
}

/** Persist (upsert) one objective answer — DB rejects writes past the deadline. */
export async function saveResponse(raw: unknown): Promise<{ responseId: string }> {
  const input = parseInput(SaveResponseSchema, raw);
  const { supabase } = await requireSession();
  const { data, error } = await supabase.rpc("ielts_record_question_response", {
    p_section_id: input.sectionId,
    p_question_id: input.questionId,
    p_response: (input.response ?? {}) as Json,
  });
  if (error) throw new Error(error.message);
  return { responseId: data as string };
}

/** Submit (lock) a section. */
export async function submitSection(raw: unknown): Promise<AttemptState> {
  const input = parseInput(SectionActionSchema, raw);
  const { supabase } = await requireSession();
  const { error } = await supabase.rpc("ielts_submit_attempt_section", {
    p_section_id: input.sectionId,
  });
  if (error) throw new Error(error.message);
  return ownAttemptState(input.attemptId);
}

export interface MockSubmitResult {
  grade: AttemptGrade;
  state: AttemptState;
}

/**
 * Finalize the whole attempt: mark submitted, then grade objective (R/L)
 * responses → band. Ownership is enforced by loading the attempt under the
 * caller's RLS before the service-role grader runs.
 */
export async function submitMockAttempt(raw: unknown): Promise<MockSubmitResult> {
  const input = parseInput(SubmitAttemptSchema, raw);
  await requireSession();
  await ownAttemptState(input.attemptId); // RLS ownership gate before service-role write

  await markAttemptSubmitted(input.attemptId);
  const grade = await gradeAttemptObjective(input.attemptId);
  return { grade, state: await ownAttemptState(input.attemptId) };
}
