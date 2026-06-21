/**
 * WS-6.2.4 — Adaptive study-plan REPLAN (pure core).
 *
 * Server-authoritative adaptation. When new evidence lands (an attempt is
 * graded, Writing/Speaking is scored, or a scheduled pass runs) the plan's
 * FUTURE pending items are reconciled against a freshly generated plan:
 *
 *   - PRESERVE  past + current-day items, started/completed/missed/skipped/
 *               cancelled items, and teacher-assigned items (any date).
 *   - CANCEL    future, unstarted, non-teacher items that the new plan no
 *               longer schedules.
 *   - INSERT    newly scheduled future items.
 *
 * Everything here is pure and dependency-free (no DB, no `server-only`) so the
 * decision logic is unit-tested without a database — engine-purity (§2.7). The
 * repository (`lib/api/ielts/study-plan-repository`) maps DB rows / insert rows
 * into these projections, applies the result, and writes the revision row.
 *
 * Idempotency is CONTENT-based, not id-based: the prediction's synthetic
 * snapshot id changes on every call (`asOf` defaults to now), so a replan that
 * regenerates the same items produces an empty reconcile and writes nothing.
 */
import type {
  IeltsPlanAtomKind,
  IeltsSkill,
} from "@/lib/ielts/adaptive/contracts";
import { addCalendarDays, diffCalendarDays } from "./dates";
import type { IeltsPlanItemStatus, IeltsStudyPlanMode } from "./types";

// ── Triggers + reasons ──────────────────────────────────────────────────────

/** What kicked off the replan. Mirrors the DB enum `ielts_study_plan_revision_trigger`. */
export const REPLAN_TRIGGER_EVENTS = [
  "attempt_graded",
  "writing_scored",
  "speaking_scored",
  "learn_activity",
  "scheduled_pass",
  "manual",
] as const;
export type ReplanTriggerEvent = (typeof REPLAN_TRIGGER_EVENTS)[number];

/** Why the replan was judged material (≥1 present whenever a revision is written). */
export const REPLAN_REASONS = [
  "new_evidence",
  "band_delta",
  "new_top_weakness",
  "missed_days",
  "items_rescheduled",
] as const;
export type ReplanReason = (typeof REPLAN_REASONS)[number];

/** A predicted-band move of ≥0.5 (one half-band) is the materiality threshold. */
export const REPLAN_BAND_DELTA_THRESHOLD = 0.5;
/** This many past-due unstarted items triggers a reschedule. */
export const REPLAN_MISSED_DAYS_THRESHOLD = 2;

/** Days between scheduled reassessment passes, by plan tempo. */
const REASSESSMENT_CADENCE_DAYS: Record<IeltsStudyPlanMode, number> = {
  cram: 1,
  sprint: 2,
  standard: 3,
  long_horizon: 7,
};

const PENDING_STATUSES: ReadonlySet<IeltsPlanItemStatus> = new Set([
  "scheduled",
  "available",
]);

// ── Item projections (what the repo maps DB rows / inserts into) ─────────────

/** The FK pointer columns shared by persisted rows and candidate insert rows. */
export interface PlanItemReferenceColumns {
  assignment_id?: string | null;
  activity_id?: string | null;
  ielts_test_id?: string | null;
  ielts_question_id?: string | null;
  review_item_id?: string | null;
}

/** A persisted plan item, projected to only what reconcile needs. */
export interface ExistingReconcileItem {
  id: string;
  status: IeltsPlanItemStatus;
  kind: IeltsPlanAtomKind;
  scheduledDate: string;
  skill: IeltsSkill;
  focusArea: string;
  titleEn: string;
  titleVi: string;
  referenceKey: string;
  isTeacherAssigned: boolean;
}

/** A freshly generated insert candidate, projected to only what reconcile needs. */
export interface CandidateReconcileItem {
  clientKey: string;
  kind: IeltsPlanAtomKind;
  scheduledDate: string;
  skill: IeltsSkill;
  focusArea: string;
  titleEn: string;
  titleVi: string;
  referenceKey: string;
}

/** A compact descriptor of an added/removed item, stored in the revision summary. */
export interface ReplanItemDigest {
  scheduledDate: string;
  skill: IeltsSkill;
  kind: IeltsPlanAtomKind;
  titleEn: string;
  titleVi: string;
}

export interface StudyPlanReconcileResult {
  /** Protected existing item ids (left untouched). */
  preservedIds: string[];
  /** Future-pending existing item ids that still match the new plan. */
  keptIds: string[];
  /** Future-pending existing item ids to cancel/remove. */
  cancelIds: string[];
  /** Candidate clientKeys to insert. */
  insertKeys: string[];
  cancelled: ReplanItemDigest[];
  inserted: ReplanItemDigest[];
  keptCount: number;
  changed: boolean;
}

// ── Signatures + reference keys ──────────────────────────────────────────────

/**
 * Stable identity for a plan item: same (date, kind, skill, focus, target) ⇒
 * same item. Deliberately excludes priority/minutes/rationale so tiny scoring
 * drift does not churn the schedule.
 */
function itemSignature(item: {
  scheduledDate: string;
  kind: IeltsPlanAtomKind;
  skill: IeltsSkill;
  focusArea: string;
  referenceKey: string;
}): string {
  const focus = item.focusArea.trim().toLowerCase();
  return [item.scheduledDate, item.kind, item.skill, focus, item.referenceKey].join(
    "|",
  );
}

/**
 * Resolve a pointer-column bag into a stable reference key. Both persisted rows
 * and candidate insert rows carry the same columns, so identical targets yield
 * identical keys (the basis for idempotent matching). Assignment wins first so
 * teacher items match regardless of any secondary pointer.
 */
export function planItemReferenceKey(cols: PlanItemReferenceColumns): string {
  if (cols.assignment_id) return `assignment:${cols.assignment_id}`;
  if (cols.activity_id) return `activity:${cols.activity_id}`;
  if (cols.ielts_test_id) return `test:${cols.ielts_test_id}`;
  if (cols.ielts_question_id) return `question:${cols.ielts_question_id}`;
  if (cols.review_item_id) return `review:${cols.review_item_id}`;
  return "none";
}

// ── Reconcile ────────────────────────────────────────────────────────────────

function toDigest(
  item: ExistingReconcileItem | CandidateReconcileItem,
): ReplanItemDigest {
  return {
    scheduledDate: item.scheduledDate,
    skill: item.skill,
    kind: item.kind,
    titleEn: item.titleEn,
    titleVi: item.titleVi,
  };
}

/**
 * Status-aware reconcile of existing items against the regenerated plan.
 *
 * Protected (never touched): past + current-day items (`scheduledDate <= today`),
 * non-pending items (started/completed/missed/skipped/cancelled), and
 * teacher-assigned items on any date. Only strictly-future, unstarted,
 * non-teacher candidates are considered for insert, and they never collide with
 * a protected slot's signature.
 */
export function reconcileStudyPlanItems(params: {
  existing: ExistingReconcileItem[];
  candidates: CandidateReconcileItem[];
  today: string;
}): StudyPlanReconcileResult {
  const { existing, today } = params;

  const isProtected = (item: ExistingReconcileItem): boolean =>
    item.scheduledDate <= today ||
    item.isTeacherAssigned ||
    !PENDING_STATUSES.has(item.status);

  const protectedItems = existing.filter(isProtected);
  const futurePending = existing.filter((item) => !isProtected(item));

  const protectedSignatures = new Set(protectedItems.map(itemSignature));

  // Candidates: strictly future, de-duplicated by signature, never colliding
  // with a protected slot (e.g. a teacher item or work already started today).
  const seenCandidate = new Set<string>();
  const consideredCandidates: CandidateReconcileItem[] = [];
  for (const candidate of params.candidates) {
    if (candidate.scheduledDate <= today) continue;
    const signature = itemSignature(candidate);
    if (protectedSignatures.has(signature)) continue;
    if (seenCandidate.has(signature)) continue;
    seenCandidate.add(signature);
    consideredCandidates.push(candidate);
  }

  const futureSignatures = new Set(futurePending.map(itemSignature));

  const cancelled = futurePending.filter(
    (item) => !seenCandidate.has(itemSignature(item)),
  );
  const kept = futurePending.filter((item) =>
    seenCandidate.has(itemSignature(item)),
  );
  const inserted = consideredCandidates.filter(
    (candidate) => !futureSignatures.has(itemSignature(candidate)),
  );

  return {
    preservedIds: protectedItems.map((item) => item.id),
    keptIds: kept.map((item) => item.id),
    cancelIds: cancelled.map((item) => item.id),
    insertKeys: inserted.map((candidate) => candidate.clientKey),
    cancelled: cancelled.map(toDigest),
    inserted: inserted.map(toDigest),
    keptCount: kept.length,
    changed: cancelled.length > 0 || inserted.length > 0,
  };
}

// ── Trigger evaluation ───────────────────────────────────────────────────────

const SKILL_ORDER: readonly IeltsSkill[] = [
  "listening",
  "reading",
  "writing",
  "speaking",
];

export interface ReplanPredictionView {
  overallBand: number | null;
  skillBands: Record<IeltsSkill, number | null>;
  topWeaknessKey: string | null;
}

export interface ReplanEvaluationInput {
  event: ReplanTriggerEvent;
  previous: ReplanPredictionView;
  current: ReplanPredictionView;
  reconcileChanged: boolean;
  missedDays: number;
}

export interface ReplanEvaluation {
  triggered: boolean;
  reasons: ReplanReason[];
  bandDelta: number;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function pairDelta(a: number | null, b: number | null): number {
  if (a == null && b == null) return 0;
  // A band appearing or disappearing is material; count it as exactly the
  // threshold so the delta stays finite for storage/rendering.
  if (a == null || b == null) return REPLAN_BAND_DELTA_THRESHOLD;
  return Math.abs(a - b);
}

/** Largest half-band move across overall + the four skills. */
export function predictionBandDelta(
  previous: ReplanPredictionView,
  current: ReplanPredictionView,
): number {
  let max = pairDelta(previous.overallBand, current.overallBand);
  for (const skill of SKILL_ORDER) {
    max = Math.max(
      max,
      pairDelta(previous.skillBands[skill], current.skillBands[skill]),
    );
  }
  return round1(max);
}

/**
 * Decide whether a replan is material enough to mutate the plan + log a
 * revision. A change is material when the schedule actually changed, the
 * predicted band moved ≥0.5, the top weakness changed, or enough days were
 * missed. New evidence alone (a low-signal micro-attempt) is recorded as
 * context but never forces a revision on its own.
 */
export function evaluateReplan(input: ReplanEvaluationInput): ReplanEvaluation {
  const bandDelta = predictionBandDelta(input.previous, input.current);
  const topWeaknessChanged =
    input.current.topWeaknessKey != null &&
    input.current.topWeaknessKey !== input.previous.topWeaknessKey;
  const bandMoved = bandDelta >= REPLAN_BAND_DELTA_THRESHOLD;
  const missed = input.missedDays >= REPLAN_MISSED_DAYS_THRESHOLD;

  const triggered =
    input.reconcileChanged || bandMoved || topWeaknessChanged || missed;

  const reasons: ReplanReason[] = [];
  if (input.event !== "scheduled_pass") reasons.push("new_evidence");
  if (bandMoved) reasons.push("band_delta");
  if (topWeaknessChanged) reasons.push("new_top_weakness");
  if (missed) reasons.push("missed_days");
  if (input.reconcileChanged) reasons.push("items_rescheduled");

  return { triggered, reasons, bandDelta };
}

// ── Revision summary ─────────────────────────────────────────────────────────

export interface ReplanRevisionView {
  predictedOverallBand: number | null;
  predictedSkillBands: Record<IeltsSkill, number | null>;
  topWeaknessKey: string | null;
  topWeaknessLabelEn: string | null;
  topWeaknessLabelVi: string | null;
  pendingFutureItems: number;
}

export interface IeltsStudyPlanRevisionSummary {
  trigger: ReplanTriggerEvent;
  reasons: ReplanReason[];
  bandDelta: number;
  reasonEn: string;
  reasonVi: string;
  before: ReplanRevisionView;
  after: ReplanRevisionView;
  changes: {
    itemsAdded: number;
    itemsCancelled: number;
    itemsKept: number;
    added: ReplanItemDigest[];
    cancelled: ReplanItemDigest[];
  };
}

const TRIGGER_LEAD_EN: Record<ReplanTriggerEvent, string> = {
  attempt_graded: "After your latest mock result",
  writing_scored: "After your Writing result",
  speaking_scored: "After your Speaking result",
  learn_activity: "After your latest practice",
  scheduled_pass: "During your scheduled plan review",
  manual: "After a manual plan refresh",
};

const TRIGGER_LEAD_VI: Record<ReplanTriggerEvent, string> = {
  attempt_graded: "Sau kết quả thi thử mới nhất",
  writing_scored: "Sau kết quả Writing",
  speaking_scored: "Sau kết quả Speaking",
  learn_activity: "Sau bài luyện mới nhất",
  scheduled_pass: "Trong lần rà soát kế hoạch định kỳ",
  manual: "Sau khi làm mới kế hoạch thủ công",
};

function bandText(band: number | null): string {
  return band == null ? "—" : band.toFixed(1);
}

function buildReasonEn(
  trigger: ReplanTriggerEvent,
  before: ReplanRevisionView,
  after: ReplanRevisionView,
  added: number,
  cancelled: number,
): string {
  const parts: string[] = [];
  if (before.predictedOverallBand !== after.predictedOverallBand) {
    parts.push(
      `predicted band moved ${bandText(before.predictedOverallBand)} → ${bandText(after.predictedOverallBand)}`,
    );
  }
  if (after.topWeaknessKey && after.topWeaknessKey !== before.topWeaknessKey) {
    parts.push(`top focus is now ${after.topWeaknessLabelEn ?? after.topWeaknessKey}`);
  }
  if (added > 0 || cancelled > 0) {
    parts.push(`added ${added} task(s), removed ${cancelled}`);
  }
  const body = parts.length > 0 ? parts.join("; ") : "your plan is on track";
  return `${TRIGGER_LEAD_EN[trigger]}, ${body}.`;
}

function buildReasonVi(
  trigger: ReplanTriggerEvent,
  before: ReplanRevisionView,
  after: ReplanRevisionView,
  added: number,
  cancelled: number,
): string {
  const parts: string[] = [];
  if (before.predictedOverallBand !== after.predictedOverallBand) {
    parts.push(
      `band dự đoán thay đổi ${bandText(before.predictedOverallBand)} → ${bandText(after.predictedOverallBand)}`,
    );
  }
  if (after.topWeaknessKey && after.topWeaknessKey !== before.topWeaknessKey) {
    parts.push(`trọng tâm mới là ${after.topWeaknessLabelVi ?? after.topWeaknessKey}`);
  }
  if (added > 0 || cancelled > 0) {
    parts.push(`thêm ${added} mục, bỏ ${cancelled} mục`);
  }
  const body = parts.length > 0 ? parts.join("; ") : "kế hoạch của bạn vẫn đúng hướng";
  return `${TRIGGER_LEAD_VI[trigger]}, ${body}.`;
}

/** Assemble the bilingual before/after revision summary the plan page renders. */
export function buildReplanRevisionSummary(params: {
  trigger: ReplanTriggerEvent;
  evaluation: ReplanEvaluation;
  before: ReplanRevisionView;
  after: ReplanRevisionView;
  reconcile: StudyPlanReconcileResult;
}): IeltsStudyPlanRevisionSummary {
  const { trigger, evaluation, before, after, reconcile } = params;
  const itemsAdded = reconcile.inserted.length;
  const itemsCancelled = reconcile.cancelled.length;

  return {
    trigger,
    reasons: evaluation.reasons,
    bandDelta: evaluation.bandDelta,
    reasonEn: buildReasonEn(trigger, before, after, itemsAdded, itemsCancelled),
    reasonVi: buildReasonVi(trigger, before, after, itemsAdded, itemsCancelled),
    before,
    after,
    changes: {
      itemsAdded,
      itemsCancelled,
      itemsKept: reconcile.keptCount,
      added: reconcile.inserted,
      cancelled: reconcile.cancelled,
    },
  };
}

// ── Scheduling ───────────────────────────────────────────────────────────────

/**
 * When the next scheduled reassessment is due, by plan tempo. Returns an ISO
 * datetime (UTC midnight) so the nightly cron's `next_reassessment_at <= now()`
 * filter picks it up the following day.
 */
export function computeNextReassessmentAt(
  mode: IeltsStudyPlanMode,
  fromIsoDate: string,
): string {
  const cadence = REASSESSMENT_CADENCE_DAYS[mode];
  return `${addCalendarDays(fromIsoDate, cadence)}T00:00:00.000Z`;
}

/**
 * Count distinct past-due days that still hold unstarted work — the "missed
 * days" signal. Current-day and future items never count.
 */
export function countMissedDays(
  existing: ExistingReconcileItem[],
  today: string,
): number {
  const missedDates = new Set<string>();
  for (const item of existing) {
    if (
      item.scheduledDate < today &&
      PENDING_STATUSES.has(item.status) &&
      !item.isTeacherAssigned
    ) {
      missedDates.add(item.scheduledDate);
    }
  }
  return missedDates.size;
}

/** Map a plan's day-horizon to a tempo, mirroring the generator's thresholds. */
export function studyPlanModeFromHorizon(daysToTest: number): IeltsStudyPlanMode {
  if (daysToTest <= 13) return "cram";
  if (daysToTest <= 42) return "sprint";
  if (daysToTest <= 120) return "standard";
  return "long_horizon";
}

/** Days from `today` to the target test date (never negative). */
export function daysToTestDate(today: string, targetTestDate: string): number {
  return Math.max(0, diffCalendarDays(today, targetTestDate));
}
