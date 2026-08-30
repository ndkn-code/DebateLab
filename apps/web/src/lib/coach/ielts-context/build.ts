import {
  IELTS_COACH_CONTEXT_VERSION,
  type IeltsCoachAccessScope,
  type IeltsCoachAssignedWork,
  type IeltsCoachAssignedWorkSource,
  type IeltsCoachAttemptEvidence,
  type IeltsCoachAttemptSource,
  type IeltsCoachContextRequest,
  type IeltsCoachContextResult,
  type IeltsCoachCriterionSignal,
  type IeltsCoachEvidenceRepository,
  type IeltsCoachGoalSource,
  type IeltsCoachPublishedFeedbackSource,
  type IeltsCoachScoreAuthority,
  type IeltsCoachTeacherFeedback,
  type IeltsCoachWeaknessEvidence,
} from "./types";

const DEFAULT_ATTEMPT_LIMIT = 12;
const MAX_ATTEMPT_LIMIT = 24;
const MAX_TEXT_LENGTH = 1_000;
const IELTS_SKILLS = new Set(["listening", "reading", "writing", "speaking"]);

function isNonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isBand(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 9 &&
    value * 2 === Math.trunc(value * 2)
  );
}

function isIeltsSkill(
  value: unknown,
): value is IeltsCoachAttemptSource["skill"] {
  return typeof value === "string" && IELTS_SKILLS.has(value);
}

function scoreAuthority(
  value: unknown,
): Exclude<IeltsCoachScoreAuthority, "teacher_confirmed"> {
  return value === "objective" ? "objective" : "ai_provisional";
}

function confidence(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(1, value))
    : null;
}

function safeText(value: string | null | undefined): string | null {
  if (!value) return null;
  const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, " ").trim();
  return cleaned ? cleaned.slice(0, MAX_TEXT_LENGTH) : null;
}

function newestFirst(a: { occurredAt: string }, b: { occurredAt: string }) {
  return Date.parse(b.occurredAt) - Date.parse(a.occurredAt);
}

function sameResponse(
  attempt: IeltsCoachAttemptSource,
  feedback: IeltsCoachPublishedFeedbackSource,
): boolean {
  return (
    feedback.attemptId === attempt.attemptId &&
    feedback.responseId === attempt.responseId &&
    feedback.responseRevision === attempt.responseRevision &&
    feedback.skill === attempt.skill
  );
}

function usableFeedback(params: {
  row: IeltsCoachPublishedFeedbackSource;
  learnerId: string;
  allowedClassIds: Set<string>;
  attempt: IeltsCoachAttemptSource | undefined;
}): boolean {
  const { row, learnerId, allowedClassIds, attempt } = params;
  return (
    row.userId === learnerId &&
    row.status === "published" &&
    isNonEmpty(row.publishedAt) &&
    allowedClassIds.has(row.classId) &&
    Boolean(attempt && sameResponse(attempt, row))
  );
}

function responseEvidenceKey(value: {
  attemptId: string;
  responseId?: string | null;
  skill: string;
}) {
  return `${value.attemptId}:${value.responseId ?? "none"}:${value.skill}`;
}

function attemptEvidenceId(attempt: IeltsCoachAttemptSource) {
  return attempt.responseId
    ? `ielts-response:${attempt.responseId}:r${attempt.responseRevision ?? 0}`
    : `ielts-attempt:${attempt.attemptId}:${attempt.skill}`;
}

function latestFeedbackByResponse(
  attempts: IeltsCoachAttemptSource[],
  feedbackRows: IeltsCoachPublishedFeedbackSource[],
  learnerId: string,
  allowedClassIds: Set<string>,
): Map<string, IeltsCoachPublishedFeedbackSource> {
  const attemptByResponse = new Map(
    attempts.map((row) => [responseEvidenceKey(row), row]),
  );
  const result = new Map<string, IeltsCoachPublishedFeedbackSource>();
  for (const row of feedbackRows) {
    const attempt = attemptByResponse.get(
      responseEvidenceKey({
        attemptId: row.attemptId,
        responseId: row.responseId,
        skill: row.skill,
      }),
    );
    if (!usableFeedback({ row, learnerId, allowedClassIds, attempt })) continue;
    const key = responseEvidenceKey({
      attemptId: row.attemptId,
      responseId: row.responseId,
      skill: row.skill,
    });
    const existing = result.get(key);
    if (
      !existing ||
      Date.parse(row.publishedAt!) > Date.parse(existing.publishedAt!)
    ) {
      result.set(key, row);
    }
  }
  return result;
}

function projectCriteria(
  attempt: IeltsCoachAttemptSource,
  feedback: IeltsCoachPublishedFeedbackSource | undefined,
): IeltsCoachCriterionSignal[] {
  const teacherByCriterion = new Map(
    (feedback?.criteria ?? [])
      .map((item) => [safeText(item.criterion), item.band] as const)
      .filter(
        (item): item is readonly [string, number] =>
          item[0] !== null && isBand(item[1]),
      ),
  );
  const aiByCriterion = new Map(
    attempt.criteria
      .map((item) => [safeText(item.criterion), item] as const)
      .filter(
        (
          item,
        ): item is readonly [
          string,
          IeltsCoachAttemptSource["criteria"][number],
        ] => item[0] !== null && isBand(item[1].band),
      ),
  );
  const criteria = new Set([
    ...aiByCriterion.keys(),
    ...teacherByCriterion.keys(),
  ]);
  return [...criteria].map((criterion) => {
    const teacherBand = teacherByCriterion.get(criterion);
    const original = aiByCriterion.get(criterion);
    const authority: IeltsCoachScoreAuthority =
      teacherBand === undefined
        ? scoreAuthority(original?.authority)
        : "teacher_confirmed";
    return {
      criterion,
      band: teacherBand ?? original!.band,
      authority,
      confidence:
        authority === "teacher_confirmed"
          ? null
          : confidence(original?.confidence),
      gradingVersion:
        authority === "teacher_confirmed"
          ? null
          : safeText(original?.gradingVersion),
      rubricVersion:
        authority === "teacher_confirmed"
          ? null
          : safeText(original?.rubricVersion),
      evidenceId:
        authority === "teacher_confirmed"
          ? `teacher-review:${feedback!.reviewId}:${criterion}`
          : `${attemptEvidenceId(attempt)}:${criterion}`,
    };
  });
}

function projectAttempt(
  attempt: IeltsCoachAttemptSource,
  feedback: IeltsCoachPublishedFeedbackSource | undefined,
): IeltsCoachAttemptEvidence {
  const teacherBand = feedback?.skillBand;
  const hasTeacherBand = isBand(teacherBand);
  return {
    attemptId: attempt.attemptId,
    responseId: attempt.responseId ?? null,
    responseRevision: attempt.responseRevision ?? null,
    occurredAt: attempt.occurredAt,
    skill: attempt.skill,
    questionType: safeText(attempt.questionType),
    band: hasTeacherBand
      ? teacherBand
      : isBand(attempt.band)
        ? attempt.band
        : null,
    authority: hasTeacherBand
      ? "teacher_confirmed"
      : scoreAuthority(attempt.authority),
    confidence: hasTeacherBand ? null : confidence(attempt.confidence),
    gradingVersion: hasTeacherBand
      ? null
      : safeText(attempt.gradingVersion),
    rubricVersion: hasTeacherBand ? null : safeText(attempt.rubricVersion),
    teacherReviewId: hasTeacherBand ? feedback!.reviewId : null,
    teacherResponseRevision: hasTeacherBand
      ? feedback!.responseRevision
      : null,
    criteria: projectCriteria(attempt, feedback),
  };
}

function targetFor(
  goal: Pick<
    IeltsCoachGoalSource,
    "targetOverallBand" | "targetSkillBands" | "targetTestDate"
  > | null,
  skill: IeltsCoachAttemptSource["skill"],
): number | null {
  if (!goal) return null;
  const skillTarget = goal.targetSkillBands?.[skill];
  return isBand(skillTarget)
    ? skillTarget
    : isBand(goal.targetOverallBand)
      ? goal.targetOverallBand
      : null;
}

function projectGoal(goal: IeltsCoachGoalSource | null) {
  if (!goal || !isBand(goal.targetOverallBand)) return null;
  const targetSkillBands = Object.fromEntries(
    Object.entries(goal.targetSkillBands ?? {}).filter(
      ([skill, band]) => isIeltsSkill(skill) && isBand(band),
    ),
  );
  return {
    targetOverallBand: goal.targetOverallBand,
    targetSkillBands,
    targetTestDate: goal.targetTestDate,
  };
}

function buildWeaknesses(
  attempts: IeltsCoachAttemptEvidence[],
  goal: Pick<
    IeltsCoachGoalSource,
    "targetOverallBand" | "targetSkillBands" | "targetTestDate"
  > | null,
): IeltsCoachWeaknessEvidence[] {
  const seen = new Set<string>();
  const weaknesses: IeltsCoachWeaknessEvidence[] = [];
  for (const attempt of attempts) {
    const target = targetFor(goal, attempt.skill);
    if (target === null) continue;
    const signals = attempt.criteria.length
      ? attempt.criteria.map((criterion) => ({
          criterion: criterion.criterion,
          band: criterion.band,
          authority: criterion.authority,
          evidenceId: criterion.evidenceId,
        }))
      : attempt.band !== null
        ? [
            {
              criterion: null,
              band: attempt.band,
              authority: attempt.authority,
              evidenceId: `${
                attempt.responseId
                  ? `ielts-response:${attempt.responseId}:r${attempt.responseRevision ?? 0}`
                  : `ielts-attempt:${attempt.attemptId}:${attempt.skill}`
              }:overall`,
            },
          ]
        : [];
    for (const signal of signals) {
      const objectiveQuestionType =
        attempt.skill === "listening" || attempt.skill === "reading"
          ? attempt.questionType
          : null;
      const key = `${attempt.skill}:${objectiveQuestionType ?? signal.criterion ?? "overall"}`;
      if (seen.has(key) || signal.band >= target) continue;
      seen.add(key);
      weaknesses.push({
        key,
        skill: attempt.skill,
        criterion: signal.criterion,
        questionType: objectiveQuestionType ??
          (signal.criterion ? null : attempt.questionType),
        currentBand: signal.band,
        targetBand: target,
        gapBands: target - signal.band,
        authority: signal.authority,
        evidenceId: signal.evidenceId,
      });
    }
  }
  return weaknesses.sort(
    (a, b) => b.gapBands - a.gapBands || a.key.localeCompare(b.key),
  );
}

function projectAssignments(params: {
  rows: IeltsCoachAssignedWorkSource[];
  learnerId: string;
  allowedClassIds: Set<string>;
}): IeltsCoachAssignedWork[] {
  const seen = new Set<string>();
  const result: IeltsCoachAssignedWork[] = [];
  for (const row of params.rows) {
    if (
      row.status !== "active" ||
      row.subject !== "ielts" ||
      row.publicationStatus !== "published" ||
      !isIeltsSkill(row.skill) ||
      !params.allowedClassIds.has(row.classId) ||
      (row.assignedLearnerId !== null &&
        row.assignedLearnerId !== undefined &&
        row.assignedLearnerId !== params.learnerId) ||
      !isNonEmpty(row.assignmentId) ||
      seen.has(row.assignmentId)
    ) {
      continue;
    }
    seen.add(row.assignmentId);
    result.push({
      assignmentId: row.assignmentId,
      title: safeText(row.title) ?? "IELTS assignment",
      skill: row.skill,
      criterion: safeText(row.criterion),
      questionType: safeText(row.questionType),
      dueAt: row.dueAt,
      estimatedMinutes:
        typeof row.estimatedMinutes === "number" && row.estimatedMinutes > 0
          ? Math.round(row.estimatedMinutes)
          : null,
      action: {
        type: "start_ielts_assignment",
        assignmentId: row.assignmentId,
      },
    });
  }
  return result;
}

function validateRequest(
  request: IeltsCoachContextRequest,
): IeltsCoachContextResult | null {
  if (
    request.product !== "ielts" ||
    request.subject !== "ielts" ||
    !isNonEmpty(request.conversationId) ||
    (request.locale !== "en" && request.locale !== "vi")
  ) {
    return { ok: false, reason: "ambiguous_context", retryable: false };
  }
  if (
    !isNonEmpty(request.learnerId) ||
    request.learnerId !== request.sessionUserId
  ) {
    return { ok: false, reason: "learner_mismatch", retryable: false };
  }
  return null;
}

function validateScope(
  request: IeltsCoachContextRequest,
  scope: IeltsCoachAccessScope,
): IeltsCoachContextResult | null {
  if (scope.learnerId !== request.learnerId) {
    return { ok: false, reason: "learner_mismatch", retryable: false };
  }
  if (request.classId && !scope.activeIeltsClassIds.includes(request.classId)) {
    return { ok: false, reason: "unauthorized_class", retryable: false };
  }
  return null;
}

/**
 * Loads one all-or-nothing IELTS context snapshot. Evidence read failures do
 * not degrade into generic or Debate context; callers receive a retryable,
 * non-content-bearing failure instead.
 */
export async function loadIeltsCoachContext(params: {
  request: IeltsCoachContextRequest;
  repository: IeltsCoachEvidenceRepository;
}): Promise<IeltsCoachContextResult> {
  const invalid = validateRequest(params.request);
  if (invalid) return invalid;

  try {
    const scope = await params.repository.loadAccessScope(
      params.request.learnerId,
    );
    const invalidScope = validateScope(params.request, scope);
    if (invalidScope) return invalidScope;

    const allowedClassIds = new Set(scope.activeIeltsClassIds);
    const limit = Math.max(
      1,
      Math.min(
        MAX_ATTEMPT_LIMIT,
        Math.trunc(params.request.maxRecentAttempts ?? DEFAULT_ATTEMPT_LIMIT),
      ),
    );
    const [goalSource, attemptSources, assignmentSources] = await Promise.all([
      params.repository.loadGoal(params.request.learnerId),
      params.repository.loadRecentAttempts(params.request.learnerId, limit),
      params.repository.loadAssignedWork(
        params.request.learnerId,
        scope.activeIeltsClassIds,
      ),
    ]);
    const goal =
      goalSource?.userId === params.request.learnerId ? goalSource : null;
    const ownedAttempts = attemptSources
      .filter(
        (row) =>
          row.userId === params.request.learnerId &&
          isNonEmpty(row.attemptId) &&
          isNonEmpty(row.occurredAt) &&
          Number.isFinite(Date.parse(row.occurredAt)) &&
          isIeltsSkill(row.skill),
      )
      .sort(newestFirst)
      .slice(0, limit);
    const feedbackSources =
      await params.repository.loadPublishedTeacherFeedback(
        params.request.learnerId,
        ownedAttempts.map((row) => row.attemptId),
      );
    const feedbackByResponse = latestFeedbackByResponse(
      ownedAttempts,
      feedbackSources,
      params.request.learnerId,
      allowedClassIds,
    );
    const safeGoal = projectGoal(goal);
    const recentAttempts = ownedAttempts.map((row) =>
      projectAttempt(row, feedbackByResponse.get(responseEvidenceKey(row))),
    );
    const teacherPublishedFeedback: IeltsCoachTeacherFeedback[] = [
      ...feedbackByResponse.values(),
    ].map((row) => ({
      reviewId: row.reviewId,
      attemptId: row.attemptId,
      skill: row.skill,
      responseRevision: row.responseRevision,
      publishedAt: row.publishedAt!,
      summary: safeText(row.summary),
      criterionFeedback: row.criteria.flatMap((criterion) => {
        const rationale = safeText(criterion.rationale);
        const name = safeText(criterion.criterion);
        return rationale && name ? [{ criterion: name, rationale }] : [];
      }),
    }));
    const assignedWork = projectAssignments({
      rows: assignmentSources,
      learnerId: params.request.learnerId,
      allowedClassIds,
    });
    const limitations: string[] = [];
    if (!safeGoal) limitations.push("target_not_available");
    if (recentAttempts.length === 0)
      limitations.push("recent_attempts_not_available");
    if (teacherPublishedFeedback.length === 0) {
      limitations.push("teacher_confirmed_feedback_not_available");
    }

    return {
      ok: true,
      context: {
        version: IELTS_COACH_CONTEXT_VERSION,
        product: "ielts",
        subject: "ielts",
        learnerId: params.request.learnerId,
        conversationId: params.request.conversationId,
        locale: params.request.locale,
        classId: params.request.classId ?? null,
        goal: safeGoal,
        recentAttempts,
        weaknesses: buildWeaknesses(recentAttempts, safeGoal),
        teacherPublishedFeedback,
        assignedWork,
        limitations,
      },
    };
  } catch {
    return { ok: false, reason: "evidence_unavailable", retryable: true };
  }
}
