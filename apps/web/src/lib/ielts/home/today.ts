/**
 * Pure "Today" view-model for the IELTS home dashboard (WS-6.2.1).
 *
 * The home reads the active study plan + its persisted items (RLS-own, via
 * `loadActiveIeltsStudyPlan`) and overlays them with the current date to compute
 * the learner's "Today" list — the small, prioritized set of tasks they should
 * act on now. This module is pure (no DB / no server imports): the repository
 * resolves mock-test slugs and hands them in, and these functions decide which
 * items surface, in what order, and where each one launches.
 *
 * Design (study-plan-engine.md WS-C.8): show 2–5 prioritized tasks, each with a
 * skill, kind, estimated minutes, a learner-language rationale, and a CTA that
 * launches the underlying activity / mock / review. Overdue actionable items are
 * still surfaced (a returning learner whose plan was generated days ago should
 * not see an empty day before the replan backend lands in 6.2.4).
 */
import type { Tables } from "@/types/supabase";
import type { IeltsSkill } from "@/lib/ielts/adaptive/contracts";

export type IeltsPlanItemRow = Tables<"ielts_study_plan_items">;
export type IeltsPlanItemKind = IeltsPlanItemRow["kind"];
export type IeltsPlanItemStatus = IeltsPlanItemRow["status"];

/** Plan-item statuses that are still actionable (a learner can start them). */
const ACTIONABLE_STATUSES: ReadonlySet<IeltsPlanItemStatus> = new Set([
  "scheduled",
  "available",
  "started",
]);

/** Default size of the Today list; the engine keeps the day small. */
export const DEFAULT_TODAY_LIMIT = 4;
const MAX_TODAY_LIMIT = 5;

/** IELTS learner routes the Today CTAs launch into. */
export const IELTS_ROUTES = {
  mock: (slug: string) => `/ielts/mock/${slug}`,
  tests: "/ielts/tests",
  assigned: "/ielts/assigned",
  learn: "/ielts/learn",
  studyPlan: "/ielts/study-plan",
  onboarding: "/ielts/onboarding",
} as const;

export interface TodayLaunchContext {
  /** Published-test slug keyed by `ielts_test_id`, for mock/W-S launches. */
  testSlugById: ReadonlyMap<string, string>;
}

export interface IeltsTodayItemView {
  id: string;
  skill: IeltsSkill;
  kind: IeltsPlanItemKind;
  status: IeltsPlanItemStatus;
  focusArea: string;
  estimatedMinutes: number;
  priorityScore: number;
  scheduledDate: string;
  isOverdue: boolean;
  titleEn: string;
  titleVi: string;
  rationaleEn: string;
  rationaleVi: string;
  /** Where the CTA sends the learner to actually do this task. */
  launchHref: string;
}

export interface IeltsTodaySelection {
  /** Capped, ordered items to render in the Today list. */
  items: IeltsPlanItemRow[];
  /** Every actionable item considered (due/overdue + upcoming). */
  totalActionable: number;
  /** Actionable items scheduled for today or earlier. */
  dueCount: number;
  /** How many actionable items are hidden behind the cap (>= 0). */
  overflowCount: number;
}

function clampLimit(limit: number): number {
  if (!Number.isFinite(limit)) return DEFAULT_TODAY_LIMIT;
  return Math.max(1, Math.min(MAX_TODAY_LIMIT, Math.floor(limit)));
}

function isActionable(item: IeltsPlanItemRow): boolean {
  return ACTIONABLE_STATUSES.has(item.status);
}

/** An item is "due" when scheduled for today or any earlier day (overdue). */
function isDueOnOrBefore(item: IeltsPlanItemRow, today: string): boolean {
  return item.scheduled_date <= today;
}

/**
 * Order: due/overdue first (earliest scheduled, then highest priority), then
 * upcoming (soonest scheduled, then highest priority). Stable & deterministic.
 */
function compareForToday(
  a: IeltsPlanItemRow,
  b: IeltsPlanItemRow,
  today: string,
): number {
  const aDue = isDueOnOrBefore(a, today);
  const bDue = isDueOnOrBefore(b, today);
  if (aDue !== bDue) return aDue ? -1 : 1;
  if (a.scheduled_date !== b.scheduled_date) {
    return a.scheduled_date < b.scheduled_date ? -1 : 1;
  }
  if (a.priority_score !== b.priority_score) {
    return b.priority_score - a.priority_score;
  }
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Pick the prioritized Today items from all of an active plan's persisted items.
 * Due/overdue actionable items win slots before upcoming ones.
 */
export function selectTodayPlanItems(
  items: readonly IeltsPlanItemRow[],
  options: { today: string; limit?: number },
): IeltsTodaySelection {
  const limit = clampLimit(options.limit ?? DEFAULT_TODAY_LIMIT);
  const actionable = items.filter(isActionable);
  const ordered = [...actionable].sort((a, b) =>
    compareForToday(a, b, options.today),
  );
  const dueCount = actionable.filter((item) =>
    isDueOnOrBefore(item, options.today),
  ).length;
  const picked = ordered.slice(0, limit);
  return {
    items: picked,
    totalActionable: actionable.length,
    dueCount,
    overflowCount: Math.max(0, actionable.length - picked.length),
  };
}

/**
 * Resolve where a plan item's CTA launches. Mock-shaped items launch into the
 * mock player when their test slug resolves; teacher assignments into the
 * assigned-tests surface; Learn atoms into the Learn path; reviews into the
 * study-plan review queue. Falls back to the library / plan when a pointer can't
 * be resolved so the CTA is never dead.
 */
export function planItemLaunchHref(
  item: IeltsPlanItemRow,
  context: TodayLaunchContext,
): string {
  const mockHref = item.ielts_test_id
    ? context.testSlugById.get(item.ielts_test_id)
    : undefined;

  switch (item.kind) {
    case "full_mock":
    case "mini_mock":
      return mockHref ? IELTS_ROUTES.mock(mockHref) : IELTS_ROUTES.tests;
    case "writing_submission":
    case "speaking_submission":
      return mockHref ? IELTS_ROUTES.mock(mockHref) : IELTS_ROUTES.studyPlan;
    case "teacher_assignment":
      return IELTS_ROUTES.assigned;
    case "learn_activity":
      return IELTS_ROUTES.learn;
    case "review":
      return IELTS_ROUTES.studyPlan;
    default:
      return IELTS_ROUTES.studyPlan;
  }
}

function metadataString(metadata: IeltsPlanItemRow["metadata"], key: string): string | null {
  if (metadata === null || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

/** Humanize a focus_area / skill key as a last-resort title ("matching_headings" → "Matching headings"). */
function humanize(value: string): string {
  const tail = value.includes(":") ? value.slice(value.indexOf(":") + 1) : value;
  const words = tail.replace(/[_-]+/g, " ").trim();
  if (words.length === 0) return value;
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Map a persisted plan item to the Today view-model (title from metadata, launch resolved). */
export function toIeltsTodayItemView(
  item: IeltsPlanItemRow,
  context: TodayLaunchContext & { today: string },
): IeltsTodayItemView {
  const fallbackTitle = humanize(item.focus_area || item.skill);
  return {
    id: item.id,
    skill: item.skill,
    kind: item.kind,
    status: item.status,
    focusArea: item.focus_area,
    estimatedMinutes: item.estimated_minutes,
    priorityScore: item.priority_score,
    scheduledDate: item.scheduled_date,
    isOverdue:
      isDueOnOrBefore(item, context.today) && item.scheduled_date < context.today,
    titleEn: metadataString(item.metadata, "titleEn") ?? fallbackTitle,
    titleVi: metadataString(item.metadata, "titleVi") ?? fallbackTitle,
    rationaleEn: item.rationale_en,
    rationaleVi: item.rationale_vi,
    launchHref: planItemLaunchHref(item, context),
  };
}

export interface IeltsTodayList {
  items: IeltsTodayItemView[];
  totalActionable: number;
  dueCount: number;
  overflowCount: number;
}

/** End-to-end: select the Today items and shape them into view-models. */
export function buildIeltsTodayList(
  items: readonly IeltsPlanItemRow[],
  context: TodayLaunchContext & { today: string; limit?: number },
): IeltsTodayList {
  const selection = selectTodayPlanItems(items, {
    today: context.today,
    limit: context.limit,
  });
  return {
    items: selection.items.map((item) => toIeltsTodayItemView(item, context)),
    totalActionable: selection.totalActionable,
    dueCount: selection.dueCount,
    overflowCount: selection.overflowCount,
  };
}
