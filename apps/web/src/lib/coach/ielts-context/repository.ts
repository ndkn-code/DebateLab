import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Json } from "@/types/supabase";
import type {
  IeltsCoachAssignedWorkSource,
  IeltsCoachAttemptSource,
  IeltsCoachCriterionSignalSource,
  IeltsCoachEvidenceRepository,
  IeltsCoachPreparedContextSource,
  IeltsCoachPublishedFeedbackSource,
} from "./types";

type Db = SupabaseClient<Database>;
type IeltsSkill = Database["public"]["Enums"]["ielts_skill"];

const IELTS_SKILLS = new Set<IeltsSkill>([
  "listening",
  "reading",
  "writing",
  "speaking",
]);

function objectValue(value: Json | null | undefined) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, Json | undefined>)
    : null;
}

function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function skillValue(value: unknown): IeltsSkill | null {
  return typeof value === "string" && IELTS_SKILLS.has(value as IeltsSkill)
    ? (value as IeltsSkill)
    : null;
}

function gradingConfidence(metadata: Json): number | null {
  const object = objectValue(metadata);
  const raw = object?.confidence ?? object?.overallConfidence;
  const numeric = numberValue(raw);
  if (numeric !== null) return numeric;
  const level =
    stringValue(raw) ?? stringValue(objectValue(raw as Json)?.level);
  if (level === "high") return 0.85;
  if (level === "medium") return 0.65;
  if (level === "limited" || level === "low") return 0.35;
  return null;
}

function gradingVersion(metadata: Json): string | null {
  const object = objectValue(metadata);
  return stringValue(object?.gradingVersion ?? object?.grading_version);
}

function criterion(
  name: string,
  band: number | null,
  confidence: number | null,
  gradingVersionValue: string | null,
  rubricVersionValue: string,
): IeltsCoachCriterionSignalSource[] {
  return band === null
    ? []
    : [
        {
          criterion: name,
          band,
          authority: "ai_provisional",
          confidence,
          gradingVersion: gradingVersionValue,
          rubricVersion: rubricVersionValue,
        },
      ];
}

function unique(values: Array<string | null | undefined>) {
  return [
    ...new Set(values.filter((value): value is string => Boolean(value))),
  ];
}

function criterionRationale(value: Json, key: string): string | null {
  return stringValue(objectValue(value)?.[key]);
}

function recordValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function arrayValue(value: unknown): unknown[] | null {
  return Array.isArray(value) ? value : null;
}

function requiredArray(value: unknown, key: string): unknown[] {
  const array = arrayValue(value);
  if (!array) throw new Error(`Invalid IELTS Coach prepared ${key}`);
  return array;
}

function preparedConfidence(metadata: unknown): number | null {
  const object = recordValue(metadata);
  const raw = object?.confidence ?? object?.overallConfidence;
  const numeric = numberValue(raw);
  if (numeric !== null) return numeric;
  const level = stringValue(raw) ?? stringValue(recordValue(raw)?.level);
  if (level === "high") return 0.85;
  if (level === "medium") return 0.65;
  if (level === "limited" || level === "low") return 0.35;
  return null;
}

function preparedGradingVersion(metadata: unknown): string | null {
  const object = recordValue(metadata);
  return stringValue(object?.gradingVersion ?? object?.grading_version);
}

function preparedCriteria(params: {
  skill: "writing" | "speaking";
  row: Record<string, unknown>;
  confidence: number | null;
  gradingVersion: string | null;
}) {
  const rubricVersion =
    params.skill === "writing"
      ? "ielts-writing-rubric-v1"
      : "ielts-speaking-rubric-v1";
  const entries =
    params.skill === "writing"
      ? [
          ["task_response", params.row.taskResponseBand],
          ["coherence_cohesion", params.row.coherenceCohesionBand],
          ["lexical_resource", params.row.lexicalResourceBand],
          ["grammar", params.row.grammarBand],
        ]
      : [
          ["fluency_coherence", params.row.fluencyCoherenceBand],
          ["lexical_resource", params.row.lexicalResourceBand],
          ["grammar", params.row.grammarBand],
          ["pronunciation", params.row.pronunciationBand],
        ];
  return entries.flatMap(([name, rawBand]) => {
    const band = numberValue(rawBand);
    return typeof name === "string" && band !== null
      ? criterion(
          name,
          band,
          params.confidence,
          params.gradingVersion,
          rubricVersion,
        )
      : [];
  });
}

/** Decode the deliberately narrow JSON projection returned by the RPC. */
function preparedContextSource(
  value: unknown,
  learnerId: string,
): IeltsCoachPreparedContextSource {
  const root = recordValue(value);
  if (!root || stringValue(root.learnerId) !== learnerId) {
    throw new Error("Invalid IELTS Coach prepared learner scope");
  }
  const activeIeltsClassIds = requiredArray(
    root.activeIeltsClassIds,
    "active class scope",
  ).map(stringValue);
  if (activeIeltsClassIds.some((id) => id === null)) {
    throw new Error("Invalid IELTS Coach prepared class scope");
  }

  const attemptRows = requiredArray(root.attempts, "attempts")
    .map(recordValue)
    .filter((row): row is Record<string, unknown> => row !== null);
  const occurredAt = new Map(
    attemptRows.flatMap((row) => {
      const id = stringValue(row.attemptId);
      const at = stringValue(row.occurredAt);
      return id && at ? [[id, at] as const] : [];
    }),
  );
  const recentAttempts: IeltsCoachAttemptSource[] = [];

  for (const raw of requiredArray(root.skillStates, "skill states")) {
    const row = recordValue(raw);
    const skill = skillValue(row?.skill);
    const band = numberValue(row?.bandEstimate);
    const id = stringValue(row?.id);
    const userId = stringValue(row?.userId);
    const at = stringValue(row?.occurredAt);
    if (
      !row ||
      !id ||
      !userId ||
      !at ||
      band === null ||
      (skill !== "listening" && skill !== "reading")
    ) {
      continue;
    }
    const confidence = numberValue(row.confidence);
    recentAttempts.push({
      attemptId: id,
      userId,
      occurredAt: at,
      skill,
      questionType:
        stringValue(row.questionType) ?? stringValue(row.subskillKey),
      band,
      authority: "ai_provisional",
      confidence,
      gradingVersion: "ielts-skill-state-v1",
      rubricVersion: "ielts-objective-band-conversion-v1",
      criteria: [
        {
          criterion: skill,
          band,
          authority: "ai_provisional",
          confidence,
          gradingVersion: "ielts-skill-state-v1",
          rubricVersion: "ielts-objective-band-conversion-v1",
        },
      ],
    });
  }

  for (const raw of requiredArray(root.bandScores, "band scores")) {
    const row = recordValue(raw);
    const attemptId = stringValue(row?.attemptId);
    const userId = stringValue(row?.userId);
    const at =
      stringValue(row?.computedAt) ??
      (attemptId ? occurredAt.get(attemptId) : null);
    if (!row || !attemptId || !userId || !at) continue;
    for (const [skill, rawBand] of [
      ["listening", row.listeningBand],
      ["reading", row.readingBand],
    ] as const) {
      const band = numberValue(rawBand);
      if (band === null) continue;
      recentAttempts.push({
        attemptId,
        userId,
        occurredAt: at,
        skill,
        band,
        authority: "objective",
        criteria: [],
      });
    }
  }

  for (const [key, skill] of [
    ["writingResponses", "writing"],
    ["speakingResponses", "speaking"],
  ] as const) {
    for (const raw of requiredArray(root[key], key)) {
      const row = recordValue(raw);
      const attemptId = stringValue(row?.attemptId);
      const responseId = stringValue(row?.id);
      const userId = stringValue(row?.userId);
      const at =
        stringValue(row?.scoredAt) ??
        stringValue(row?.updatedAt) ??
        (attemptId ? occurredAt.get(attemptId) : null);
      if (!row || !attemptId || !responseId || !userId || !at) continue;
      const confidence = preparedConfidence(row.gradingMetadata);
      const version = preparedGradingVersion(row.gradingMetadata);
      const responseRevision = numberValue(row.revision);
      recentAttempts.push({
        attemptId,
        userId,
        responseId,
        responseRevision:
          responseRevision === null ? null : Math.trunc(responseRevision),
        occurredAt: at,
        skill,
        questionType:
          skill === "writing"
            ? `writing_task_${numberValue(row.taskNumber) ?? 2}`
            : numberValue(row.partNumber) !== null
              ? `speaking_part_${numberValue(row.partNumber)}`
              : null,
        band: numberValue(
          skill === "writing" ? row.taskBand : row.speakingBand,
        ),
        authority: "ai_provisional",
        confidence,
        gradingVersion: version,
        rubricVersion:
          skill === "writing"
            ? "ielts-writing-rubric-v1"
            : "ielts-speaking-rubric-v1",
        criteria: preparedCriteria({
          skill,
          row,
          confidence,
          gradingVersion: version,
        }),
      });
    }
  }

  const publishedTeacherFeedback = requiredArray(
    root.publishedTeacherFeedback,
    "teacher feedback",
  ).flatMap((raw): IeltsCoachPublishedFeedbackSource[] => {
    const row = recordValue(raw);
    const reviewKind = stringValue(row?.reviewKind);
    const skill =
      reviewKind === "writing"
        ? "writing"
        : reviewKind === "speaking"
          ? "speaking"
          : null;
    const responseId = stringValue(
      skill === "writing" ? row?.writingResponseId : row?.speakingResponseId,
    );
    const reviewId = stringValue(row?.id);
    const feedbackUserId = stringValue(row?.userId);
    const classId = stringValue(row?.classId);
    const attemptId = stringValue(row?.attemptId);
    const publishedAt = stringValue(row?.publishedAt);
    const revision = numberValue(row?.revision);
    if (
      !row ||
      !skill ||
      !responseId ||
      !reviewId ||
      !feedbackUserId ||
      !classId ||
      !attemptId ||
      !publishedAt ||
      revision === null
    ) {
      return [];
    }
    const feedback = recordValue(row.criterionFeedback);
    const criteria =
      skill === "writing"
        ? [
            ["task_response", row.taskResponseBand, "taskResponse"],
            [
              "coherence_cohesion",
              row.coherenceCohesionBand,
              "coherenceCohesion",
            ],
            ["lexical_resource", row.lexicalResourceBand, "lexicalResource"],
            ["grammar", row.grammarBand, "grammaticalRangeAccuracy"],
          ]
        : [
            ["fluency_coherence", row.fluencyCoherenceBand, "fluencyCoherence"],
            ["lexical_resource", row.lexicalResourceBand, "lexicalResource"],
            ["grammar", row.grammarBand, "grammaticalRangeAccuracy"],
            ["pronunciation", row.pronunciationBand, "pronunciation"],
          ];
    return [
      {
        reviewId,
        userId: feedbackUserId,
        classId,
        attemptId,
        responseId,
        responseRevision: Math.trunc(revision),
        skill,
        status: "published",
        publishedAt,
        skillBand: numberValue(
          skill === "writing" ? row.taskBand : row.skillBand,
        ),
        criteria: criteria.flatMap(([name, rawBand, rationaleKey]) => {
          const band = numberValue(rawBand);
          return typeof name === "string" &&
            band !== null &&
            typeof rationaleKey === "string"
            ? [
                {
                  criterion: name,
                  band,
                  rationale: stringValue(feedback?.[rationaleKey]),
                },
              ]
            : [];
        }),
        summary: null,
      },
    ];
  });

  const assignedWork = requiredArray(root.assignedWork, "assigned work")
    .map(recordValue)
    .flatMap((row): IeltsCoachAssignedWorkSource[] => {
      const assignmentId = stringValue(row?.id);
      const classId = stringValue(row?.classId);
      const title = stringValue(row?.title);
      const metadata = recordValue(row?.metadata);
      const skill = skillValue(
        metadata?.skill ?? row?.assignedTrack ?? row?.topicCategory,
      );
      if (!row || !assignmentId || !classId || !title || !skill) return [];
      return [
        {
          assignmentId,
          classId,
          assignedLearnerId:
            stringValue(metadata?.assignedLearnerId) ??
            stringValue(metadata?.assigned_learner_id),
          subject: "ielts",
          publicationStatus: "published",
          status: "active",
          title,
          skill,
          criterion: stringValue(metadata?.criterion),
          questionType:
            stringValue(metadata?.questionType) ??
            stringValue(metadata?.question_type),
          dueAt: stringValue(row.dueAt),
          estimatedMinutes: numberValue(
            metadata?.estimatedMinutes ?? metadata?.estimated_minutes,
          ),
        },
      ];
    });

  const goalRow = recordValue(root.goal);
  const goal = goalRow
    ? {
        userId: stringValue(goalRow.userId) ?? "",
        targetOverallBand: numberValue(goalRow.targetOverallBand) ?? NaN,
        targetSkillBands: {
          listening: numberValue(goalRow.targetListeningBand) ?? undefined,
          reading: numberValue(goalRow.targetReadingBand) ?? undefined,
          writing: numberValue(goalRow.targetWritingBand) ?? undefined,
          speaking: numberValue(goalRow.targetSpeakingBand) ?? undefined,
        },
        targetTestDate: stringValue(goalRow.targetTestDate),
      }
    : null;

  return {
    accessScope: {
      learnerId,
      activeIeltsClassIds: activeIeltsClassIds as string[],
    },
    goal,
    recentAttempts,
    publishedTeacherFeedback,
    assignedWork,
  };
}

/**
 * RLS remains the primary boundary; every query also repeats learner, class,
 * publication, and response-revision filters before the pure projector runs.
 * This adapter intentionally never reads question keys, model answers, raw
 * essays/transcripts, draft teacher notes, or another learner's rows.
 */
export function createIeltsCoachEvidenceRepository(
  client: SupabaseClient,
): IeltsCoachEvidenceRepository {
  const db = client as Db;
  const preparedRpc = client as unknown as {
    rpc(
      name: string,
      args: Record<string, unknown>,
    ): Promise<{ data: unknown; error: { message: string } | null }>;
  };

  return {
    async loadPreparedContext(learnerId, limit) {
      const result = await preparedRpc.rpc(
        "load_ielts_coach_prepared_context",
        {
          p_learner_id: learnerId,
          p_max_recent_attempts: limit,
        },
      );
      if (result.error) throw new Error(result.error.message);
      return preparedContextSource(result.data, learnerId);
    },

    async loadAccessScope(learnerId) {
      const memberships = await db
        .from("class_memberships")
        .select("class_id")
        .eq("user_id", learnerId)
        .eq("member_role", "student")
        .eq("status", "active");
      if (memberships.error) throw memberships.error;
      const memberClassIds = unique(
        (memberships.data ?? []).map((row) => row.class_id),
      );
      if (memberClassIds.length === 0) {
        return { learnerId, activeIeltsClassIds: [] };
      }
      const classes = await db
        .from("classes")
        .select("id")
        .in("id", memberClassIds)
        .eq("program_type", "ielts")
        .eq("status", "active");
      if (classes.error) throw classes.error;
      return {
        learnerId,
        activeIeltsClassIds: (classes.data ?? []).map((row) => row.id),
      };
    },

    async loadGoal(learnerId) {
      const result = await db
        .from("ielts_study_plans")
        .select(
          "user_id, target_overall_band, target_listening_band, target_reading_band, target_writing_band, target_speaking_band, target_test_date",
        )
        .eq("user_id", learnerId)
        .eq("status", "active")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (result.error) throw result.error;
      if (!result.data) return null;
      return {
        userId: result.data.user_id,
        targetOverallBand: result.data.target_overall_band,
        targetSkillBands: {
          listening: result.data.target_listening_band ?? undefined,
          reading: result.data.target_reading_band ?? undefined,
          writing: result.data.target_writing_band ?? undefined,
          speaking: result.data.target_speaking_band ?? undefined,
        },
        targetTestDate: result.data.target_test_date,
      };
    },

    async loadRecentAttempts(learnerId, limit) {
      const attemptsResult = await db
        .from("ielts_attempts")
        .select("id, started_at, submitted_at")
        .eq("user_id", learnerId)
        .neq("status", "in_progress")
        .order("started_at", { ascending: false })
        .limit(limit);
      if (attemptsResult.error) throw attemptsResult.error;
      const attempts = attemptsResult.data ?? [];
      const attemptIds = attempts.map((row) => row.id);
      const skillStatesResult = await db
        .from("ielts_skill_states")
        .select(
          "id, user_id, skill, subskill_key, criterion, question_type, band_estimate, confidence, evidence_count, updated_at",
        )
        .eq("user_id", learnerId)
        .in("skill", ["listening", "reading"])
        .gt("evidence_count", 0)
        .not("band_estimate", "is", null)
        .order("updated_at", { ascending: false })
        .limit(12);
      if (skillStatesResult.error) throw skillStatesResult.error;
      const skillStateRows: IeltsCoachAttemptSource[] = (
        skillStatesResult.data ?? []
      ).flatMap((state) => {
        if (
          (state.skill !== "listening" && state.skill !== "reading") ||
          state.band_estimate === null
        ) {
          return [];
        }
        return [
          {
            attemptId: state.id,
            userId: state.user_id,
            occurredAt: state.updated_at,
            skill: state.skill,
            questionType: state.question_type ?? state.subskill_key,
            band: state.band_estimate,
            authority: "ai_provisional" as const,
            confidence: state.confidence,
            gradingVersion: "ielts-skill-state-v1",
            rubricVersion: "ielts-objective-band-conversion-v1",
            criteria: [
              {
                criterion: state.skill,
                band: state.band_estimate,
                authority: "ai_provisional" as const,
                confidence: state.confidence,
                gradingVersion: "ielts-skill-state-v1",
                rubricVersion: "ielts-objective-band-conversion-v1",
              },
            ],
          },
        ];
      });
      if (attemptIds.length === 0) return skillStateRows;

      const [bandsResult, writingResult, speakingResult] = await Promise.all([
        db
          .from("attempt_band_scores")
          .select(
            "attempt_id, user_id, listening_band, reading_band, writing_band, speaking_band, computed_at",
          )
          .eq("user_id", learnerId)
          .in("attempt_id", attemptIds),
        db
          .from("writing_responses")
          .select(
            "id, attempt_id, user_id, revision, task_number, status, task_band, task_response_band, coherence_cohesion_band, lexical_resource_band, grammar_band, grading_metadata, scored_at, updated_at",
          )
          .eq("user_id", learnerId)
          .in("attempt_id", attemptIds)
          .in("status", ["scored", "overridden"]),
        db
          .from("speaking_responses")
          .select(
            "id, attempt_id, user_id, revision, part_number, status, speaking_band, fluency_coherence_band, lexical_resource_band, grammar_band, pronunciation_band, grading_metadata, scored_at, updated_at",
          )
          .eq("user_id", learnerId)
          .in("attempt_id", attemptIds)
          .in("status", ["scored", "overridden"]),
      ]);
      const error =
        bandsResult.error ?? writingResult.error ?? speakingResult.error;
      if (error) throw error;

      const occurredAt = new Map(
        attempts.map((row) => [row.id, row.submitted_at ?? row.started_at]),
      );
      const rows: IeltsCoachAttemptSource[] = [...skillStateRows];
      for (const band of bandsResult.data ?? []) {
        const date = occurredAt.get(band.attempt_id);
        if (!date) continue;
        if (band.listening_band !== null) {
          rows.push({
            attemptId: band.attempt_id,
            userId: band.user_id,
            occurredAt: band.computed_at ?? date,
            skill: "listening",
            band: band.listening_band,
            authority: "objective",
            criteria: [],
          });
        }
        if (band.reading_band !== null) {
          rows.push({
            attemptId: band.attempt_id,
            userId: band.user_id,
            occurredAt: band.computed_at ?? date,
            skill: "reading",
            band: band.reading_band,
            authority: "objective",
            criteria: [],
          });
        }
      }
      for (const response of writingResult.data ?? []) {
        const date = occurredAt.get(response.attempt_id);
        if (!date) continue;
        const confidence = gradingConfidence(response.grading_metadata);
        const version = gradingVersion(response.grading_metadata);
        rows.push({
          attemptId: response.attempt_id,
          userId: response.user_id,
          responseId: response.id,
          responseRevision: response.revision,
          occurredAt: response.scored_at ?? response.updated_at ?? date,
          skill: "writing",
          questionType: `writing_task_${response.task_number}`,
          band: response.task_band,
          authority: "ai_provisional",
          confidence,
          gradingVersion: version,
          rubricVersion: "ielts-writing-rubric-v1",
          criteria: [
            ...criterion(
              "task_response",
              response.task_response_band,
              confidence,
              version,
              "ielts-writing-rubric-v1",
            ),
            ...criterion(
              "coherence_cohesion",
              response.coherence_cohesion_band,
              confidence,
              version,
              "ielts-writing-rubric-v1",
            ),
            ...criterion(
              "lexical_resource",
              response.lexical_resource_band,
              confidence,
              version,
              "ielts-writing-rubric-v1",
            ),
            ...criterion(
              "grammar",
              response.grammar_band,
              confidence,
              version,
              "ielts-writing-rubric-v1",
            ),
          ],
        });
      }
      for (const response of speakingResult.data ?? []) {
        const date = occurredAt.get(response.attempt_id);
        if (!date) continue;
        const confidence = gradingConfidence(response.grading_metadata);
        const version = gradingVersion(response.grading_metadata);
        rows.push({
          attemptId: response.attempt_id,
          userId: response.user_id,
          responseId: response.id,
          responseRevision: response.revision,
          occurredAt: response.scored_at ?? response.updated_at ?? date,
          skill: "speaking",
          questionType: response.part_number
            ? `speaking_part_${response.part_number}`
            : null,
          band: response.speaking_band,
          authority: "ai_provisional",
          confidence,
          gradingVersion: version,
          rubricVersion: "ielts-speaking-rubric-v1",
          criteria: [
            ...criterion(
              "fluency_coherence",
              response.fluency_coherence_band,
              confidence,
              version,
              "ielts-speaking-rubric-v1",
            ),
            ...criterion(
              "lexical_resource",
              response.lexical_resource_band,
              confidence,
              version,
              "ielts-speaking-rubric-v1",
            ),
            ...criterion(
              "grammar",
              response.grammar_band,
              confidence,
              version,
              "ielts-speaking-rubric-v1",
            ),
            ...criterion(
              "pronunciation",
              response.pronunciation_band,
              confidence,
              version,
              "ielts-speaking-rubric-v1",
            ),
          ],
        });
      }
      return rows;
    },

    async loadPublishedTeacherFeedback(learnerId, attemptIds) {
      if (attemptIds.length === 0) return [];
      const result = await db
        .from("ielts_teacher_reviews")
        .select(
          "id, user_id, class_id, attempt_id, writing_response_id, speaking_response_id, review_kind, revision, status, published_at, skill_band, task_band, task_response_band, coherence_cohesion_band, lexical_resource_band, grammar_band, fluency_coherence_band, pronunciation_band, criterion_feedback",
        )
        .eq("user_id", learnerId)
        .eq("status", "published")
        .in("attempt_id", unique(attemptIds));
      if (result.error) throw result.error;
      return (result.data ?? []).flatMap(
        (row): IeltsCoachPublishedFeedbackSource[] => {
          const skill =
            row.review_kind === "writing"
              ? "writing"
              : row.review_kind === "speaking"
                ? "speaking"
                : null;
          const responseId =
            skill === "writing"
              ? row.writing_response_id
              : row.speaking_response_id;
          if (!skill || !responseId) return [];
          const criteria =
            skill === "writing"
              ? [
                  ["task_response", row.task_response_band, "taskResponse"],
                  [
                    "coherence_cohesion",
                    row.coherence_cohesion_band,
                    "coherenceCohesion",
                  ],
                  [
                    "lexical_resource",
                    row.lexical_resource_band,
                    "lexicalResource",
                  ],
                  ["grammar", row.grammar_band, "grammaticalRangeAccuracy"],
                ]
              : [
                  [
                    "fluency_coherence",
                    row.fluency_coherence_band,
                    "fluencyCoherence",
                  ],
                  [
                    "lexical_resource",
                    row.lexical_resource_band,
                    "lexicalResource",
                  ],
                  ["grammar", row.grammar_band, "grammaticalRangeAccuracy"],
                  ["pronunciation", row.pronunciation_band, "pronunciation"],
                ];
          return [
            {
              reviewId: row.id,
              userId: row.user_id,
              classId: row.class_id,
              attemptId: row.attempt_id,
              responseId,
              responseRevision: row.revision,
              skill,
              status: "published",
              publishedAt: row.published_at,
              skillBand: skill === "writing" ? row.task_band : row.skill_band,
              criteria: criteria.flatMap(([name, band, rationaleKey]) =>
                typeof name === "string" &&
                typeof band === "number" &&
                typeof rationaleKey === "string"
                  ? [
                      {
                        criterion: name,
                        band,
                        rationale: criterionRationale(
                          row.criterion_feedback,
                          rationaleKey,
                        ),
                      },
                    ]
                  : [],
              ),
              summary: null,
            },
          ];
        },
      );
    },

    async loadAssignedWork(learnerId, activeIeltsClassIds) {
      if (activeIeltsClassIds.length === 0) return [];
      const [result, completedAttempts] = await Promise.all([
        db
          .from("club_assignments")
          .select(
            "id, class_id, title, due_at, status, assignment_type, ielts_test_id, assigned_track, topic_category, metadata",
          )
          .in("class_id", activeIeltsClassIds)
          .eq("assignment_type", "ielts_mock")
          .not("ielts_test_id", "is", null)
          .eq("status", "active")
          .order("due_at", { ascending: true, nullsFirst: false })
          .limit(20),
        db
          .from("ielts_attempts")
          .select("assignment_id")
          .eq("user_id", learnerId)
          .eq("status", "completed")
          .not("assignment_id", "is", null),
      ]);
      if (result.error ?? completedAttempts.error) {
        throw result.error ?? completedAttempts.error;
      }
      const completedAssignmentIds = new Set(
        (completedAttempts.data ?? []).flatMap((row) =>
          row.assignment_id ? [row.assignment_id] : [],
        ),
      );
      return (result.data ?? []).flatMap(
        (row): IeltsCoachAssignedWorkSource[] => {
          if (
            !row.class_id ||
            !row.ielts_test_id ||
            completedAssignmentIds.has(row.id)
          ) {
            return [];
          }
          const metadata = objectValue(row.metadata);
          const skill = skillValue(
            metadata?.skill ?? row.assigned_track ?? row.topic_category,
          );
          if (!skill) return [];
          return [
            {
              assignmentId: row.id,
              classId: row.class_id,
              assignedLearnerId:
                stringValue(metadata?.assignedLearnerId) ??
                stringValue(metadata?.assigned_learner_id),
              subject: "ielts",
              publicationStatus: "published",
              status: "active",
              title: row.title,
              skill,
              criterion: stringValue(metadata?.criterion),
              questionType:
                stringValue(metadata?.questionType) ??
                stringValue(metadata?.question_type),
              dueAt: row.due_at,
              estimatedMinutes: numberValue(
                metadata?.estimatedMinutes ?? metadata?.estimated_minutes,
              ),
            },
          ];
        },
      );
    },
  };
}
