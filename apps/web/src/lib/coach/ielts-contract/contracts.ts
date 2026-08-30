import { z } from "zod";

export const IELTS_COACH_CONTRACT_VERSION = "ielts-coach.v1" as const;

export const ieltsCoachLocaleSchema = z.enum(["en", "vi"]);
export const ieltsCoachSkillSchema = z.enum([
  "listening",
  "reading",
  "writing",
  "speaking",
]);

export const ieltsCriterionSchema = z.enum([
  "listening",
  "reading",
  "task_achievement",
  "task_response",
  "coherence_and_cohesion",
  "lexical_resource",
  "grammatical_range_and_accuracy",
  "fluency_and_coherence",
  "pronunciation",
]);

const bandSchema = z.number().multipleOf(0.5).min(0).max(9);

export const scoreAuthoritySchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("objective"),
      band: bandSchema,
      label: z.literal("verified_objective_score"),
      sourceRevision: z.string().min(1).max(200),
    })
    .strict(),
  z
    .object({
      kind: z.literal("ai_provisional"),
      band: bandSchema,
      label: z.literal("practice_estimate"),
      confidence: z.number().min(0).max(1),
      model: z.string().min(1).max(200),
      gradingVersion: z.string().min(1).max(200),
      rubricVersion: z.string().min(1).max(200),
    })
    .strict(),
  z
    .object({
      kind: z.literal("teacher_confirmed"),
      band: bandSchema,
      label: z.literal("teacher_confirmed_score"),
      publicationStatus: z.literal("published"),
      publishedRevision: z.string().min(1).max(200),
    })
    .strict(),
]);

export type ScoreAuthority = z.infer<typeof scoreAuthoritySchema>;

export const learnerEvidenceSchema = z
  .object({
    evidenceId: z.string().min(1).max(200),
    kind: z.enum([
      "target_band",
      "test_date",
      "recent_attempt",
      "criterion_weakness",
      "teacher_feedback",
      "assigned_work",
      "completed_work",
    ]),
    summary: z.string().min(1).max(600),
    score: scoreAuthoritySchema.optional(),
    observedAt: z.string().datetime({ offset: true }).optional(),
  })
  .strict();

export type LearnerEvidence = z.infer<typeof learnerEvidenceSchema>;

export const ieltsCoachActionSchema = z
  .object({
    kind: z.enum([
      "start_assignment",
      "start_practice",
      "review_feedback",
      "open_study_plan",
      "seek_support",
    ]),
    resourceId: z.string().min(1).max(200),
    skill: ieltsCoachSkillSchema,
    criterion: ieltsCriterionSchema.optional(),
    label: z.string().min(1).max(120),
  })
  .strict();

export const ieltsCoachOutputSchema = z
  .object({
    contractVersion: z.literal(IELTS_COACH_CONTRACT_VERSION),
    product: z.literal("ielts"),
    outcome: z.enum(["recommendation", "needs_evidence", "safety_escalation"]),
    locale: ieltsCoachLocaleSchema,
    diagnosis: z
      .object({
        summary: z.string().min(1).max(1_200),
        skill: ieltsCoachSkillSchema,
        criteria: z.array(ieltsCriterionSchema).min(1).max(4),
      })
      .strict(),
    learnerEvidenceUsed: z.array(learnerEvidenceSchema).max(12),
    bandCriterionGap: z
      .object({
        criterion: ieltsCriterionSchema,
        current: scoreAuthoritySchema.nullable(),
        targetBand: bandSchema.nullable(),
        gapBands: z.number().multipleOf(0.5).min(0).max(9).nullable(),
        explanation: z.string().min(1).max(1_200),
      })
      .strict(),
    recommendedTask: z
      .object({
        taskId: z.string().min(1).max(200),
        title: z.string().min(1).max(180),
        instructions: z.string().min(1).max(1_200),
        whyItHelps: z.string().min(1).max(1_000),
        expectedSignal: z.string().min(1).max(500),
      })
      .strict(),
    confidence: z
      .object({
        level: z.enum(["low", "medium", "high"]),
        value: z.number().min(0).max(1),
        limitations: z.array(z.string().min(1).max(500)).max(8),
      })
      .strict(),
    sources: z
      .array(
        z
          .object({
            evidenceId: z.string().min(1).max(200),
            sourceType: z.enum([
              "learner_record",
              "teacher_published",
              "approved_rubric",
              "approved_exemplar",
            ]),
            sourceLocator: z.string().min(1).max(500),
            version: z.string().min(1).max(200),
          })
          .strict(),
      )
      .max(12),
    scoreAuthority: z
      .object({
        effective: z
          .enum(["objective", "ai_provisional", "teacher_confirmed"])
          .nullable(),
        learnerLabel: z
          .enum([
            "verified_objective_score",
            "practice_estimate",
            "teacher_confirmed_score",
          ])
          .nullable(),
        isOfficialTestResult: z.literal(false),
      })
      .strict(),
    action: ieltsCoachActionSchema,
  })
  .strict()
  .superRefine((output, context) => {
    const criteriaBySkill = {
      listening: new Set(["listening"]),
      reading: new Set(["reading"]),
      writing: new Set([
        "task_achievement",
        "task_response",
        "coherence_and_cohesion",
        "lexical_resource",
        "grammatical_range_and_accuracy",
      ]),
      speaking: new Set([
        "fluency_and_coherence",
        "lexical_resource",
        "grammatical_range_and_accuracy",
        "pronunciation",
      ]),
    }[output.diagnosis.skill];
    for (const [index, criterion] of output.diagnosis.criteria.entries()) {
      if (!criteriaBySkill.has(criterion)) {
        context.addIssue({
          code: "custom",
          path: ["diagnosis", "criteria", index],
          message: "criterion does not belong to the diagnosed IELTS skill",
        });
      }
    }
    if (!criteriaBySkill.has(output.bandCriterionGap.criterion)) {
      context.addIssue({
        code: "custom",
        path: ["bandCriterionGap", "criterion"],
        message: "gap criterion does not belong to the diagnosed IELTS skill",
      });
    }
    const current = output.bandCriterionGap.current;
    const gap = output.bandCriterionGap.gapBands;
    if (
      output.outcome === "recommendation" &&
      (!current || output.bandCriterionGap.targetBand == null || gap == null)
    ) {
      context.addIssue({
        code: "custom",
        path: ["bandCriterionGap"],
        message:
          "a recommendation requires an evidence-backed current band and gap",
      });
    }
    if (
      output.outcome !== "recommendation" &&
      (current || output.bandCriterionGap.targetBand != null || gap != null)
    ) {
      context.addIssue({
        code: "custom",
        path: ["bandCriterionGap"],
        message:
          "insufficient-evidence and safety outcomes cannot assert a current band",
      });
    }
    if (
      current &&
      output.bandCriterionGap.targetBand != null &&
      gap != null
    ) {
      const expectedGap = Math.max(
        0,
        output.bandCriterionGap.targetBand - current.band,
      );
      if (Math.abs(expectedGap - gap) > 0.001) {
        context.addIssue({
          code: "custom",
          path: ["bandCriterionGap", "gapBands"],
          message: "gapBands must equal max(0, targetBand - current band)",
        });
      }
      if (
        output.scoreAuthority.effective !== current.kind ||
        output.scoreAuthority.learnerLabel !== current.label
      ) {
        context.addIssue({
          code: "custom",
          path: ["scoreAuthority"],
          message: "score authority must match the current effective score",
        });
      }
    } else if (
      output.scoreAuthority.effective !== null ||
      output.scoreAuthority.learnerLabel !== null
    ) {
      context.addIssue({
        code: "custom",
        path: ["scoreAuthority"],
        message: "no score authority may be asserted without a current score",
      });
    }
    if (
      output.outcome === "recommendation" &&
      output.learnerEvidenceUsed.length === 0
    ) {
      context.addIssue({
        code: "custom",
        path: ["learnerEvidenceUsed"],
        message: "a scored recommendation requires learner evidence",
      });
    }
    if (
      output.outcome === "safety_escalation" &&
      output.action.kind !== "seek_support"
    ) {
      context.addIssue({
        code: "custom",
        path: ["action", "kind"],
        message: "safety escalation must use the safe support action",
      });
    }

    if (
      output.action.skill !== output.diagnosis.skill ||
      (output.action.criterion &&
        !output.diagnosis.criteria.includes(output.action.criterion))
    ) {
      context.addIssue({
        code: "custom",
        path: ["action"],
        message: "action must match the diagnosed IELTS skill and criterion",
      });
    }
    if (output.action.resourceId !== output.recommendedTask.taskId) {
      context.addIssue({
        code: "custom",
        path: ["action", "resourceId"],
        message: "the action must target the recommended task",
      });
    }

    const evidenceIds = new Set(
      output.learnerEvidenceUsed.map((item) => item.evidenceId),
    );
    for (const [index, source] of output.sources.entries()) {
      if (
        source.sourceType !== "approved_rubric" &&
        source.sourceType !== "approved_exemplar" &&
        !evidenceIds.has(source.evidenceId)
      ) {
        context.addIssue({
          code: "custom",
          path: ["sources", index, "evidenceId"],
          message: "learner source must reference authorized learner evidence",
        });
      }
    }
  });

export type IeltsCoachOutput = z.infer<typeof ieltsCoachOutputSchema>;

/** Resolve scores for one skill/criterion only. Draft teacher reviews are excluded by schema. */
export function resolveEffectiveScore(
  signals: readonly ScoreAuthority[],
): ScoreAuthority | null {
  return (
    [...signals]
      .reverse()
      .find((signal) => signal.kind === "teacher_confirmed") ??
    [...signals].reverse().find((signal) => signal.kind === "objective") ??
    [...signals].reverse().find((signal) => signal.kind === "ai_provisional") ??
    null
  );
}
