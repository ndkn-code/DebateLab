import { findProhibitedAuthorityClaims } from "./boundaries";
import type { IeltsCoachOutput } from "./contracts";
import type { IeltsCoachMetricsTags } from "./operations";

export type IeltsCoachEvaluationTags = IeltsCoachMetricsTags;

export interface IeltsCoachEvaluationObservation {
  tags: IeltsCoachEvaluationTags;
  output: IeltsCoachOutput | null;
  authorizedEvidenceIds: readonly string[];
  teacherCriterionBand?: number | null;
  latencyMs: number;
  estimatedCostUsd: number;
  outcome:
    | "success"
    | "provider_timeout"
    | "provider_failed"
    | "schema_invalid"
    | "content_blocked";
}

export interface IeltsCoachEvaluationResult {
  groundedness: number;
  taskActionability: number;
  teacherDisagreementBands: number | null;
  prohibitedAuthorityClaimCount: number;
  latencyMs: number;
  estimatedCostUsd: number;
  failed: boolean;
}

export function evaluateIeltsCoachObservation(
  observation: IeltsCoachEvaluationObservation,
): IeltsCoachEvaluationResult {
  const output = observation.output;
  if (!output) {
    return {
      groundedness: 0,
      taskActionability: 0,
      teacherDisagreementBands: null,
      prohibitedAuthorityClaimCount: 0,
      latencyMs: observation.latencyMs,
      estimatedCostUsd: observation.estimatedCostUsd,
      failed: true,
    };
  }

  const allowed = new Set(observation.authorizedEvidenceIds);
  const referenced = [
    ...output.learnerEvidenceUsed.map((item) => item.evidenceId),
    ...output.sources
      .filter(
        (source) =>
          source.sourceType === "learner_record" ||
          source.sourceType === "teacher_published",
      )
      .map((source) => source.evidenceId),
  ];
  const grounded = referenced.filter((id) => allowed.has(id)).length;
  const groundedness = referenced.length ? grounded / referenced.length : 0;
  const taskActionability =
    output.action.resourceId === output.recommendedTask.taskId &&
    output.action.skill === output.diagnosis.skill &&
    output.recommendedTask.instructions.length >= 12
      ? 1
      : 0;
  const teacherDisagreementBands =
    observation.teacherCriterionBand == null ||
    output.bandCriterionGap.current == null
      ? null
      : Math.abs(
          output.bandCriterionGap.current.band -
            observation.teacherCriterionBand,
        );

  return {
    groundedness,
    taskActionability,
    teacherDisagreementBands,
    prohibitedAuthorityClaimCount: findProhibitedAuthorityClaims(output).length,
    latencyMs: observation.latencyMs,
    estimatedCostUsd: observation.estimatedCostUsd,
    failed: observation.outcome !== "success",
  };
}

export interface IeltsCoachEvaluationGroup {
  tags: IeltsCoachEvaluationTags;
  count: number;
  averageGroundedness: number;
  taskActionabilityRate: number;
  averageTeacherDisagreementBands: number | null;
  averageLatencyMs: number;
  totalEstimatedCostUsd: number;
  failureRate: number;
  prohibitedAuthorityClaimCount: number;
}

export function aggregateIeltsCoachEvaluations(
  observations: readonly IeltsCoachEvaluationObservation[],
): IeltsCoachEvaluationGroup[] {
  const groups = new Map<string, IeltsCoachEvaluationObservation[]>();
  for (const observation of observations) {
    const key = JSON.stringify(observation.tags);
    groups.set(key, [...(groups.get(key) ?? []), observation]);
  }

  return [...groups.values()].map((entries) => {
    const results = entries.map(evaluateIeltsCoachObservation);
    const disagreements = results.flatMap((result) =>
      result.teacherDisagreementBands == null
        ? []
        : [result.teacherDisagreementBands],
    );
    return {
      tags: entries[0]!.tags,
      count: entries.length,
      averageGroundedness: average(
        results.map((result) => result.groundedness),
      ),
      taskActionabilityRate: average(
        results.map((result) => result.taskActionability),
      ),
      averageTeacherDisagreementBands: disagreements.length
        ? average(disagreements)
        : null,
      averageLatencyMs: average(results.map((result) => result.latencyMs)),
      totalEstimatedCostUsd: results.reduce(
        (sum, result) => sum + result.estimatedCostUsd,
        0,
      ),
      failureRate: average(results.map((result) => (result.failed ? 1 : 0))),
      prohibitedAuthorityClaimCount: results.reduce(
        (sum, result) => sum + result.prohibitedAuthorityClaimCount,
        0,
      ),
    };
  });
}

function average(values: readonly number[]) {
  return values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 0;
}
