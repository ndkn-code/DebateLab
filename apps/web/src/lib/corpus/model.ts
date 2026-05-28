import { createHash } from "node:crypto";

export const DEBATE_CORPUS_ITEM_TYPES = [
  "debate_moment",
  "phrase_bank",
  "judging_lesson",
] as const;

export const DEBATE_CORPUS_USABLE_FOR = [
  "rebuttal",
  "judging",
  "phrase_bank",
  "prep_helper",
  "eval",
] as const;

export const DEBATE_CORPUS_SAFE_EVIDENCE_STATUSES = [
  "verified_from_video",
  "mentioned_but_unverified",
  "not_applicable",
] as const;

export type DebateCorpusItemType = (typeof DEBATE_CORPUS_ITEM_TYPES)[number];
export type DebateCorpusUsableFor = (typeof DEBATE_CORPUS_USABLE_FOR)[number];
export type DebateCorpusPurpose =
  | "rebuttal"
  | "judging"
  | "coach"
  | "phrase_bank";
export type DebateCorpusEvidenceStatus =
  | "verified_from_video"
  | "mentioned_but_unverified"
  | "uncertain_stt"
  | "not_applicable";
export type DebateCorpusSide =
  | "proposition"
  | "opposition"
  | "neutral"
  | "unknown";

export interface DebateCorpusSourceSeed {
  source_id: string;
  source_index?: number;
  video_title: string;
  youtube_url: string;
  youtube_video_id?: string | null;
  source_type: string;
  season?: number | null;
  episode?: string | null;
  stage?: string | null;
  language?: string;
  transcript_quality: string;
  overall_confidence: number;
  recommended_import_status: string;
  recommended_use?: string[];
  reason?: string | null;
  raw_line?: number | null;
}

export interface DebateCorpusCanonicalMatchSeed {
  canonical_match_key: string;
  motion: {
    vi: string;
    en_translation?: string | null;
    motion_confidence: number;
    motion_key: string;
  };
  teams: unknown[];
  source_match_refs: Array<{
    source_id: string;
    source_match_key: string;
    youtube_url: string;
    match_confidence: number;
    import_decision: string;
  }>;
  import_decision: "candidate" | "phrase_only" | "metadata_only" | "reject";
  aggregate_confidence: number;
  debate_moments?: DebateMomentSeed[];
  phrase_bank?: PhraseBankSeed[];
  judging_lessons?: JudgingLessonSeed[];
  rejected_reason?: string | null;
}

export interface DebateMomentSeed {
  source_id: string;
  source_match_key: string;
  moment_key: string;
  moment_type: string;
  side: DebateCorpusSide;
  approx_timestamp?: string | null;
  short_paraphrase: string;
  strategic_value: string;
  what_strong_ai_should_notice: string;
  what_weak_ai_would_miss: string;
  usable_for: DebateCorpusUsableFor[];
  evidence_status: DebateCorpusEvidenceStatus;
  confidence: number;
  canonical_fingerprint: string;
}

export interface PhraseBankSeed {
  source_id: string;
  source_match_key: string;
  phrase_vi: string;
  function: string;
  english_meaning: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  natural_truong_teen_style: boolean;
  confidence: number;
  canonical_fingerprint: string;
}

export interface JudgingLessonSeed {
  source_id: string;
  source_match_key: string;
  lesson: string;
  rewarded_behavior: string;
  penalized_behavior: string;
  thinkfy_judge_rule: string;
  evidence_status: DebateCorpusEvidenceStatus;
  confidence: number;
  canonical_fingerprint: string;
}

export interface DebateCorpusSeed {
  schema_version: string;
  generated_at: string;
  sources: DebateCorpusSourceSeed[];
  canonical_matches: DebateCorpusCanonicalMatchSeed[];
}

export interface DebateCorpusItemPlan {
  canonicalMatchKey: string;
  sourceId: string | null;
  sourceMatchKey: string | null;
  itemType: DebateCorpusItemType;
  canonicalFingerprint: string;
  language: "vi" | "en";
  side: DebateCorpusSide;
  usableFor: DebateCorpusUsableFor[];
  evidenceStatus: DebateCorpusEvidenceStatus;
  confidence: number;
  reviewStatus: "candidate" | "approved" | "rejected" | "needs_review";
  embeddingText: string;
  contentHash: string;
  content: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface RetrievedDebateCorpusItem {
  item_id: string;
  canonical_match_key: string;
  motion_vi: string;
  item_type: DebateCorpusItemType;
  side: DebateCorpusSide;
  usable_for: DebateCorpusUsableFor[];
  evidence_status: DebateCorpusEvidenceStatus;
  confidence: number;
  review_status: string;
  embedding_text: string;
  content: Record<string, unknown>;
  similarity: number;
}

export interface DebateCorpusRelevanceGateConfig {
  enabled: boolean;
  minTopSimilarity: number;
  minItemSimilarity: number;
  minItemsAboveThreshold: number;
}

export interface DebateCorpusRelevanceGateResult {
  candidateItems: RetrievedDebateCorpusItem[];
  injectedItems: RetrievedDebateCorpusItem[];
  candidateCount: number;
  injectedCount: number;
  topSimilarity: number | null;
  avgTop3Similarity: number | null;
  itemsAboveThresholdCount: number;
  passed: boolean | null;
  skippedReason?: "low_relevance" | "no_matches";
}

function compactWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function clip(value: string | null | undefined, max = 900) {
  const text = compactWhitespace(value ?? "");
  return text.length > max ? `${text.slice(0, max - 1)}...` : text;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, child]) => `${JSON.stringify(key)}:${stableStringify(child)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function hashDebateCorpusContent(value: unknown) {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

export function estimateDebateCorpusTokens(value: string) {
  const normalized = compactWhitespace(value);
  if (!normalized) return 0;
  return Math.ceil(normalized.length / 3.8);
}

export function purposeToCorpusUsableFor(
  purpose: DebateCorpusPurpose
): DebateCorpusUsableFor {
  if (purpose === "judging") return "judging";
  if (purpose === "phrase_bank") return "phrase_bank";
  if (purpose === "coach") return "prep_helper";
  return "rebuttal";
}

export function isSafeEvidenceStatusForRetrieval(
  status: string | null | undefined
): status is (typeof DEBATE_CORPUS_SAFE_EVIDENCE_STATUSES)[number] {
  return (DEBATE_CORPUS_SAFE_EVIDENCE_STATUSES as readonly string[]).includes(
    status ?? ""
  );
}

export function selectRelevantRetrievedDebateCorpusItems(
  items: RetrievedDebateCorpusItem[],
  config: DebateCorpusRelevanceGateConfig
): DebateCorpusRelevanceGateResult {
  const candidateItems = [...items].sort((a, b) => b.similarity - a.similarity);
  const candidateCount = candidateItems.length;
  const topSimilarity = candidateItems[0]?.similarity ?? null;
  const top3 = candidateItems.slice(0, 3);
  const avgTop3Similarity =
    top3.length > 0
      ? top3.reduce((total, item) => total + item.similarity, 0) / top3.length
      : null;
  const itemsAboveThreshold = candidateItems.filter(
    (item) => item.similarity >= config.minItemSimilarity
  );

  if (candidateCount === 0) {
    return {
      candidateItems,
      injectedItems: [],
      candidateCount,
      injectedCount: 0,
      topSimilarity,
      avgTop3Similarity,
      itemsAboveThresholdCount: 0,
      passed: config.enabled ? false : null,
      skippedReason: "no_matches",
    };
  }

  if (!config.enabled) {
    return {
      candidateItems,
      injectedItems: candidateItems,
      candidateCount,
      injectedCount: candidateItems.length,
      topSimilarity,
      avgTop3Similarity,
      itemsAboveThresholdCount: itemsAboveThreshold.length,
      passed: null,
    };
  }

  const passed =
    topSimilarity != null &&
    topSimilarity >= config.minTopSimilarity &&
    itemsAboveThreshold.length >= config.minItemsAboveThreshold;

  const injectedItems = passed ? itemsAboveThreshold : [];

  return {
    candidateItems,
    injectedItems,
    candidateCount,
    injectedCount: injectedItems.length,
    topSimilarity,
    avgTop3Similarity,
    itemsAboveThresholdCount: itemsAboveThreshold.length,
    passed,
    skippedReason: passed ? undefined : "low_relevance",
  };
}

function normalizeUsableFor(value: readonly string[] | undefined) {
  return Array.from(
    new Set(
      (value ?? []).filter((item): item is DebateCorpusUsableFor =>
        (DEBATE_CORPUS_USABLE_FOR as readonly string[]).includes(item)
      )
    )
  );
}

function buildDebateMomentEmbeddingText(params: {
  match: DebateCorpusCanonicalMatchSeed;
  moment: DebateMomentSeed;
}) {
  const { match, moment } = params;
  return compactWhitespace(`
Type: debate moment
Motion: ${match.motion.vi}
Side: ${moment.side}
Moment type: ${moment.moment_type}
Usable for: ${moment.usable_for.join(", ")}
Evidence status: ${moment.evidence_status}
Paraphrase: ${moment.short_paraphrase}
Strategic value: ${moment.strategic_value}
Strong AI should notice: ${moment.what_strong_ai_should_notice}
Weak AI would miss: ${moment.what_weak_ai_would_miss}
`);
}

function buildPhraseEmbeddingText(params: {
  match: DebateCorpusCanonicalMatchSeed;
  phrase: PhraseBankSeed;
}) {
  const { match, phrase } = params;
  return compactWhitespace(`
Type: phrase bank
Motion: ${match.motion.vi}
Function: ${phrase.function}
Difficulty: ${phrase.difficulty}
Phrase: ${phrase.phrase_vi}
English meaning: ${phrase.english_meaning}
Natural Truong Teen style: ${phrase.natural_truong_teen_style ? "yes" : "no"}
`);
}

function buildJudgingLessonEmbeddingText(params: {
  match: DebateCorpusCanonicalMatchSeed;
  lesson: JudgingLessonSeed;
}) {
  const { match, lesson } = params;
  return compactWhitespace(`
Type: judging lesson
Motion: ${match.motion.vi}
Evidence status: ${lesson.evidence_status}
Lesson: ${lesson.lesson}
Rewarded behavior: ${lesson.rewarded_behavior}
Penalized behavior: ${lesson.penalized_behavior}
Thinkfy judge rule: ${lesson.thinkfy_judge_rule}
`);
}

export function buildDebateCorpusItemPlans(
  corpus: DebateCorpusSeed
): DebateCorpusItemPlan[] {
  const items: DebateCorpusItemPlan[] = [];

  for (const match of corpus.canonical_matches) {
    if (match.import_decision === "metadata_only" || match.import_decision === "reject") {
      continue;
    }

    for (const moment of match.debate_moments ?? []) {
      const content = {
        item_type: "debate_moment",
        motion: match.motion,
        moment,
      };
      const embeddingText = buildDebateMomentEmbeddingText({ match, moment });
      items.push({
        canonicalMatchKey: match.canonical_match_key,
        sourceId: moment.source_id,
        sourceMatchKey: moment.source_match_key,
        itemType: "debate_moment",
        canonicalFingerprint: moment.canonical_fingerprint,
        language: "vi",
        side: moment.side,
        usableFor: normalizeUsableFor(moment.usable_for),
        evidenceStatus: moment.evidence_status,
        confidence: moment.confidence,
        reviewStatus: "candidate",
        embeddingText,
        contentHash: hashDebateCorpusContent({ content, embeddingText }),
        content,
      });
    }

    for (const phrase of match.phrase_bank ?? []) {
      const content = {
        item_type: "phrase_bank",
        motion: match.motion,
        phrase,
      };
      const embeddingText = buildPhraseEmbeddingText({ match, phrase });
      items.push({
        canonicalMatchKey: match.canonical_match_key,
        sourceId: phrase.source_id,
        sourceMatchKey: phrase.source_match_key,
        itemType: "phrase_bank",
        canonicalFingerprint: phrase.canonical_fingerprint,
        language: "vi",
        side: "neutral",
        usableFor: ["phrase_bank"],
        evidenceStatus: "not_applicable",
        confidence: phrase.confidence,
        reviewStatus: "candidate",
        embeddingText,
        contentHash: hashDebateCorpusContent({ content, embeddingText }),
        content,
      });
    }

    for (const lesson of match.judging_lessons ?? []) {
      const content = {
        item_type: "judging_lesson",
        motion: match.motion,
        lesson,
      };
      const embeddingText = buildJudgingLessonEmbeddingText({ match, lesson });
      items.push({
        canonicalMatchKey: match.canonical_match_key,
        sourceId: lesson.source_id,
        sourceMatchKey: lesson.source_match_key,
        itemType: "judging_lesson",
        canonicalFingerprint: lesson.canonical_fingerprint,
        language: "vi",
        side: "neutral",
        usableFor: ["judging"],
        evidenceStatus: lesson.evidence_status,
        confidence: lesson.confidence,
        reviewStatus: "candidate",
        embeddingText,
        contentHash: hashDebateCorpusContent({ content, embeddingText }),
        content,
      });
    }
  }

  return items;
}

function summarizeRetrievedContent(item: RetrievedDebateCorpusItem) {
  if (item.item_type === "debate_moment") {
    const moment = (item.content.moment ?? {}) as Record<string, unknown>;
    return [
      `moment=${clip(moment.short_paraphrase as string, 260)}`,
      `strategy=${clip(moment.strategic_value as string, 260)}`,
      `strong_ai_notice=${clip(moment.what_strong_ai_should_notice as string, 220)}`,
    ].join("; ");
  }

  if (item.item_type === "phrase_bank") {
    const phrase = (item.content.phrase ?? {}) as Record<string, unknown>;
    return [
      `phrase=${clip(phrase.phrase_vi as string, 220)}`,
      `function=${clip(phrase.function as string, 80)}`,
      `meaning=${clip(phrase.english_meaning as string, 200)}`,
    ].join("; ");
  }

  const lesson = (item.content.lesson ?? {}) as Record<string, unknown>;
  return [
    `lesson=${clip(lesson.lesson as string, 240)}`,
    `reward=${clip(lesson.rewarded_behavior as string, 220)}`,
    `penalty=${clip(lesson.penalized_behavior as string, 220)}`,
    `rule=${clip(lesson.thinkfy_judge_rule as string, 220)}`,
  ].join("; ");
}

export function formatRetrievedDebateCorpusContext(
  items: RetrievedDebateCorpusItem[],
  purpose: DebateCorpusPurpose
) {
  const usableFor = purposeToCorpusUsableFor(purpose);
  const safeItems = items
    .filter((item) => item.usable_for.includes(usableFor))
    .filter((item) => isSafeEvidenceStatusForRetrieval(item.evidence_status))
    .slice(0, purpose === "judging" ? 8 : 6);

  if (safeItems.length === 0) return "";

  const rows = safeItems
    .map((item, index) => {
      const evidence =
        item.evidence_status === "verified_from_video"
          ? "video-verified"
          : item.evidence_status === "mentioned_but_unverified"
            ? "debater-mentioned, not independently verified"
            : "not evidence";
      return `${index + 1}. ${item.item_type} | motion="${clip(item.motion_vi, 140)}" | side=${item.side} | similarity=${item.similarity.toFixed(3)} | evidence=${evidence} | ${summarizeRetrievedContent(item)}`;
    })
    .join("\n");

  const heading =
    purpose === "coach" || purpose === "phrase_bank"
      ? "Truong Teen Coach Context (internal)"
      : "Truong Teen Retrieved Context (internal)";
  const purposeRule =
    purpose === "phrase_bank"
      ? "Prioritize reusable wording and style patterns. Do not force a quote into the student's speech if it does not fit their motion."
      : "Use these as strategic reference patterns, not as transcript quotes.";

  return `\n## ${heading}\n${purposeRule} Do not claim debater-mentioned evidence is independently verified. If evidence is not video-verified, use it only as a reasoning pattern or say it was \"debater-mentioned\".\n${rows}\n`;
}
