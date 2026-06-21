import type {
  IeltsModule,
  IeltsSkill,
} from "@/lib/ielts/adaptive/contracts";
import type { IeltsQuestionType } from "@/lib/ielts/question-types";
import { isObjectiveQuestionType } from "@/lib/ielts/question-types";

const GENERATOR_VERSION = "ielts_skill_drill_v1";
const DEFAULT_DIFFICULTY_BAND = 6;
const MIN_QUESTIONS = 2;
const MAX_QUESTIONS = 20;

export interface IeltsSkillDrillQuestionCandidate {
  id: string;
  sourceTestId: string;
  skill: IeltsSkill;
  questionType: IeltsQuestionType;
  maxPoints: number;
  orderIndex: number;
  module: IeltsModule;
  published: boolean;
  metadata: unknown;
}

export interface BuildIeltsSkillDrillInput {
  userId: string;
  skill: IeltsSkill;
  subskillKey: string;
  targetMinutes: number;
  module?: IeltsModule;
  questionTypes?: readonly IeltsQuestionType[];
  subskillTags?: readonly string[];
  difficultyBandHint?: number | null;
  questions: readonly IeltsSkillDrillQuestionCandidate[];
}

export interface IeltsSkillDrillPlanReference {
  type: "skill_drill";
  drillKey: string;
  skill: IeltsSkill;
  subskillKey: string;
  module: IeltsModule;
  targetMinutes: number;
  questionTypes: IeltsQuestionType[];
  subskillTags: string[];
  difficultyBandHint: number | null;
  sourceQuestionIds: string[];
}

export interface IeltsSkillDrillTestDraft {
  slug: string;
  title: string;
  kind: "skill_set" | "drill";
  module: IeltsModule;
  skill: IeltsSkill;
  timeLimitSeconds: number;
  metadata: {
    generated_by: typeof GENERATOR_VERSION;
    generated_kind: "b2c_skill_drill";
    band_conversion_key: "default";
    scoring_path: "objective_grading_v1";
    subskill_key: string;
    source_question_ids: string[];
    question_types: IeltsQuestionType[];
    difficulty_band_hint: number | null;
  };
}

export interface IeltsSkillDrillGeneration {
  reference: IeltsSkillDrillPlanReference;
  test: IeltsSkillDrillTestDraft;
  selectedQuestions: IeltsSkillDrillQuestionCandidate[];
}

export type IeltsSkillDrillGenerationResult =
  | { ok: true; drill: IeltsSkillDrillGeneration }
  | {
      ok: false;
      reason:
        | "unsupported_skill"
        | "invalid_target_minutes"
        | "invalid_subskill"
        | "insufficient_questions";
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function metadataTags(metadata: unknown): string[] {
  if (!isRecord(metadata)) return [];
  const raw = metadata.subskill_tags;
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((value) => (typeof value === "string" ? [value] : []));
}

function metadataDifficulty(metadata: unknown): number | null {
  if (!isRecord(metadata)) return null;
  const raw = metadata.difficulty_band_hint;
  return typeof raw === "number" && Number.isFinite(raw) ? raw : null;
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function subskillTail(key: string): string {
  const index = key.indexOf(":");
  return index >= 0 ? key.slice(index + 1) : key;
}

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}

function uniqueQuestionTypes(values: readonly IeltsQuestionType[]): IeltsQuestionType[] {
  return [...new Set(values)];
}

function includesNormalized(values: readonly string[], target: string): boolean {
  const normalized = normalize(target);
  return values.some((value) => normalize(value) === normalized);
}

function requestedQuestionTypes(input: BuildIeltsSkillDrillInput): IeltsQuestionType[] {
  const requested = input.questionTypes?.filter(isObjectiveQuestionType) ?? [];
  return uniqueQuestionTypes(requested);
}

function requestedSubskillTags(input: BuildIeltsSkillDrillInput): string[] {
  return uniqueStrings([input.subskillKey, ...(input.subskillTags ?? [])]);
}

function hashString(value: string): number {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

function hashToken(value: string): string {
  return hashString(value).toString(36).padStart(6, "0").slice(0, 8);
}

function estimateSeconds(questionType: IeltsQuestionType): number {
  switch (questionType) {
    case "matching_headings":
    case "matching_information":
    case "matching_features":
    case "mcq_multi":
      return 90;
    case "sentence_completion":
    case "summary_completion":
    case "note_table_form_flowchart_completion":
    case "diagram_label":
    case "map_plan_label":
      return 75;
    default:
      return 60;
  }
}

function questionMatchScore(params: {
  question: IeltsSkillDrillQuestionCandidate;
  questionTypes: readonly IeltsQuestionType[];
  subskillTags: readonly string[];
  subskillKey: string;
}): number {
  const tags = metadataTags(params.question.metadata);
  const tail = subskillTail(params.subskillKey);
  let score = 0;
  if (includesNormalized(tags, params.subskillKey)) score += 8;
  if (params.subskillTags.some((tag) => includesNormalized(tags, tag))) score += 4;
  if (params.questionTypes.includes(params.question.questionType)) score += 3;
  if (normalize(params.question.questionType) === normalize(tail)) score += 2;
  return score;
}

function canDrillSkill(skill: IeltsSkill): boolean {
  return skill === "listening" || skill === "reading";
}

function clampTargetMinutes(value: number): number | null {
  if (!Number.isFinite(value)) return null;
  return Math.max(5, Math.min(60, Math.trunc(value)));
}

function titleFor(skill: IeltsSkill, subskillKey: string): string {
  const label = subskillTail(subskillKey).replace(/[_-]+/g, " ");
  const title = label.charAt(0).toUpperCase() + label.slice(1);
  return `${skill.charAt(0).toUpperCase() + skill.slice(1)} drill: ${title}`;
}

function selectQuestions(input: BuildIeltsSkillDrillInput): {
  selected: IeltsSkillDrillQuestionCandidate[];
  questionTypes: IeltsQuestionType[];
  subskillTags: string[];
  targetMinutes: number;
} | null {
  const targetMinutes = clampTargetMinutes(input.targetMinutes);
  if (targetMinutes === null) return null;

  const testModule = input.module ?? "academic";
  const questionTypes = requestedQuestionTypes(input);
  const subskillTags = requestedSubskillTags(input);
  const difficultyTarget = input.difficultyBandHint ?? DEFAULT_DIFFICULTY_BAND;
  const scored = input.questions
    .filter(
      (question) =>
        question.published &&
        question.skill === input.skill &&
        question.module === testModule &&
        isObjectiveQuestionType(question.questionType),
    )
    .map((question) => ({
      question,
      matchScore: questionMatchScore({
        question,
        questionTypes,
        subskillTags,
        subskillKey: input.subskillKey,
      }),
      difficultyDistance: Math.abs(
        (metadataDifficulty(question.metadata) ?? DEFAULT_DIFFICULTY_BAND) -
          difficultyTarget,
      ),
      seed: hashString(`${input.userId}:${input.subskillKey}:${question.id}`),
    }))
    .filter((entry) => entry.matchScore > 0)
    .sort((left, right) => {
      if (left.matchScore !== right.matchScore) return right.matchScore - left.matchScore;
      if (left.difficultyDistance !== right.difficultyDistance) {
        return left.difficultyDistance - right.difficultyDistance;
      }
      if (left.question.sourceTestId !== right.question.sourceTestId) {
        return left.question.sourceTestId < right.question.sourceTestId ? -1 : 1;
      }
      if (left.question.orderIndex !== right.question.orderIndex) {
        return left.question.orderIndex - right.question.orderIndex;
      }
      return left.seed - right.seed;
    });

  const selected: IeltsSkillDrillQuestionCandidate[] = [];
  const budgetSeconds = targetMinutes * 60;
  let usedSeconds = 0;
  for (const entry of scored) {
    if (selected.length >= MAX_QUESTIONS) break;
    const nextSeconds = estimateSeconds(entry.question.questionType);
    if (selected.length >= MIN_QUESTIONS && usedSeconds + nextSeconds > budgetSeconds) {
      break;
    }
    selected.push(entry.question);
    usedSeconds += nextSeconds;
  }

  if (selected.length < MIN_QUESTIONS) return null;
  return { selected, questionTypes, subskillTags, targetMinutes };
}

export function buildIeltsSkillDrill(
  input: BuildIeltsSkillDrillInput,
): IeltsSkillDrillGenerationResult {
  if (!canDrillSkill(input.skill)) return { ok: false, reason: "unsupported_skill" };
  if (!input.subskillKey.startsWith(`${input.skill}:`)) {
    return { ok: false, reason: "invalid_subskill" };
  }

  const targetMinutes = clampTargetMinutes(input.targetMinutes);
  if (targetMinutes === null) return { ok: false, reason: "invalid_target_minutes" };

  const selection = selectQuestions(input);
  if (!selection) return { ok: false, reason: "insufficient_questions" };

  const testModule = input.module ?? "academic";
  const sourceQuestionIds = selection.selected.map((question) => question.id);
  const selectedQuestionTypes = uniqueQuestionTypes(
    selection.selected.map((question) => question.questionType),
  );
  const hash = hashToken(
    [
      testModule,
      input.skill,
      input.subskillKey,
      selection.targetMinutes,
      ...sourceQuestionIds,
    ].join("|"),
  );
  const drillKey = `${input.skill}:${subskillTail(input.subskillKey)}:${hash}`;
  const slug = `ielts-${input.skill}-${subskillTail(input.subskillKey).replace(/_/g, "-")}-${hash}`;
  const kind = selection.targetMinutes > 20 ? "skill_set" : "drill";
  const difficultyBandHint = input.difficultyBandHint ?? null;

  return {
    ok: true,
    drill: {
      reference: {
        type: "skill_drill",
        drillKey,
        skill: input.skill,
        subskillKey: input.subskillKey,
        module: testModule,
        targetMinutes: selection.targetMinutes,
        questionTypes: selection.questionTypes,
        subskillTags: selection.subskillTags,
        difficultyBandHint,
        sourceQuestionIds,
      },
      test: {
        slug,
        title: titleFor(input.skill, input.subskillKey),
        kind,
        module: testModule,
        skill: input.skill,
        timeLimitSeconds: selection.targetMinutes * 60,
        metadata: {
          generated_by: GENERATOR_VERSION,
          generated_kind: "b2c_skill_drill",
          band_conversion_key: "default",
          scoring_path: "objective_grading_v1",
          subskill_key: input.subskillKey,
          source_question_ids: sourceQuestionIds,
          question_types: selectedQuestionTypes,
          difficulty_band_hint: difficultyBandHint,
        },
      },
      selectedQuestions: selection.selected,
    },
  };
}
