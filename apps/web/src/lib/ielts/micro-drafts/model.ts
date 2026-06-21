import type { TablesInsert } from "@/types/supabase";
import type { Json } from "@/types/supabase";
import type { IeltsLearnAtom, IeltsSkill } from "@/lib/ielts/adaptive/contracts";
import {
  IELTS_MICRO_DRAFT_PROMPT_VERSION,
  assertContentMatchesAnswerKey,
  type GeneratedMicroDraft,
  type IeltsMicroDraftActivityType,
  type MicroDraftSubskillOption,
} from "./schema";

export interface MicroDraftSourceContext {
  testId: string;
  questionId: string;
  passageId: string | null;
  listeningSectionId: string | null;
  skill: IeltsSkill;
  questionType: string;
  prompt: string;
  groupInstructions: string | null;
  sourceText: string;
  correctAnswer: Json;
  acceptVariants: Json;
  explanationEn: string | null;
  explanationVi: string | null;
  modelAnswer: string | null;
  subskills: MicroDraftSubskillOption[];
}

export interface MicroDraftModelAudit {
  providerLabel: string;
  modelName: string;
  generatedAt: string;
}

interface DraftInsertParams {
  source: MicroDraftSourceContext;
  draft: GeneratedMicroDraft;
  audit: MicroDraftModelAudit;
  createdBy: string;
}

interface ActivityInsertParams {
  draftId: string;
  draft: {
    activity_type: string;
    draft_content: Json;
    rationale_en: string;
    rationale_vi: string;
    source_question_id: string | null;
    source_passage_id: string | null;
    source_listening_section_id: string | null;
    subskill_key: string | null;
    test_id: string | null;
  };
  moduleId: string;
  orderIndex: number;
  title?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toJson(value: unknown): Json {
  return value as Json;
}

function normalizeQuote(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function sourceContainsQuote(sourceText: string, quote: string): boolean {
  const source = normalizeQuote(sourceText).toLowerCase();
  const needle = normalizeQuote(quote).toLowerCase();
  return needle.length > 0 && source.includes(needle);
}

export function fallbackSubskillKey(params: {
  activityType: IeltsMicroDraftActivityType;
  source: MicroDraftSourceContext;
}): string | null {
  const { activityType, source } = params;
  const byKey = new Map(source.subskills.map((subskill) => [subskill.key, subskill]));
  const exactQuestionType = source.subskills.find(
    (subskill) => subskill.questionType === source.questionType,
  );
  if (activityType === "ielts_gap_fill" && exactQuestionType) return exactQuestionType.key;

  const preferredByActivity: Record<IeltsMicroDraftActivityType, string[]> = {
    ielts_gap_fill: [
      `${source.skill}:${source.questionType}`,
      "reading:sentence_completion",
      "listening:sentence_completion",
    ],
    ielts_paraphrase_transform: [
      `${source.skill}:paraphrase_recognition`,
      "reading:paraphrase_recognition",
      "writing:paraphrase_transform",
    ],
    ielts_vocab_collocation: [
      `${source.skill}:collocation_precision`,
      "writing:collocation_precision",
      "speaking:lexical_resource",
      `${source.skill}:lexical_resource`,
    ],
  };

  for (const key of preferredByActivity[activityType]) {
    if (byKey.has(key)) return key;
  }
  return exactQuestionType?.key ?? source.subskills[0]?.key ?? null;
}

export function resolveSubskillKey(params: {
  requestedKey: string | null;
  activityType: IeltsMicroDraftActivityType;
  source: MicroDraftSourceContext;
}): string | null {
  if (params.requestedKey) {
    const match = params.source.subskills.find(
      (subskill) => subskill.key === params.requestedKey,
    );
    if (match) return match.key;
  }
  return fallbackSubskillKey(params);
}

export function buildLearnAtom(params: {
  activityType: IeltsMicroDraftActivityType;
  skill: IeltsSkill;
  focusArea: string;
  questionId: string;
  estimatedMinutes: number;
  subskillKey: string | null;
}): IeltsLearnAtom {
  return {
    activityType: params.activityType,
    skill: params.skill,
    focusArea: params.focusArea,
    estimatedMinutes: params.estimatedMinutes,
    questionIds: [params.questionId],
    rendererTags: [
      params.activityType,
      ...(params.subskillKey ? [params.subskillKey] : []),
    ],
    scoringMode: "objective",
  };
}

export function buildMicroDraftInsert({
  source,
  draft,
  audit,
  createdBy,
}: DraftInsertParams): TablesInsert<"ielts_micro_item_drafts"> {
  assertContentMatchesAnswerKey(draft.content, draft.answerKey);
  const subskillKey = resolveSubskillKey({
    requestedKey: draft.subskillKey,
    activityType: draft.activityType,
    source,
  });
  const sourceQuote = normalizeQuote(draft.sourceTextQuote);

  return {
    test_id: source.testId,
    source_question_id: source.questionId,
    source_passage_id: source.passageId,
    source_listening_section_id: source.listeningSectionId,
    activity_type: draft.activityType,
    subskill_key: subskillKey,
    draft_content: toJson(draft.content),
    answer_key: toJson(draft.answerKey),
    rationale_en: draft.rationaleEn,
    rationale_vi: draft.rationaleVi,
    provenance: toJson({
      promptVersion: IELTS_MICRO_DRAFT_PROMPT_VERSION,
      generatedAt: audit.generatedAt,
      model: {
        provider: audit.providerLabel,
        name: audit.modelName,
      },
      source: {
        testId: source.testId,
        questionId: source.questionId,
        passageId: source.passageId,
        listeningSectionId: source.listeningSectionId,
        skill: source.skill,
        questionType: source.questionType,
      },
      sourceTextQuote: sourceQuote,
      quoteVerified: sourceContainsQuote(source.sourceText, sourceQuote),
      sourceFields: [
        "question.prompt",
        "question.group_instructions",
        source.passageId ? "passage.body" : null,
        source.listeningSectionId ? "listening_section.script" : null,
        source.explanationEn ? "ielts_question_keys.explanation_en" : null,
        source.explanationVi ? "ielts_question_keys.explanation_vi" : null,
        source.modelAnswer ? "ielts_question_keys.model_answer" : null,
      ].filter(Boolean),
      answerKeyStoredSeparately: true,
    }),
    model_provider: audit.providerLabel,
    model_name: audit.modelName,
    prompt_version: IELTS_MICRO_DRAFT_PROMPT_VERSION,
    status: "needs_review",
    created_by: createdBy,
  };
}

export function readLocalizedTitle(content: Json): string {
  if (!isRecord(content)) return "IELTS micro-item";
  const title = content.title;
  if (!isRecord(title)) return "IELTS micro-item";
  return typeof title.en === "string" && title.en.trim()
    ? title.en.trim()
    : "IELTS micro-item";
}

export function readEstimatedMinutes(content: Json): number {
  if (!isRecord(content)) return 4;
  return typeof content.estimatedMinutes === "number"
    ? Math.max(1, Math.min(15, Math.round(content.estimatedMinutes)))
    : 4;
}

export function buildPublishedActivityInsert({
  draftId,
  draft,
  moduleId,
  orderIndex,
  title,
}: ActivityInsertParams): TablesInsert<"activities"> {
  const resolvedTitle = title?.trim() || readLocalizedTitle(draft.draft_content);
  const activityType = draft.activity_type as IeltsMicroDraftActivityType;
  const estimatedMinutes = readEstimatedMinutes(draft.draft_content);

  return {
    module_id: moduleId,
    activity_type: activityType,
    title: resolvedTitle,
    description: draft.rationale_en,
    phase: "practice",
    order_index: orderIndex,
    duration_minutes: estimatedMinutes,
    content: draft.draft_content,
    metadata: toJson({
      subject: "ielts",
      source: "ielts_micro_item_draft",
      draftId,
      testId: draft.test_id,
      sourceQuestionId: draft.source_question_id,
      sourcePassageId: draft.source_passage_id,
      sourceListeningSectionId: draft.source_listening_section_id,
      subskillKey: draft.subskill_key,
      rationale: {
        en: draft.rationale_en,
        vi: draft.rationale_vi,
      },
      answerKeyStoredIn: "ielts_micro_item_drafts",
    }),
  };
}
