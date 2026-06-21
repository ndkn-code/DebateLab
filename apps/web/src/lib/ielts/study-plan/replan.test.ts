import assert from "node:assert/strict";
import type { IeltsSkill } from "@/lib/ielts/adaptive/contracts";
import {
  buildReplanRevisionSummary,
  computeNextReassessmentAt,
  countMissedDays,
  daysToTestDate,
  evaluateReplan,
  planItemReferenceKey,
  predictionBandDelta,
  reconcileStudyPlanItems,
  studyPlanModeFromHorizon,
  type CandidateReconcileItem,
  type ExistingReconcileItem,
  type ReplanPredictionView,
  type ReplanRevisionView,
} from "./replan";

const TODAY = "2026-06-21";

function existing(
  overrides: Partial<ExistingReconcileItem> & { id: string },
): ExistingReconcileItem {
  return {
    status: "scheduled",
    kind: "learn_activity",
    scheduledDate: "2026-06-23",
    skill: "reading",
    focusArea: "matching headings",
    titleEn: "Reading: matching headings",
    titleVi: "Reading: matching headings",
    referenceKey: "activity:act-1",
    isTeacherAssigned: false,
    ...overrides,
  };
}

function candidate(
  overrides: Partial<CandidateReconcileItem> & { clientKey: string },
): CandidateReconcileItem {
  return {
    kind: "learn_activity",
    scheduledDate: "2026-06-23",
    skill: "reading",
    focusArea: "matching headings",
    titleEn: "Reading: matching headings",
    titleVi: "Reading: matching headings",
    referenceKey: "activity:act-1",
    ...overrides,
  };
}

const ZERO_SKILLS: Record<IeltsSkill, number | null> = {
  listening: null,
  reading: null,
  writing: null,
  speaking: null,
};

function view(overrides: Partial<ReplanPredictionView> = {}): ReplanPredictionView {
  return {
    overallBand: 6,
    skillBands: { ...ZERO_SKILLS, reading: 6, listening: 6, writing: 6, speaking: 6 },
    topWeaknessKey: "reading:matching_headings",
    ...overrides,
  };
}

// ── reconcile: protect past / today / started / completed / teacher ──────────
{
  const items: ExistingReconcileItem[] = [
    existing({ id: "past", scheduledDate: "2026-06-19" }),
    existing({ id: "today", scheduledDate: TODAY, status: "available" }),
    existing({ id: "started-future", scheduledDate: "2026-06-25", status: "started" }),
    existing({ id: "done-future", scheduledDate: "2026-06-25", status: "completed" }),
    existing({
      id: "teacher-future",
      scheduledDate: "2026-06-26",
      kind: "teacher_assignment",
      isTeacherAssigned: true,
      referenceKey: "assignment:asg-1",
    }),
    existing({ id: "future-pending", scheduledDate: "2026-06-27", referenceKey: "activity:gone" }),
  ];
  // New plan keeps none of the future-pending item, schedules one fresh task.
  const candidates: CandidateReconcileItem[] = [
    candidate({
      clientKey: "new-1",
      scheduledDate: "2026-06-28",
      skill: "writing",
      focusArea: "task response",
      referenceKey: "activity:act-writing",
    }),
  ];

  const result = reconcileStudyPlanItems({ existing: items, candidates, today: TODAY });

  assert.deepEqual(
    result.preservedIds.sort(),
    ["done-future", "past", "started-future", "teacher-future", "today"],
    "past, today, started, completed, and teacher items must be preserved",
  );
  assert.deepEqual(result.cancelIds, ["future-pending"], "only future unstarted item is cancelled");
  assert.deepEqual(result.insertKeys, ["new-1"], "the fresh future task is inserted");
  assert.equal(result.changed, true);
}

// ── reconcile: keep matching future items (no churn) + idempotency ───────────
{
  const items: ExistingReconcileItem[] = [
    existing({ id: "keep-me", scheduledDate: "2026-06-24" }),
    existing({
      id: "drop-me",
      scheduledDate: "2026-06-25",
      skill: "writing",
      referenceKey: "activity:old-writing",
    }),
  ];
  const candidates: CandidateReconcileItem[] = [
    // Same signature as keep-me (date/kind/skill/focus/ref) → kept untouched.
    candidate({ clientKey: "c-keep", scheduledDate: "2026-06-24" }),
    // A brand-new item.
    candidate({
      clientKey: "c-new",
      scheduledDate: "2026-06-26",
      skill: "speaking",
      focusArea: "fluency",
      referenceKey: "activity:act-speaking",
    }),
  ];

  const first = reconcileStudyPlanItems({ existing: items, candidates, today: TODAY });
  assert.deepEqual(first.keptIds, ["keep-me"]);
  assert.deepEqual(first.cancelIds, ["drop-me"]);
  assert.deepEqual(first.insertKeys, ["c-new"]);
  assert.equal(first.changed, true);

  // Apply the result in memory, then reconcile again with the SAME candidates:
  // the second pass must be a no-op (idempotent).
  const applied: ExistingReconcileItem[] = [
    items[0], // keep-me retained
    existing({
      id: "inserted",
      scheduledDate: "2026-06-26",
      skill: "speaking",
      focusArea: "fluency",
      referenceKey: "activity:act-speaking",
    }),
  ];
  const second = reconcileStudyPlanItems({ existing: applied, candidates, today: TODAY });
  assert.equal(second.changed, false, "re-running with the same plan changes nothing");
  assert.deepEqual(second.cancelIds, []);
  assert.deepEqual(second.insertKeys, []);
  assert.equal(second.keptCount, 2);
}

// ── reconcile: a candidate never collides with a protected (teacher) slot ────
{
  const items: ExistingReconcileItem[] = [
    existing({
      id: "teacher",
      scheduledDate: "2026-06-24",
      kind: "teacher_assignment",
      skill: "writing",
      focusArea: "task 2",
      isTeacherAssigned: true,
      referenceKey: "assignment:asg-9",
    }),
  ];
  const candidates: CandidateReconcileItem[] = [
    candidate({
      clientKey: "dup",
      scheduledDate: "2026-06-24",
      kind: "teacher_assignment",
      skill: "writing",
      focusArea: "task 2",
      referenceKey: "assignment:asg-9",
    }),
  ];
  const result = reconcileStudyPlanItems({ existing: items, candidates, today: TODAY });
  assert.deepEqual(result.insertKeys, [], "a candidate matching a protected slot is not re-inserted");
  assert.equal(result.changed, false);
}

// ── reconcile: candidates on/before today are ignored ────────────────────────
{
  const result = reconcileStudyPlanItems({
    existing: [],
    candidates: [
      candidate({ clientKey: "today", scheduledDate: TODAY }),
      candidate({ clientKey: "past", scheduledDate: "2026-06-01" }),
    ],
    today: TODAY,
  });
  assert.deepEqual(result.insertKeys, [], "current-day and past candidates are never inserted");
}

// ── evaluateReplan: materiality ──────────────────────────────────────────────
{
  // Nothing changed → not triggered.
  const flat = evaluateReplan({
    event: "scheduled_pass",
    previous: view(),
    current: view(),
    reconcileChanged: false,
    missedDays: 0,
  });
  assert.equal(flat.triggered, false);
  assert.deepEqual(flat.reasons, []);

  // Band moved ≥0.5 → triggered with band_delta, scheduled pass omits new_evidence.
  const banded = evaluateReplan({
    event: "scheduled_pass",
    previous: view({ overallBand: 5.5 }),
    current: view({ overallBand: 6 }),
    reconcileChanged: false,
    missedDays: 0,
  });
  assert.equal(banded.triggered, true);
  assert(banded.reasons.includes("band_delta"));
  assert(!banded.reasons.includes("new_evidence"));

  // New top weakness on an assessment event → triggered, with new_evidence context.
  const weakness = evaluateReplan({
    event: "writing_scored",
    previous: view({ topWeaknessKey: "reading:matching_headings" }),
    current: view({ topWeaknessKey: "writing:task_response_task2" }),
    reconcileChanged: false,
    missedDays: 0,
  });
  assert.equal(weakness.triggered, true);
  assert(weakness.reasons.includes("new_top_weakness"));
  assert(weakness.reasons.includes("new_evidence"));

  // Missed days alone trigger.
  const missed = evaluateReplan({
    event: "scheduled_pass",
    previous: view(),
    current: view(),
    reconcileChanged: false,
    missedDays: 2,
  });
  assert.equal(missed.triggered, true);
  assert(missed.reasons.includes("missed_days"));

  // Item reschedule alone triggers.
  const rescheduled = evaluateReplan({
    event: "attempt_graded",
    previous: view(),
    current: view(),
    reconcileChanged: true,
    missedDays: 0,
  });
  assert.equal(rescheduled.triggered, true);
  assert(rescheduled.reasons.includes("items_rescheduled"));

  // New evidence WITHOUT a material change does not force a revision.
  const lowSignal = evaluateReplan({
    event: "attempt_graded",
    previous: view(),
    current: view({ overallBand: 6.1 }), // 0.1 < threshold
    reconcileChanged: false,
    missedDays: 0,
  });
  assert.equal(lowSignal.triggered, false);
}

// ── predictionBandDelta: null handling ───────────────────────────────────────
{
  assert.equal(predictionBandDelta(view(), view()), 0);
  // A first band appearing counts as exactly the threshold (finite, material).
  const appeared = predictionBandDelta(
    { overallBand: null, skillBands: ZERO_SKILLS, topWeaknessKey: null },
    view(),
  );
  assert.equal(appeared, 0.5);
  // Largest skill move wins.
  const moved = predictionBandDelta(
    view({ skillBands: { ...ZERO_SKILLS, reading: 5, listening: 6, writing: 6, speaking: 6 } }),
    view({ skillBands: { ...ZERO_SKILLS, reading: 6.5, listening: 6, writing: 6, speaking: 6 } }),
  );
  assert.equal(moved, 1.5);
}

// ── countMissedDays ──────────────────────────────────────────────────────────
{
  const items: ExistingReconcileItem[] = [
    existing({ id: "a", scheduledDate: "2026-06-18" }),
    existing({ id: "b", scheduledDate: "2026-06-18" }), // same day → one missed day
    existing({ id: "c", scheduledDate: "2026-06-19" }),
    existing({ id: "done", scheduledDate: "2026-06-17", status: "completed" }), // not pending
    existing({ id: "today", scheduledDate: TODAY }), // current day not missed
    existing({
      id: "teacher-overdue",
      scheduledDate: "2026-06-15",
      isTeacherAssigned: true,
      kind: "teacher_assignment",
    }), // teacher items are never "missed" by replan
  ];
  assert.equal(countMissedDays(items, TODAY), 2);
}

// ── computeNextReassessmentAt cadence ────────────────────────────────────────
{
  assert.equal(computeNextReassessmentAt("cram", TODAY), "2026-06-22T00:00:00.000Z");
  assert.equal(computeNextReassessmentAt("sprint", TODAY), "2026-06-23T00:00:00.000Z");
  assert.equal(computeNextReassessmentAt("standard", TODAY), "2026-06-24T00:00:00.000Z");
  assert.equal(computeNextReassessmentAt("long_horizon", TODAY), "2026-06-28T00:00:00.000Z");
}

// ── studyPlanModeFromHorizon / daysToTestDate ────────────────────────────────
{
  assert.equal(studyPlanModeFromHorizon(10), "cram");
  assert.equal(studyPlanModeFromHorizon(30), "sprint");
  assert.equal(studyPlanModeFromHorizon(100), "standard");
  assert.equal(studyPlanModeFromHorizon(200), "long_horizon");
  assert.equal(daysToTestDate(TODAY, "2026-07-21"), 30);
  assert.equal(daysToTestDate("2026-07-21", TODAY), 0, "never negative");
}

// ── planItemReferenceKey precedence ──────────────────────────────────────────
{
  assert.equal(
    planItemReferenceKey({ assignment_id: "a", activity_id: "b" }),
    "assignment:a",
    "assignment wins so teacher items match regardless of secondary pointers",
  );
  assert.equal(planItemReferenceKey({ activity_id: "b" }), "activity:b");
  assert.equal(planItemReferenceKey({ ielts_test_id: "t" }), "test:t");
  assert.equal(planItemReferenceKey({ ielts_question_id: "q" }), "question:q");
  assert.equal(planItemReferenceKey({ review_item_id: "r" }), "review:r");
  assert.equal(planItemReferenceKey({}), "none");
}

// ── buildReplanRevisionSummary: shape + bilingual text ───────────────────────
{
  const before: ReplanRevisionView = {
    predictedOverallBand: 5.5,
    predictedSkillBands: { ...ZERO_SKILLS, reading: 5, listening: 6, writing: 5.5, speaking: 6 },
    topWeaknessKey: "reading:matching_headings",
    topWeaknessLabelEn: "Matching headings",
    topWeaknessLabelVi: "Nối tiêu đề",
    pendingFutureItems: 4,
  };
  const after: ReplanRevisionView = {
    predictedOverallBand: 6,
    predictedSkillBands: { ...ZERO_SKILLS, reading: 6, listening: 6, writing: 5.5, speaking: 6 },
    topWeaknessKey: "writing:task_response_task2",
    topWeaknessLabelEn: "Task response",
    topWeaknessLabelVi: "Đáp ứng yêu cầu",
    pendingFutureItems: 5,
  };
  const evaluation = evaluateReplan({
    event: "writing_scored",
    previous: {
      overallBand: before.predictedOverallBand,
      skillBands: before.predictedSkillBands,
      topWeaknessKey: before.topWeaknessKey,
    },
    current: {
      overallBand: after.predictedOverallBand,
      skillBands: after.predictedSkillBands,
      topWeaknessKey: after.topWeaknessKey,
    },
    reconcileChanged: true,
    missedDays: 0,
  });
  const reconcile = reconcileStudyPlanItems({
    existing: [existing({ id: "drop", scheduledDate: "2026-06-25", referenceKey: "activity:old" })],
    candidates: [
      candidate({
        clientKey: "add",
        scheduledDate: "2026-06-25",
        skill: "writing",
        focusArea: "task response",
        referenceKey: "activity:new",
      }),
    ],
    today: TODAY,
  });

  const summary = buildReplanRevisionSummary({
    trigger: "writing_scored",
    evaluation,
    before,
    after,
    reconcile,
  });

  assert.equal(summary.trigger, "writing_scored");
  assert.equal(summary.changes.itemsAdded, 1);
  assert.equal(summary.changes.itemsCancelled, 1);
  assert(summary.reasonEn.includes("5.5 → 6.0"), `EN band move text, got: ${summary.reasonEn}`);
  assert(summary.reasonEn.includes("Task response"), "EN names the new top focus");
  assert(summary.reasonVi.length > 0 && summary.reasonVi !== summary.reasonEn, "VI text present + distinct");
  assert(summary.reasons.includes("items_rescheduled"));
}

console.log("ielts/study-plan/replan.test.ts passed");
