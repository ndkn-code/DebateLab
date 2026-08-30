import "server-only";

import type { KnowledgeResult } from "./contracts";
import type {
  DebatePatternsToolRequest,
  DebateRebuttalToolRequest,
  IeltsBandExamplesToolRequest,
  IeltsRubricToolRequest,
  LearnerHistoryKnowledgeRequest,
  StudentSkillHistoryToolRequest,
} from "./contracts";
import { searchGenericKnowledge } from "./runtime";
import { searchKnowledge } from "./service";

function rubricFallback(params: IeltsRubricToolRequest) {
  return searchKnowledge({
    collection: "ielts_rubric",
    purpose: params.purpose,
    language: params.language,
    sourceRoute: params.sourceRoute,
    rubricKey:
      params.rubricKey ??
      (params.skill === "writing" ? "ielts_writing_v1" : "ielts_speaking_v1"),
    rubricVersion: params.rubricVersion ?? 1,
    userId: params.userId,
    deadlineMs: params.deadlineMs,
    limit: params.limit,
    supabase: params.supabase,
  });
}

/** Retrieves the published IELTS rubric, with a local bundle fallback during rollout. */
export async function getIeltsRubric(
  params: IeltsRubricToolRequest,
): Promise<KnowledgeResult> {
  const skill =
    params.skill ??
    (params.rubricKey?.includes("writing") ? "writing" : "speaking");
  const collection = skill === "writing" ? "ielts.writing" : "ielts.speaking";
  const generic = await searchGenericKnowledge({
    collection,
    query:
      params.query ??
      params.rubricKey ??
      `IELTS ${skill} public band descriptors`,
    purpose: params.purpose,
    language: params.language,
    sourceRoute: params.sourceRoute,
    userId: params.userId,
    skill,
    criteria: params.criterion ? [params.criterion] : undefined,
    limit: params.limit,
    deadlineMs: params.deadlineMs,
    supabase: params.supabase,
  });
  if (generic.evidence.length > 0)
    return { ...generic, collection: "ielts_rubric" };
  return rubricFallback(params);
}

/** Retrieves criterion- and band-specific public exemplars for staged IELTS scoring. */
export async function findIeltsBandExamples(
  params: IeltsBandExamplesToolRequest,
): Promise<KnowledgeResult> {
  const collection =
    params.skill === "writing" ? "ielts.writing" : "ielts.speaking";
  const generic = await searchGenericKnowledge({
    collection,
    query: params.query,
    purpose: params.purpose,
    language: params.language,
    sourceRoute: params.sourceRoute,
    userId: params.userId,
    skill: params.skill,
    taskType: params.taskType,
    criteria: params.criteria,
    targetBands: params.targetBands,
    limit: params.limit,
    deadlineMs: params.deadlineMs,
    supabase: params.supabase,
  });
  if (
    generic.evidence.length > 0 ||
    !params.questionId ||
    !params.questionType
  ) {
    return { ...generic, collection: "ielts_exemplar" };
  }
  return searchKnowledge({
    collection: "ielts_exemplar",
    purpose: params.purpose,
    language: params.language,
    sourceRoute: params.sourceRoute,
    userId: params.userId,
    questionId: params.questionId,
    skill: params.skill,
    questionType: params.questionType,
    limit: params.limit,
    deadlineMs: params.deadlineMs,
    supabase: params.supabase,
  });
}

async function debateTool(
  params: DebatePatternsToolRequest | DebateRebuttalToolRequest,
  query: string,
) {
  const language = params.language ?? "en";
  const generic = await searchGenericKnowledge({
    collection:
      language === "vi" ? "debate.vi.truong_teen" : "debate.en.competitive",
    query,
    purpose: params.purpose,
    language,
    sourceRoute: params.sourceRoute,
    userId: params.userId,
    format: params.format,
    motion: params.motion,
    side: params.side,
    limit: params.limit,
    deadlineMs: params.deadlineMs,
    supabase: params.supabase,
  });
  return { ...generic, collection: "debate" as const };
}

export function findDebateArgumentPatterns(
  params: DebatePatternsToolRequest,
): Promise<KnowledgeResult> {
  return debateTool(params, params.query);
}

export function findRebuttalAndWeighingExamples(
  params: DebateRebuttalToolRequest,
): Promise<KnowledgeResult> {
  return debateTool(
    params,
    [
      params.query,
      params.targetArgument ? `Target argument: ${params.targetArgument}` : "",
      "Find rebuttal, clash, concession, and weighing examples.",
    ]
      .filter(Boolean)
      .join("\n"),
  );
}

export function getStudentSkillHistory(
  params: StudentSkillHistoryToolRequest,
): Promise<KnowledgeResult> {
  const request: LearnerHistoryKnowledgeRequest = {
    collection: "learner_history",
    purpose: params.purpose,
    language: params.language,
    sourceRoute: params.sourceRoute,
    userId: params.userId,
    query: params.query,
    contextType: params.contextType,
    contextId: params.contextId,
    deadlineMs: params.deadlineMs,
    limit: params.limit,
    supabase: params.supabase,
  };
  return searchKnowledge(request);
}
