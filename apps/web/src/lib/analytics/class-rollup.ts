import type {
  IeltsGradebookAssignment,
  IeltsGradebookRow,
  IeltsGradebookReviewTarget,
} from "@/lib/api/ielts/gradebook-repository";
import { criteriaForReview } from "@/lib/ielts/teacher/rubric";
import { compareClassWeaknessPriority } from "@/lib/ielts/study-plan/class-view";
import type {
  AssessmentAggregate,
  BilingualLabel,
  ClassAnalyticsInput,
  ClassAnalytics,
  CriterionSummary,
  IeltsSkill,
  LearnerAttention,
  NormalizedCriterionEvidence,
  PostMockReport,
  ReteachPriority,
  SkillSummary,
  SmartGroup,
  SmartGroupBand,
} from "./contracts";

export const ANALYTICS_SKILLS: readonly IeltsSkill[] = [
  "listening",
  "reading",
  "writing",
  "speaking",
];
export const SKILL_LABELS: Record<IeltsSkill, BilingualLabel> = {
  listening: { en: "Listening", vi: "Nghe" },
  reading: { en: "Reading", vi: "Đọc" },
  writing: { en: "Writing", vi: "Viết" },
  speaking: { en: "Speaking", vi: "Nói" },
};
const round = (value: number) => Math.round(value * 100) / 100;
const mean = (values: readonly number[]) =>
  values.length
    ? round(values.reduce((a, b) => a + b, 0) / values.length)
    : null;
const validBand = (value: number | null | undefined): value is number =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= 0 &&
  value <= 9;
const active = (row: IeltsGradebookRow) =>
  !row.historical && row.membershipStatus === "active";
const within = (date: string | null | undefined, input: ClassAnalyticsInput) =>
  Boolean(
    date &&
    Date.parse(date) >= Date.parse(input.period.start) &&
    Date.parse(date) <= Date.parse(input.period.end),
  );
const submitted = (assignment: IeltsGradebookAssignment) =>
  Boolean(assignment.submittedAt);
const bandBucket = (value: number): SmartGroupBand =>
  value < 5 ? "below-5" : value < 6 ? "5-5.5" : value < 7 ? "6-6.5" : "7-plus";
type Assignments = Map<string, IeltsGradebookAssignment[]>;
interface EffectiveCriterion extends NormalizedCriterionEvidence {
  label: BilingualLabel;
  aiStage: "provisional" | "adjudicated" | null;
}

function assignmentsFor(
  rows: readonly IeltsGradebookRow[],
  input: ClassAnalyticsInput,
): Assignments {
  return new Map(
    rows.map((row) => [
      row.userId,
      row.assignments.filter(
        (assignment) =>
          submitted(assignment) && within(assignment.submittedAt, input),
      ),
    ]),
  );
}
function provisional(
  assignment: IeltsGradebookAssignment,
  skill: IeltsSkill,
): boolean {
  if (skill === "listening" || skill === "reading") return false;
  const targets = assignment.reviewTargets.filter(
    (target) => target.responseKind === skill,
  );
  return targets.length
    ? targets.some((target) => target.currentReviewStatus !== "published")
    : assignment.score.source !== "teacher_confirmed";
}
function summarySkills(
  rows: readonly IeltsGradebookRow[],
  assignments: Assignments,
): SkillSummary[] {
  return ANALYTICS_SKILLS.map((skill) => {
    const samples = rows.flatMap((row) => {
      const scored = (assignments.get(row.userId) ?? []).filter((assignment) =>
        validBand(assignment.score[skill]),
      );
      return scored.length
        ? [
            {
              value: mean(
                scored.map((assignment) => assignment.score[skill]!),
              )!,
              provisional: scored.some((assignment) =>
                provisional(assignment, skill),
              ),
            },
          ]
        : [];
    });
    const histogram = new Map<number, number>();
    for (const sample of samples) {
      const bucket = Math.round(sample.value * 2) / 2;
      histogram.set(bucket, (histogram.get(bucket) ?? 0) + 1);
    }
    const provisionalLearners = samples.filter(
      (sample) => sample.provisional,
    ).length;
    return {
      skill,
      label: SKILL_LABELS[skill],
      learnerCount: samples.length,
      meanBand: mean(samples.map((sample) => sample.value)),
      coverage: rows.length ? round(samples.length / rows.length) : 0,
      provisionalLearners,
      confirmedLearners: samples.length - provisionalLearners,
      distribution: [...histogram.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([band, learners]) => ({
          band,
          learners,
          share: learners / samples.length,
        })),
    };
  });
}
function rubricFor(target: IeltsGradebookReviewTarget) {
  return criteriaForReview(target.responseKind, target.taskNumber ?? undefined);
}
function canonicalKey(key: string, target: IeltsGradebookReviewTarget): string {
  if (
    target.responseKind === "writing" &&
    target.taskNumber === 1 &&
    key === "taskResponse"
  )
    return "taskAchievement";
  const rubric = rubricFor(target);
  return (
    rubric.find((criterion) => criterion.key === key || criterion.dbKey === key)
      ?.key ?? key
  );
}
/** Current gradebook targets constrain revisions and scope; teacher confirmation is independent of AI stage. */
function effectiveCriteria(
  rows: readonly IeltsGradebookRow[],
  assignments: Assignments,
  input: ClassAnalyticsInput,
): EffectiveCriterion[] {
  const evidenceByResponse = new Map<string, NormalizedCriterionEvidence[]>();
  for (const item of input.criterionEvidence) {
    if (
      !validBand(item.band) ||
      Date.parse(item.createdAt) > Date.parse(input.period.end)
    )
      continue;
    evidenceByResponse.set(item.responseId, [
      ...(evidenceByResponse.get(item.responseId) ?? []),
      item,
    ]);
  }
  const result: EffectiveCriterion[] = [];
  for (const row of rows)
    for (const assignment of assignments.get(row.userId) ?? [])
      for (const target of assignment.reviewTargets) {
        const selected = new Map<string, NormalizedCriterionEvidence>();
        for (const item of evidenceByResponse.get(target.responseId) ?? []) {
          if (
            item.learnerId !== row.userId ||
            item.assignmentId !== assignment.assignmentId ||
            item.revision !== target.revision ||
            item.skill !== target.responseKind
          )
            continue;
          const key = canonicalKey(item.criterion, target);
          const prior = selected.get(key);
          if (
            !prior ||
            (prior.stage === "provisional" && item.stage === "adjudicated") ||
            (item.stage === prior.stage && item.createdAt > prior.createdAt)
          )
            selected.set(key, { ...item, criterion: key });
        }
        for (const criterion of rubricFor(target)) {
          const ai = selected.get(criterion.key);
          const projected = target.criteria.find(
            (item) => item.key === criterion.key,
          );
          const teacher =
            projected?.reviewStatus === "published" &&
            validBand(projected.teacherBand);
          const band = teacher
            ? projected!.teacherBand
            : (ai?.band ?? projected?.aiBand);
          if (!validBand(band)) continue;
          result.push({
            learnerId: row.userId,
            assignmentId: assignment.assignmentId,
            responseId: target.responseId,
            revision: target.revision,
            skill: target.responseKind,
            criterion: criterion.key,
            task:
              target.responseKind === "writing"
                ? target.taskNumber === 1
                  ? "task1"
                  : "task2"
                : undefined,
            band,
            stage: ai?.stage ?? "provisional",
            createdAt: ai?.createdAt ?? assignment.submittedAt!,
            provenance: teacher
              ? "teacherConfirmed"
              : ai?.stage === "adjudicated"
                ? "aiAdjudicated"
                : "aiProvisional",
            aiStage:
              ai?.stage ??
              (validBand(projected?.aiBand) ? "provisional" : null),
            label: { en: criterion.labelEn, vi: criterion.labelVi },
          });
        }
      }
  return result;
}
function summarizeCriteria(
  evidence: readonly EffectiveCriterion[],
  total: number,
): CriterionSummary[] {
  const buckets = new Map<string, EffectiveCriterion[]>();
  for (const row of evidence) {
    const key = `${row.skill}:${row.task ?? "all"}:${row.criterion}`;
    buckets.set(key, [...(buckets.get(key) ?? []), row]);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, entries]) => {
      const byLearner = new Map<string, number[]>();
      for (const item of entries)
        byLearner.set(item.learnerId, [
          ...(byLearner.get(item.learnerId) ?? []),
          item.band,
        ]);
      const first = entries[0];
      return {
        skill: first.skill,
        criterion: first.criterion,
        task: first.task ?? null,
        label: first.label,
        learnerCount: byLearner.size,
        meanBand: mean([...byLearner.values()].map((values) => mean(values)!)),
        coverage: total ? round(byLearner.size / total) : 0,
        provenance: {
          aiProvisional: entries.filter(
            (item) => item.aiStage === "provisional",
          ).length,
          aiAdjudicated: entries.filter(
            (item) => item.aiStage === "adjudicated",
          ).length,
          teacherConfirmed: entries.filter(
            (item) => item.provenance === "teacherConfirmed",
          ).length,
        },
      };
    });
}
function reteach(
  rows: readonly IeltsGradebookRow[],
  evidence: EffectiveCriterion[],
  input: ClassAnalyticsInput,
  onlyAssignment?: string,
): ReteachPriority[] {
  const activeIds = new Set(rows.map((row) => row.userId));
  const perLearnerCriterion = new Map<string, EffectiveCriterion[]>();
  for (const item of evidence) {
    const key = `${item.learnerId}:${item.skill}:${item.task ?? ""}:${item.criterion}`;
    perLearnerCriterion.set(key, [
      ...(perLearnerCriterion.get(key) ?? []),
      item,
    ]);
  }
  const signals: Array<{
    learnerId: string;
    key: string;
    priority: ReteachPriority;
  }> = [];
  // A criterion below the learner's own mean within this rubric is a relative gap,
  // not a claim that every learner below an arbitrary target has failed.
  const baseline = new Map<string, number[]>();
  for (const item of evidence) {
    const key = `${item.learnerId}:${item.skill}:${item.task ?? ""}`;
    baseline.set(key, [...(baseline.get(key) ?? []), item.band]);
  }
  for (const entries of perLearnerCriterion.values()) {
    const item = entries[0];
    const deficit =
      mean(
        baseline.get(`${item.learnerId}:${item.skill}:${item.task ?? ""}`) ??
          [],
      )! - mean(entries.map((entry) => entry.band))!;
    if (deficit < 0.25) continue;
    const key = `${item.skill}:${item.task ?? ""}:${item.criterion}`;
    const label = item.task
      ? {
          en: `${item.task === "task1" ? "Task 1" : "Task 2"}: ${item.label.en}`,
          vi: `${item.task === "task1" ? "Bài viết 1" : "Bài viết 2"}: ${item.label.vi}`,
        }
      : item.label;
    signals.push({
      learnerId: item.learnerId,
      key,
      priority: {
        skill: item.skill,
        subskill: key,
        label,
        affectedLearners: 1,
        severity: deficit,
        source: "assessment",
        assignmentIds: [...new Set(entries.map((entry) => entry.assignmentId))],
      },
    });
  }
  for (const item of input.weakSubskills ?? []) {
    if (
      !activeIds.has(item.learnerId) ||
      !item.label ||
      !(item.evidenceCount && item.evidenceCount > 0) ||
      !(item.confidence && item.confidence > 0) ||
      !within(item.lastEvidenceAt, input) ||
      item.severity <= 0 ||
      (onlyAssignment &&
        (item.source !== "assessment" || item.assignmentId !== onlyAssignment))
    )
      continue;
    signals.push({
      learnerId: item.learnerId,
      key: `${item.source}:${item.skill}:${item.subskill}`,
      priority: {
        skill: item.skill,
        subskill: item.subskill,
        label: item.label,
        affectedLearners: 1,
        severity: item.severity,
        source: item.source,
        assignmentIds: item.assignmentId ? [item.assignmentId] : [],
      },
    });
  }
  const aggregates = new Map<
    string,
    { priority: ReteachPriority; learners: Map<string, number> }
  >();
  for (const signal of signals) {
    const entry = aggregates.get(signal.key) ?? {
      priority: signal.priority,
      learners: new Map<string, number>(),
    };
    entry.learners.set(
      signal.learnerId,
      Math.max(
        entry.learners.get(signal.learnerId) ?? 0,
        signal.priority.severity,
      ),
    );
    entry.priority.assignmentIds = [
      ...new Set([
        ...entry.priority.assignmentIds,
        ...signal.priority.assignmentIds,
      ]),
    ];
    aggregates.set(signal.key, entry);
  }
  return [...aggregates.values()]
    .map(({ priority, learners }) => ({
      ...priority,
      affectedLearners: learners.size,
      severity: mean([...learners.values()])!,
    }))
    .sort((a, b) =>
      compareClassWeaknessPriority(
        {
          affectedLearnerCount: a.affectedLearners,
          weaknessWeight: a.severity,
          key: a.subskill,
        },
        {
          affectedLearnerCount: b.affectedLearners,
          weaknessWeight: b.severity,
          key: b.subskill,
        },
      ),
    )
    .slice(0, 3);
}
function makeGroups(
  rows: readonly IeltsGradebookRow[],
  assignments: Assignments,
) {
  const groups: SmartGroup[] = [];
  const missing: ClassAnalytics["groupsMissingEvidence"] = {
    listening: [],
    reading: [],
    writing: [],
    speaking: [],
  };
  for (const skill of ANALYTICS_SKILLS) {
    const buckets = new Map<SmartGroupBand, SmartGroup["learners"]>();
    for (const row of rows) {
      // Demonstrated current level is the latest submitted score, not a blend of past levels.
      const latest = [...(assignments.get(row.userId) ?? [])]
        .filter((assignment) => validBand(assignment.score[skill]))
        .sort(
          (a, b) =>
            (b.submittedAt ?? "").localeCompare(a.submittedAt ?? "") ||
            a.assignmentId.localeCompare(b.assignmentId),
        )[0];
      if (!latest) {
        missing[skill].push({
          learnerId: row.userId,
          displayName: row.displayName,
        });
        continue;
      }
      const band = latest.score[skill]!;
      const bucket = bandBucket(band);
      buckets.set(bucket, [
        ...(buckets.get(bucket) ?? []),
        { learnerId: row.userId, displayName: row.displayName, band },
      ]);
    }
    for (const band of ["below-5", "5-5.5", "6-6.5", "7-plus"] as const) {
      const learners = (buckets.get(band) ?? []).sort(
        (a, b) => a.band - b.band || a.learnerId.localeCompare(b.learnerId),
      );
      while (learners.length) {
        const size = learners.length === 5 ? 3 : Math.min(4, learners.length);
        groups.push({
          skill,
          band,
          learners: learners.splice(0, size),
          ungrouped: size === 1,
        });
      }
    }
  }
  return { groups, missing };
}
export function buildClassAnalytics(
  input: ClassAnalyticsInput,
): ClassAnalytics {
  const rows = input.rows
    .filter(active)
    .sort((a, b) => a.userId.localeCompare(b.userId));
  const assignments = assignmentsFor(rows, input);
  const evidence = effectiveCriteria(rows, assignments, input);
  const skillSummaries = summarySkills(rows, assignments);
  const attention: LearnerAttention[] = rows
    .flatMap((row) => {
      const reasons: LearnerAttention["reasons"] = [];
      const overdue = row.assignments.filter(
        (a) =>
          (a.status === "published" || a.status === "active") &&
          a.dueAt &&
          Date.parse(a.dueAt) < Date.parse(input.period.end) &&
          !a.homework.submitted &&
          !submitted(a),
      );
      if (overdue.length)
        reasons.push({
          code: "overdue_assignment",
          count: overdue.length,
          details: overdue.map((assignment) => ({
            en: assignment.title,
            vi: assignment.title,
          })),
          assignmentIds: overdue.map((a) => a.assignmentId),
        });
      const critical = (input.weakSubskills ?? []).filter(
        (item) =>
          item.learnerId === row.userId &&
          item.severity >= 0.7 &&
          (item.confidence ?? 0) > 0 &&
          (item.evidenceCount ?? 0) > 0 &&
          within(item.lastEvidenceAt, input),
      );
      if (critical.length)
        reasons.push({
          code: "critical_weakness",
          severity: Math.max(...critical.map((item) => item.severity)),
          details: critical.flatMap((item) => (item.label ? [item.label] : [])),
          count: new Set(
            critical.map((item) => `${item.skill}:${item.subskill}`),
          ).size,
          assignmentIds: [
            ...new Set(
              critical.flatMap((item) =>
                item.assignmentId ? [item.assignmentId] : [],
              ),
            ),
          ],
        });
      const absent =
        input.attendance?.find((item) => item.learnerId === row.userId)
          ?.absent ?? 0;
      if (absent >= 2)
        reasons.push({
          code: "repeated_absence",
          count: absent,
          assignmentIds: [],
        });
      return reasons.length
        ? [
            {
              learnerId: row.userId,
              displayName: row.displayName,
              reasons,
              priority:
                reasons[0].code === "overdue_assignment"
                  ? 3
                  : reasons[0].code === "critical_weakness"
                    ? 2
                    : 1,
            },
          ]
        : [];
    })
    .sort(
      (a, b) =>
        b.priority - a.priority ||
        (b.reasons[0].severity ?? 0) - (a.reasons[0].severity ?? 0) ||
        b.reasons[0].count - a.reasons[0].count ||
        a.learnerId.localeCompare(b.learnerId),
    );
  const eligible = rows
    .flatMap((row) => row.assignments)
    .filter(
      (assignment) =>
        assignment.assignmentType === "ielts_mock" &&
        (within(assignment.submittedAt, input) ||
          within(assignment.dueAt, input)),
    );
  const assessments: AssessmentAggregate[] = [
    ...new Map(
      eligible.map((assignment) => [assignment.assignmentId, assignment]),
    ).values(),
  ]
    .sort(
      (a, b) =>
        (b.dueAt ?? b.submittedAt ?? "").localeCompare(
          a.dueAt ?? a.submittedAt ?? "",
        ) || a.assignmentId.localeCompare(b.assignmentId),
    )
    .map((assessment) => {
      const scoped = new Map(
        [...assignments].map(([id, items]) => [
          id,
          items.filter((item) => item.assignmentId === assessment.assignmentId),
        ]),
      );
      const scopedEvidence = evidence.filter(
        (item) => item.assignmentId === assessment.assignmentId,
      );
      return {
        assessmentId: assessment.assignmentId,
        title: assessment.title,
        submittedLearners: rows.filter(
          (row) => (scoped.get(row.userId)?.length ?? 0) > 0,
        ).length,
        provisionalLearners: rows.filter((row) =>
          (scoped.get(row.userId) ?? []).some(
            (assignment) =>
              assignment.score.overallIsProvisional ||
              ANALYTICS_SKILLS.some(
                (skill) =>
                  validBand(assignment.score[skill]) &&
                  provisional(assignment, skill),
              ),
          ),
        ).length,
        skillSummaries: summarySkills(rows, scoped),
        criterionSummaries: summarizeCriteria(scopedEvidence, rows.length),
        reteachPriorities: reteach(
          rows,
          scopedEvidence,
          input,
          assessment.assignmentId,
        ),
      };
    });
  const grouping = makeGroups(rows, assignments);
  const insufficientEvidence = rows
    .filter(
      (row) =>
        !(assignments.get(row.userId) ?? []).some((assignment) =>
          ANALYTICS_SKILLS.some((skill) => validBand(assignment.score[skill])),
        ) && !evidence.some((item) => item.learnerId === row.userId),
    )
    .map((row) => ({ learnerId: row.userId, displayName: row.displayName }));
  return {
    classId: input.classId,
    clubId: input.clubId,
    classTitle: input.classTitle,
    period: input.period,
    assessments,
    skillSummaries,
    criterionSummaries: summarizeCriteria(evidence, rows.length),
    reteachPriorities: reteach(rows, evidence, input),
    attention,
    insufficientEvidence,
    groups: grouping.groups,
    groupsMissingEvidence: grouping.missing,
    sources: {
      gradebook: "available",
      criterionEvidence: "available",
      attendance: input.attendance ? "available" : "unavailable",
      subskills: input.weakSubskills ? "available" : "unavailable",
    },
    coverage: {
      learnerCount: rows.length - insufficientEvidence.length,
      totalLearners: rows.length,
    },
  };
}
/** Explicit projection excludes every learner identity, rationale, ranking and group. */
export function buildPostMockReport(
  report: ClassAnalytics,
  assessmentId: string,
): PostMockReport | null {
  const assessment = report.assessments.find(
    (item) => item.assessmentId === assessmentId,
  );
  if (!assessment) return null;
  const scored = assessment.skillSummaries.filter(
    (item) => item.meanBand !== null,
  );
  const average = mean(scored.map((item) => item.meanBand!));
  const methodology = {
    en: "Current class roster; submissions in the selected period; equal weight per learner. Strengths and gaps are relative to this assessment. AI estimates remain provisional; AI adjudication is not teacher confirmation. No incomplete overall band is reported. Criterion source counts refer to response criteria and can overlap after teacher review.",
    vi: "Danh sách lớp hiện tại; bài nộp trong khoảng thời gian đã chọn; mỗi học viên có trọng số bằng nhau. Điểm mạnh và điểm cần cải thiện được so sánh trong bài đánh giá này. Ước tính AI là tạm thời; AI kiểm định không phải xác nhận của giáo viên. Không báo cáo điểm tổng khi chưa đủ kỹ năng. Số nguồn tiêu chí tính theo bài trả lời và có thể trùng sau khi giáo viên xem lại.",
  };
  const project = (item: SkillSummary) => ({
    skill: item.skill,
    meanBand: item.meanBand!,
    coverage: item.coverage,
  });
  return {
    title: assessment.title,
    classTitle: report.classTitle,
    period: report.period,
    rosterCount: report.coverage.totalLearners,
    submittedLearners: assessment.submittedLearners,
    provisionalCount: assessment.provisionalLearners,
    skillSummaries: assessment.skillSummaries,
    strengths: scored
      .filter((item) => average !== null && item.meanBand! > average)
      .sort((a, b) => b.meanBand! - a.meanBand!)
      .map(project),
    gaps: scored
      .filter((item) => average !== null && item.meanBand! < average)
      .sort((a, b) => a.meanBand! - b.meanBand!)
      .map(project),
    criterionCoverage: assessment.criterionSummaries.map((item) => ({
      skill: item.skill,
      criterion: item.criterion,
      learners: item.learnerCount,
    })),
    criterionSummaries: assessment.criterionSummaries,
    nextSteps: assessment.reteachPriorities.map((item) => ({
      skill: item.skill,
      criterion: item.subskill,
      label: item.label ?? SKILL_LABELS[item.skill],
      affectedLearners: item.affectedLearners,
    })),
    metadata: {
      coverage: report.coverage.totalLearners
        ? assessment.submittedLearners / report.coverage.totalLearners
        : 0,
      methodology,
    },
    methodology,
  };
}
