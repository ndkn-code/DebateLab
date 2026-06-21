/**
 * Pure section builders for the IELTS study-plan page view-model (WS-6.2.2).
 *
 * Each function maps the raw rows + prediction into one display section. The
 * orchestrator in `page-view.ts` composes them. No DB or React here.
 */
import {
  IELTS_SKILLS,
  type IeltsBandPrediction,
  type IeltsGoalModel,
  type IeltsSkill,
  type IeltsWeaknessSignal,
} from "@/lib/ielts/adaptive/contracts";
import { confidencePercent } from "@/lib/ielts/onboarding/model";
import type { Json } from "@/types/supabase";
import { addCalendarDays, isoWeekday, listHorizonDates } from "./dates";
import type {
  BuildIeltsStudyPlanPageViewInput,
  IeltsStudyPlanItemView,
  IeltsStudyPlanPageView,
  IeltsStudyPlanReassessmentMockView,
  IeltsStudyPlanReviewView,
  IeltsStudyPlanRevisionView,
  IeltsStudyPlanSkillGapView,
  IeltsStudyPlanWeaknessView,
  IeltsStudyPlanWeekView,
  StudyPlanItemRow,
  StudyPlanRevisionRow,
  StudyPlanReviewRow,
  StudyPlanRow,
} from "./page-view-types";

const MAX_WEAKNESSES = 6;
const MAX_REVIEW_LIST = 24;
const COMPLETE_STATUSES = new Set(["completed"]);
const RESOLVED_STATUSES = new Set(["completed", "skipped", "cancelled"]);
const SEVERITY_RANK: Record<string, number> = { critical: 3, weak: 2, watch: 1 };

function isRecord(value: Json | undefined): value is { [key: string]: Json } {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function jsonString(metadata: Json, key: string): string | null {
  if (!isRecord(metadata)) return null;
  const value = metadata[key];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

export function nestedRationale(explanation: Json, lang: "en" | "vi"): string | null {
  if (!isRecord(explanation)) return null;
  const rationale = explanation.rationale;
  if (!isRecord(rationale)) return null;
  const value = rationale[lang];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function toItemView(item: StudyPlanItemRow): IeltsStudyPlanItemView {
  return {
    id: item.id,
    kind: item.kind,
    status: item.status,
    skill: item.skill,
    focusArea: item.focus_area,
    titleEn: jsonString(item.metadata, "titleEn") ?? item.focus_area,
    titleVi: jsonString(item.metadata, "titleVi") ?? item.focus_area,
    rationaleEn: item.rationale_en,
    rationaleVi: item.rationale_vi,
    estimatedMinutes: item.estimated_minutes,
    priorityScore: item.priority_score,
    sourceWeaknessKeys: item.source_weakness_keys ?? [],
    scheduledDate: item.scheduled_date,
    isComplete: COMPLETE_STATUSES.has(item.status),
  };
}

function byPriorityDesc(a: IeltsStudyPlanItemView, b: IeltsStudyPlanItemView): number {
  return b.priorityScore - a.priorityScore;
}

function skillTarget(goal: IeltsGoalModel, skill: IeltsSkill): number | null {
  return goal.targetSkillBands[skill] ?? goal.targetOverallBand ?? null;
}

function roundHalf(value: number): number {
  return Math.round(value * 10) / 10;
}

export function buildSkillGaps(
  prediction: IeltsBandPrediction,
  goal: IeltsGoalModel | null,
): IeltsStudyPlanSkillGapView[] {
  return IELTS_SKILLS.map((skill) => {
    const estimate = prediction.skills[skill];
    const predictedBand = estimate.band;
    const targetBand = goal ? skillTarget(goal, skill) : null;
    const gapBands =
      predictedBand !== null && targetBand !== null
        ? Math.max(0, roundHalf(targetBand - predictedBand))
        : null;
    return {
      skill,
      predictedBand,
      targetBand,
      gapBands,
      isFocus: goal?.focusSkills?.includes(skill) ?? false,
      status: estimate.status,
    };
  });
}

function toWeaknessView(signal: IeltsWeaknessSignal): IeltsStudyPlanWeaknessView {
  return {
    key: signal.key,
    skill: signal.skill,
    labelEn: signal.labelEn,
    labelVi: signal.labelVi,
    severity: signal.severity,
    reasonEn: signal.reasonEn,
    reasonVi: signal.reasonVi,
    currentBand: signal.currentValue,
    targetBand: signal.targetValue,
    confidencePercent: confidencePercent(signal.confidence),
  };
}

export function topWeaknesses(
  weaknesses: IeltsWeaknessSignal[],
): IeltsStudyPlanWeaknessView[] {
  return [...weaknesses]
    .sort((a, b) => {
      const severity = (SEVERITY_RANK[b.severity] ?? 0) - (SEVERITY_RANK[a.severity] ?? 0);
      if (severity !== 0) return severity;
      return b.confidence - a.confidence;
    })
    .slice(0, MAX_WEAKNESSES)
    .map(toWeaknessView);
}

export function buildCalendar(
  input: BuildIeltsStudyPlanPageViewInput,
  horizonDays: number,
  studyDays: number[],
): IeltsStudyPlanPageView["calendar"] {
  const startDate = input.todayIso;
  const endDate = addCalendarDays(startDate, horizonDays - 1);
  const studyDaySet = new Set(studyDays);

  const itemsByDate = new Map<string, IeltsStudyPlanItemView[]>();
  for (const row of input.items) {
    const view = toItemView(row);
    const bucket = itemsByDate.get(view.scheduledDate) ?? [];
    bucket.push(view);
    itemsByDate.set(view.scheduledDate, bucket);
  }

  const days = listHorizonDates(startDate, horizonDays).map((date) => {
    const weekday = isoWeekday(date);
    const dayItems = (itemsByDate.get(date) ?? []).sort(byPriorityDesc);
    return {
      date,
      isoWeekday: weekday,
      isStudyDay: studyDaySet.has(weekday),
      isToday: date === input.todayIso,
      plannedMinutes: dayItems.reduce((sum, item) => sum + item.estimatedMinutes, 0),
      completedMinutes: dayItems
        .filter((item) => item.isComplete)
        .reduce((sum, item) => sum + item.estimatedMinutes, 0),
      items: dayItems,
    };
  });

  const overdue = input.items
    .filter(
      (item) =>
        item.scheduled_date < input.todayIso && !RESOLVED_STATUSES.has(item.status),
    )
    .map(toItemView)
    .sort((a, b) =>
      a.scheduledDate === b.scheduledDate
        ? byPriorityDesc(a, b)
        : a.scheduledDate < b.scheduledDate
          ? -1
          : 1,
    );

  return {
    startDate,
    endDate,
    horizonDays,
    days,
    totalPlannedMinutes: days.reduce((sum, day) => sum + day.plannedMinutes, 0),
    totalItemCount: days.reduce((sum, day) => sum + day.items.length, 0),
    overdue,
  };
}

function tally<K extends string>(
  entries: Array<{ key: K; minutes: number }>,
): Array<{ key: K; count: number; minutes: number }> {
  const map = new Map<K, { count: number; minutes: number }>();
  for (const entry of entries) {
    const current = map.get(entry.key) ?? { count: 0, minutes: 0 };
    current.count += 1;
    current.minutes += entry.minutes;
    map.set(entry.key, current);
  }
  return [...map.entries()].map(([key, value]) => ({ key, ...value }));
}

export function buildWeeklyForecast(
  days: IeltsStudyPlanPageView["calendar"]["days"],
): IeltsStudyPlanWeekView[] {
  const weeks: IeltsStudyPlanWeekView[] = [];
  for (let start = 0; start < days.length; start += 7) {
    const chunk = days.slice(start, start + 7);
    if (chunk.length === 0) continue;
    const items = chunk.flatMap((day) => day.items);
    const byKind = tally(
      items.map((item) => ({ key: item.kind, minutes: item.estimatedMinutes })),
    ).map(({ key, count, minutes }) => ({ kind: key, count, minutes }));
    const bySkill = tally(
      items.map((item) => ({ key: item.skill, minutes: item.estimatedMinutes })),
    ).map(({ key, count, minutes }) => ({ skill: key, count, minutes }));
    weeks.push({
      index: weeks.length + 1,
      startDate: chunk[0].date,
      endDate: chunk[chunk.length - 1].date,
      studyDayCount: chunk.filter((day) => day.isStudyDay).length,
      plannedMinutes: chunk.reduce((sum, day) => sum + day.plannedMinutes, 0),
      itemCount: items.length,
      byKind,
      bySkill,
    });
  }
  return weeks;
}

export function buildReviewQueue(
  reviews: StudyPlanReviewRow[],
  now: string,
  todayIso: string,
): IeltsStudyPlanPageView["reviewQueue"] {
  const due: IeltsStudyPlanReviewView[] = [];
  const upcoming: IeltsStudyPlanReviewView[] = [];
  const sorted = [...reviews].sort((a, b) =>
    a.due_at < b.due_at ? -1 : a.due_at > b.due_at ? 1 : 0,
  );
  for (const review of sorted) {
    const view: IeltsStudyPlanReviewView = {
      id: review.id,
      skill: review.skill,
      focusArea: review.focus_area,
      reviewKind: review.review_kind,
      promptEn: review.prompt_en,
      promptVi: review.prompt_vi,
      dueAt: review.due_at,
      isOverdue: review.due_at.slice(0, 10) < todayIso,
      state: review.state,
    };
    if (review.due_at <= now) due.push(view);
    else upcoming.push(view);
  }
  return {
    dueCount: due.length,
    upcomingCount: upcoming.length,
    due: due.slice(0, MAX_REVIEW_LIST),
    upcoming: upcoming.slice(0, MAX_REVIEW_LIST),
  };
}

export function buildReassessment(
  items: StudyPlanItemRow[],
  nextReassessmentAt: string | null,
  todayIso: string,
): IeltsStudyPlanPageView["reassessment"] {
  const mocks = items
    .filter(
      (item) =>
        item.kind === "skill_drill" ||
        item.kind === "mini_mock" ||
        item.kind === "full_mock",
    )
    .map((item): IeltsStudyPlanReassessmentMockView => {
      const view = toItemView(item);
      return {
        id: view.id,
        kind: item.kind as "skill_drill" | "mini_mock" | "full_mock",
        skill: view.skill,
        scheduledDate: view.scheduledDate,
        titleEn: view.titleEn,
        titleVi: view.titleVi,
        rationaleEn: view.rationaleEn,
        rationaleVi: view.rationaleVi,
        isPast: view.scheduledDate < todayIso,
      };
    })
    .sort((a, b) =>
      a.scheduledDate < b.scheduledDate ? -1 : a.scheduledDate > b.scheduledDate ? 1 : 0,
    );
  return { nextReassessmentAt, mocks };
}

export function toRevisionView(row: StudyPlanRevisionRow): IeltsStudyPlanRevisionView {
  return {
    id: row.id,
    fromVersion: row.from_version,
    toVersion: row.to_version,
    triggerType: row.trigger_type,
    triggerSourceType: row.trigger_source_type,
    summaryEn: row.summary_en,
    summaryVi: row.summary_vi,
    changedItemCount: row.changed_item_count,
    createdAt: row.created_at,
  };
}

export function buildPrediction(
  prediction: IeltsBandPrediction,
  goal: IeltsGoalModel | null,
): IeltsStudyPlanPageView["prediction"] {
  return {
    overallBand: prediction.overall.band,
    lower: prediction.overall.lower,
    upper: prediction.overall.upper,
    status: prediction.overall.status,
    confidencePercent: confidencePercent(prediction.overall.confidence),
    trendDirection: prediction.overall.trend.direction,
    asOf: prediction.asOf,
    skills: buildSkillGaps(prediction, goal),
  };
}

export function buildReasoning(
  prediction: IeltsBandPrediction,
  plan: StudyPlanRow | null,
): IeltsStudyPlanPageView["reasoning"] {
  return {
    planRationaleEn: plan ? nestedRationale(plan.explanation, "en") : null,
    planRationaleVi: plan ? nestedRationale(plan.explanation, "vi") : null,
    weaknesses: topWeaknesses(prediction.weaknesses),
    nextBestDiagnosticEn: prediction.nextBestDiagnostic.reasonEn,
    nextBestDiagnosticVi: prediction.nextBestDiagnostic.reasonVi,
    limitations: prediction.limitations,
  };
}
