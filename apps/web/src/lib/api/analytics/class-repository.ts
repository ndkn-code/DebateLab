import "server-only";
import { createTypedAdminClient } from "@/lib/supabase/admin";
import { loadIeltsClassGradebookSnapshot } from "@/lib/api/ielts/gradebook-repository";
import { buildClassAnalytics } from "@/lib/analytics/class-rollup";
import type {
  NormalizedCriterionEvidence,
  WeakSubskillInput,
  PeriodAttendance,
  ClassAnalytics,
} from "@/lib/analytics/contracts";
import {
  centreTimezone,
  createTypedServerClient,
  requireAnalyticsClass,
} from "./access";
import { readChunkedPages, readPages, requireRows } from "./query-pages";
import { dateInZone, reportingPeriod } from "./reporting-period";

/** Authorized current-class response IDs are the capability for evidence reads. */
export async function loadClassAnalytics(
  classId: string,
  days: 7 | 30 | 90,
): Promise<ClassAnalytics> {
  const client = await createTypedServerClient();
  const manager = await requireAnalyticsClass(client, classId);
  const clubId = manager.clubId!;
  const period = reportingPeriod(days, await centreTimezone(client, clubId));
  // Authorization and tenant linkage have completed before this client exists.
  const trusted = createTypedAdminClient();
  const snapshot = await loadIeltsClassGradebookSnapshot(
    client,
    { classId, clubId },
    trusted,
  );
  const gradebook = snapshot.gradebook;
  const targets = new Map(
    gradebook.rows.flatMap((learner) =>
      learner.assignments.flatMap((assignment) =>
        assignment.reviewTargets.map(
          (target) =>
            [
              target.responseId,
              {
                target,
                learnerId: learner.userId,
                assignmentId: assignment.assignmentId,
              },
            ] as const,
        ),
      ),
    ),
  );
  const userIds = gradebook.rows
    .filter((row) => !row.historical && row.membershipStatus === "active")
    .map((row) => row.userId);
  const [evidenceResult, statesResult, sessionsResult] = await Promise.all([
    readChunkedPages([[...targets.keys()]], (chunks, from, to) =>
      trusted
        .from("ielts_criterion_evidence")
        .select(
          "response_id,user_id,attempt_id,criterion,skill,revision,source_response_revision,stage,band,created_at",
        )
        .in("response_id", chunks[0])
        .order("id")
        .range(from, to),
    ),
    readChunkedPages([userIds], (chunks, from, to) =>
      trusted
        .from("ielts_skill_states")
        .select(
          "user_id,skill,subskill_key,weakness_weight,confidence,evidence_count,last_evidence_at",
        )
        .in("user_id", chunks[0])
        .gt("weakness_weight", 0)
        .gt("confidence", 0)
        .gt("evidence_count", 0)
        .gte("last_evidence_at", period.start)
        .lte("last_evidence_at", period.end)
        .order("id")
        .range(from, to),
    ),
    readPages((from, to) =>
      client
        .from("class_attendance_sessions")
        .select("id")
        .eq("class_id", classId)
        .gte("session_date", dateInZone(period.start, period.timezone))
        .lte("session_date", dateInZone(period.end, period.timezone))
        .order("id")
        .range(from, to),
    ),
  ]);
  const criterionEvidence: NormalizedCriterionEvidence[] = requireRows(
    evidenceResult,
    "criterion evidence",
  ).flatMap((row) => {
    const owned = targets.get(row.response_id);
    if (
      !owned ||
      owned.learnerId !== row.user_id ||
      owned.target.attemptId !== row.attempt_id ||
      owned.target.revision !== row.revision ||
      row.source_response_revision !== row.revision ||
      (row.skill !== "writing" && row.skill !== "speaking") ||
      (row.stage !== "provisional" && row.stage !== "adjudicated")
    )
      return [];
    return [
      {
        learnerId: row.user_id,
        assignmentId: owned.assignmentId,
        responseId: row.response_id,
        skill: row.skill,
        criterion: row.criterion,
        band: row.band,
        revision: row.revision,
        stage: row.stage,
        createdAt: row.created_at,
        ...(row.skill === "writing"
          ? {
              task:
                owned.target.taskNumber === 1
                  ? ("task1" as const)
                  : ("task2" as const),
            }
          : {}),
      },
    ];
  });
  const states = statesResult.error ? [] : (statesResult.data ?? []);
  const keys = [...new Set(states.map((state) => state.subskill_key))];
  const labelsResult = await readChunkedPages([keys], (chunks, from, to) =>
    trusted
      .from("ielts_subskills")
      .select("key,label_en,label_vi")
      .in("key", chunks[0])
      .order("key")
      .range(from, to),
  );
  const labels = new Map(
    (labelsResult.data ?? []).map((row) => [row.key, row]),
  );
  const weakSubskills: WeakSubskillInput[] = states.flatMap((row) => {
    const label = labels.get(row.subskill_key);
    if (!label || !row.last_evidence_at) return [];
    return [
      {
        learnerId: row.user_id,
        skill: row.skill,
        subskill: row.subskill_key,
        severity: row.weakness_weight,
        source: "learner-wide" as const,
        label: { en: label.label_en, vi: label.label_vi },
        confidence: row.confidence,
        evidenceCount: row.evidence_count,
        lastEvidenceAt: row.last_evidence_at,
      },
    ];
  });
  const sessionIds = requireRows(sessionsResult, "attendance sessions").map(
    (row) => row.id,
  );
  const records = requireRows(
    await readChunkedPages([sessionIds, userIds], (chunks, from, to) =>
      client
        .from("class_attendance_records")
        .select("user_id,status")
        .in("session_id", chunks[0])
        .in("user_id", chunks[1])
        .order("id")
        .range(from, to),
    ),
    "attendance records",
  );
  const attendanceMap = new Map<string, PeriodAttendance>();
  for (const row of records) {
    const count = attendanceMap.get(row.user_id) ?? {
      learnerId: row.user_id,
      present: 0,
      late: 0,
      absent: 0,
    };
    if (
      row.status === "present" ||
      row.status === "late" ||
      row.status === "absent"
    )
      count[row.status] += 1;
    attendanceMap.set(row.user_id, count);
  }
  const report = buildClassAnalytics({
    classId,
    clubId,
    classTitle: gradebook.classTitle,
    period,
    rows: gradebook.rows,
    criterionEvidence,
    weakSubskills,
    attendance: [...attendanceMap.values()],
  });
  report.sources = {
    ...report.sources,
    subskills:
      statesResult.error || labelsResult.error ? "unavailable" : "available",
  };
  return report;
}
