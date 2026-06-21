import { IELTS_SKILLS } from "@/lib/ielts/adaptive/contracts";
import {
  addCalendarDays,
  diffCalendarDays,
  isSameOrBeforeIsoDate,
  isoWeekday,
  listHorizonDates,
} from "./dates";
import { GenerateIeltsStudyPlanInputSchema } from "./schema";
import {
  buildSkillPriorities,
  summarizePrediction,
  weaknessesForPlanning,
} from "./priority";
import {
  diagnosticItem,
  makePriorityItem,
  makeReviewItem,
  makeTeacherAssignmentItem,
} from "./items";
import type {
  GenerateIeltsStudyPlanInput,
  IeltsGeneratedStudyPlan,
  IeltsGeneratedStudyPlanDay,
  IeltsReviewSeed,
  IeltsSkillPriority,
  IeltsStudyPlanMode,
  IeltsTeacherAssignmentSeed,
} from "./types";

function studyPlanMode(daysLeft: number): IeltsStudyPlanMode {
  if (daysLeft <= 13) return "cram";
  if (daysLeft <= 42) return "sprint";
  if (daysLeft <= 120) return "standard";
  return "long_horizon";
}

function maxItemsForMinutes(minutes: number): number {
  if (minutes <= 15) return 2;
  if (minutes <= 45) return 3;
  if (minutes <= 75) return 4;
  return 5;
}

function choosePriority(params: {
  priorities: IeltsSkillPriority[];
  dayIndex: number;
  slotIndex: number;
  sequence: number;
}): IeltsSkillPriority | null {
  const focused = params.priorities.filter((priority) => !priority.isMaintenance);
  const maintenance = params.priorities.filter((priority) => priority.isMaintenance);
  const useMaintenance =
    maintenance.length > 0 && params.dayIndex % 3 === 2 && params.slotIndex > 0;

  if (useMaintenance) return maintenance[params.sequence % maintenance.length] ?? null;
  const pool = focused.length > 0 ? focused : params.priorities;
  return pool[params.sequence % pool.length] ?? null;
}

function dueReviewsForDate(
  reviews: IeltsReviewSeed[],
  date: string,
): IeltsReviewSeed[] {
  return reviews.filter((review) =>
    isSameOrBeforeIsoDate(review.dueAt.slice(0, 10), date),
  );
}

function addFixedAssignments(params: {
  day: IeltsGeneratedStudyPlanDay;
  assignments: IeltsTeacherAssignmentSeed[];
  startDate: string;
  sequenceStart: number;
}): number {
  let sequence = params.sequenceStart;
  for (const assignment of params.assignments) {
    if (assignment.scheduledDate !== params.day.date) continue;
    params.day.items.push(
      makeTeacherAssignmentItem({
        assignment,
        startDate: params.startDate,
        sequence,
      }),
    );
    sequence += 1;
  }
  return sequence;
}

function addReviews(params: {
  day: IeltsGeneratedStudyPlanDay;
  reviews: IeltsReviewSeed[];
  startDate: string;
  sequenceStart: number;
  reviewMinuteCap: number;
}): number {
  let sequence = params.sequenceStart;
  let reviewMinutes = 0;
  for (const review of dueReviewsForDate(params.reviews, params.day.date)) {
    const minutes = review.estimatedMinutes ?? 5;
    if (reviewMinutes + minutes > params.reviewMinuteCap) continue;
    params.day.items.push(
      makeReviewItem({ review, scheduledDate: params.day.date, startDate: params.startDate, sequence }),
    );
    reviewMinutes += minutes;
    sequence += 1;
  }
  return sequence;
}

function buildEmptyDays(params: {
  startDate: string;
  horizonDays: number;
  studyDays: readonly number[];
}): IeltsGeneratedStudyPlanDay[] {
  return listHorizonDates(params.startDate, params.horizonDays).map((date) => ({
    date,
    isoWeekday: isoWeekday(date),
    studyDay: params.studyDays.includes(isoWeekday(date)),
    plannedMinutes: 0,
    items: [],
  }));
}

function fillStudyDay(params: {
  day: IeltsGeneratedStudyPlanDay;
  priorities: IeltsSkillPriority[];
  isEnrolled: boolean;
  module: GenerateIeltsStudyPlanInput["goal"]["module"];
  startDate: string;
  predictionSourceId: string | null;
  maxItems: number;
  dailyMinutes: number;
  dayIndex: number;
  sequenceStart: number;
}): number {
  let sequence = params.sequenceStart;
  let slotIndex = params.day.items.length;
  while (slotIndex < params.maxItems && params.day.plannedMinutes < params.dailyMinutes) {
    const remaining = params.dailyMinutes - params.day.plannedMinutes;
    if (remaining < 5) break;
    const priority = choosePriority({
      priorities: params.priorities,
      dayIndex: params.dayIndex,
      slotIndex,
      sequence,
    });
    if (!priority) break;
    const item = makePriorityItem({
      priority,
      isEnrolled: params.isEnrolled,
      module: params.module,
      scheduledDate: params.day.date,
      startDate: params.startDate,
      sequence,
      remainingMinutes: remaining,
      predictionSourceId: params.predictionSourceId,
    });
    params.day.items.push(item);
    params.day.plannedMinutes += item.estimatedMinutes;
    sequence += 1;
    slotIndex += 1;
  }
  return sequence;
}

function fillDiagnosticDay(params: {
  day: IeltsGeneratedStudyPlanDay;
  startDate: string;
  dailyMinutes: number;
  sequenceStart: number;
}): number {
  const sequence = params.sequenceStart;
  const skill = IELTS_SKILLS[sequence % IELTS_SKILLS.length];
  const item = diagnosticItem({
    skill,
    scheduledDate: params.day.date,
    startDate: params.startDate,
    sequence,
    minutes: params.dailyMinutes,
  });
  params.day.items.push(item);
  params.day.plannedMinutes += item.estimatedMinutes;
  return sequence + 1;
}

export function generateIeltsStudyPlan(
  rawInput: GenerateIeltsStudyPlanInput,
): IeltsGeneratedStudyPlan {
  const input = GenerateIeltsStudyPlanInputSchema.parse(rawInput);
  const prediction = summarizePrediction(input.prediction);
  const learnAtoms = input.isEnrolled ? input.learnAtoms : [];
  const priorities = buildSkillPriorities({
    goal: input.goal,
    prediction: input.prediction,
    weaknesses: weaknessesForPlanning(input.prediction, input.weaknesses),
    learnAtoms,
    startDate: input.startDate,
  });
  const mode = studyPlanMode(diffCalendarDays(input.startDate, input.goal.targetTestDate));
  const days = buildEmptyDays({
    startDate: input.startDate,
    horizonDays: input.horizonDays,
    studyDays: input.goal.availability.studyDays,
  });
  const maxItems = maxItemsForMinutes(input.goal.availability.dailyMinutes);
  const reviewMinuteCap = Math.max(5, Math.floor(input.goal.availability.dailyMinutes * 0.25));
  let sequence = 0;
  let studyDayIndex = 0;

  for (const day of days) {
    sequence = addFixedAssignments({
      day,
      assignments: input.teacherAssignments,
      startDate: input.startDate,
      sequenceStart: sequence,
    });
    if (!day.studyDay) continue;
    sequence = addReviews({
      day,
      reviews: input.dueReviews,
      startDate: input.startDate,
      sequenceStart: sequence,
      reviewMinuteCap,
    });
    day.plannedMinutes = day.items.reduce((sum, item) => sum + item.estimatedMinutes, 0);
    sequence =
      priorities.length > 0
        ? fillStudyDay({
            day,
            priorities,
            isEnrolled: input.isEnrolled,
            module: input.goal.module,
            startDate: input.startDate,
            predictionSourceId: prediction.sourceId,
            maxItems,
            dailyMinutes: input.goal.availability.dailyMinutes,
            dayIndex: studyDayIndex,
            sequenceStart: sequence,
          })
        : fillDiagnosticDay({
            day,
            startDate: input.startDate,
            dailyMinutes: input.goal.availability.dailyMinutes,
            sequenceStart: sequence,
          });
    studyDayIndex += 1;
  }

  const items = days.flatMap((day) => day.items);
  return {
    goal: input.goal,
    prediction,
    mode,
    horizon: {
      startDate: input.startDate,
      endDate: addCalendarDays(input.startDate, input.horizonDays - 1),
      days: input.horizonDays,
    },
    skillPriorities: priorities,
    days,
    items,
    today: items.filter((item) => item.scheduledDate === input.startDate),
    rationale: {
      en: `Plan generated from ${priorities.length} weakness signals using target gaps, confidence, urgency, content availability, and declared focus.`,
      vi: `Kế hoạch được tạo từ ${priorities.length} tín hiệu điểm yếu, dựa trên khoảng cách mục tiêu, độ tin cậy, độ gấp, nội dung sẵn có và kỹ năng trọng tâm đã khai báo.`,
    },
  };
}
