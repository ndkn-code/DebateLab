import "server-only";

import type { PracticeLanguage, PracticeTrack } from "@/types";

import type {
  DebatePatternsToolRequest,
  DebateRebuttalToolRequest,
  KnowledgeEvidence,
  KnowledgePurpose,
  KnowledgeResult,
} from "./contracts";
import {
  findDebateArgumentPatterns,
  findRebuttalAndWeighingExamples,
} from "./tools";

export interface EnglishDebateKnowledgeRequest {
  purpose: Extract<
    KnowledgePurpose,
    "grading" | "coaching" | "opponent" | "explanation"
  >;
  language: PracticeLanguage;
  practiceTrack: PracticeTrack;
  topic: string;
  transcript: string;
  roundsText?: string[];
  side?: "proposition" | "opposition";
  format?: string;
  userId?: string | null;
  sourceRoute: string;
  deadlineMs?: number;
}

export interface EnglishDebateKnowledgeContext {
  /** Prompt-safe, internal calibration material only. */
  contextBlock: string;
  /** Kept separately for audits, logs, and future learner-facing evidence UI. */
  evidence: KnowledgeEvidence[];
  provenance: {
    collection: "debate.en.competitive";
    versions: string[];
    toolNames: [
      "findDebateArgumentPatterns",
      "findRebuttalAndWeighingExamples",
    ];
  };
  skippedReason?: string;
}

/** A normalized observability shape shared with the existing corpus path. */
export interface EnglishDebateKnowledgeSummary {
  enabled: true;
  retrievedCount: number;
  candidateCount: number;
  skippedReason?: string;
  topScore: number | null;
  relevanceGatePassed: boolean;
}

export type PracticeDebateKnowledgeSelection<TLegacy> =
  | { kind: "english"; knowledge: EnglishDebateKnowledgeContext }
  | { kind: "legacy"; knowledge: TLegacy };

type EnglishDebateToolset = {
  findPatterns: (params: DebatePatternsToolRequest) => Promise<KnowledgeResult>;
  findRebuttalAndWeighing: (
    params: DebateRebuttalToolRequest,
  ) => Promise<KnowledgeResult>;
};

const defaultToolset: EnglishDebateToolset = {
  findPatterns: findDebateArgumentPatterns,
  findRebuttalAndWeighing: findRebuttalAndWeighingExamples,
};

/** English competitive-debate knowledge is deliberately never mixed with Trường Teen retrieval. */
export function shouldUseEnglishDebateKnowledge(
  params: Pick<EnglishDebateKnowledgeRequest, "language" | "practiceTrack">,
) {
  return params.language === "en" && params.practiceTrack === "debate";
}

function compactQuery(value: string, maxLength = 7_000) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  const half = Math.floor((maxLength - 80) / 2);
  return `${normalized.slice(0, half)}\n…[middle omitted for retrieval]…\n${normalized.slice(-half)}`;
}

export function buildEnglishDebateKnowledgeQuery(
  params: Pick<
    EnglishDebateKnowledgeRequest,
    "topic" | "transcript" | "roundsText" | "side" | "format" | "purpose"
  >,
) {
  const recentRounds = params.roundsText
    ?.filter(Boolean)
    .slice(-3)
    .join("\n\n");
  return compactQuery(
    [
      `Motion: ${params.topic}`,
      params.side ? `Student side: ${params.side}` : "",
      params.format ? `Format/role: ${params.format}` : "",
      `Retrieval purpose: ${params.purpose}`,
      recentRounds ? `Recent round context:\n${recentRounds}` : "",
      `Student transcript:\n${params.transcript}`,
    ]
      .filter(Boolean)
      .join("\n\n"),
  );
}

function uniqueEvidence(results: KnowledgeResult[]) {
  const evidence = new Map<string, KnowledgeEvidence>();
  for (const result of results) {
    for (const item of result.evidence) evidence.set(item.sourceId, item);
  }
  return [...evidence.values()];
}

/**
 * Converts approved competitive-debate references into a clearly delimited
 * internal prompt section. IDs and source locators are retained in provenance,
 * never presented as learner-facing citations by this layer.
 */
export function formatEnglishDebateKnowledgeContext(params: {
  patterns: KnowledgeResult;
  rebuttalAndWeighing: KnowledgeResult;
}): EnglishDebateKnowledgeContext {
  const results = [params.patterns, params.rebuttalAndWeighing];
  const evidence = uniqueEvidence(results);
  const sections = [
    params.patterns.context
      ? `### Argument and format patterns\n${params.patterns.context}`
      : "",
    params.rebuttalAndWeighing.context
      ? `### Rebuttal, clash, and weighing patterns\n${params.rebuttalAndWeighing.context}`
      : "",
  ].filter(Boolean);
  const skippedReasons = results
    .map((result) => result.skippedReason)
    .filter((reason): reason is string => Boolean(reason));

  return {
    contextBlock:
      sections.length > 0
        ? [
            "## Retrieved English Debate Calibration (internal)",
            "Use these approved competitive-debate references to calibrate argument quality, responsiveness, clash, weighing, and role fulfilment. They are coaching/judging patterns, not independently verified facts for the student to cite. Do not expose evidence IDs or source links in learner feedback.",
            ...sections,
          ].join("\n\n")
        : "",
    evidence,
    provenance: {
      collection: "debate.en.competitive",
      versions: [...new Set(evidence.map((item) => item.version))],
      toolNames: [
        "findDebateArgumentPatterns",
        "findRebuttalAndWeighingExamples",
      ],
    },
    skippedReason:
      sections.length === 0 && skippedReasons.length > 0
        ? [...new Set(skippedReasons)].join(";")
        : undefined,
  };
}

/**
 * Matches the important observability fields of the legacy corpus result while
 * keeping this collection's evidence and version namespace explicit.
 */
export function summarizeEnglishDebateKnowledge(
  knowledge: EnglishDebateKnowledgeContext,
): EnglishDebateKnowledgeSummary {
  return {
    enabled: true,
    retrievedCount: knowledge.evidence.length,
    candidateCount: knowledge.evidence.length,
    skippedReason: knowledge.skippedReason,
    topScore: knowledge.evidence[0]?.score ?? null,
    relevanceGatePassed: knowledge.evidence.length > 0,
  };
}

export function createEnglishDebateKnowledgeMetadata(
  knowledge: EnglishDebateKnowledgeContext,
) {
  const summary = summarizeEnglishDebateKnowledge(knowledge);
  return {
    corpusRagEnabled: summary.enabled,
    corpusRagSkippedReason: summary.skippedReason,
    corpusRetrievalLogId: null,
    corpusRetrievalLatencyMs: null,
    retrievedCorpusItemIds: knowledge.evidence.map((item) => item.sourceId),
    retrievedCorpusCount: summary.retrievedCount,
    candidateCorpusItemIds: knowledge.evidence.map((item) => item.sourceId),
    candidateCorpusCount: summary.candidateCount,
    corpusRagTopSimilarity: summary.topScore,
    corpusRagAvgTop3Similarity: null,
    corpusRagItemsAboveThresholdCount: summary.retrievedCount,
    corpusRagRelevanceGatePassed: summary.relevanceGatePassed,
    corpusRagRelevanceThresholds: null,
    corpusRetrievalCacheHit: false,
    corpusRetrievalCacheKey: null,
    knowledgeCollection: knowledge.provenance.collection,
    knowledgeCorpusVersions: knowledge.provenance.versions,
    knowledgeEvidence: knowledge.evidence,
  };
}

export async function retrieveEnglishDebateKnowledge(
  params: EnglishDebateKnowledgeRequest,
  toolset: EnglishDebateToolset = defaultToolset,
): Promise<EnglishDebateKnowledgeContext | null> {
  if (!shouldUseEnglishDebateKnowledge(params)) return null;

  const query = buildEnglishDebateKnowledgeQuery(params);
  const common = {
    purpose: params.purpose,
    language: "en" as const,
    sourceRoute: params.sourceRoute,
    userId: params.userId,
    format: params.format,
    motion: params.topic,
    side: params.side,
    deadlineMs: params.deadlineMs,
  };
  const [patterns, rebuttalAndWeighing] = await Promise.all([
    toolset.findPatterns({ ...common, query }),
    toolset.findRebuttalAndWeighing({
      ...common,
      query,
      targetArgument: compactQuery(params.transcript, 1_600),
    }),
  ]);
  return formatEnglishDebateKnowledgeContext({ patterns, rebuttalAndWeighing });
}

/**
 * One language boundary for every practice-grading entry point. English
 * retrieval must never silently fall back into the Vietnamese corpus, even
 * when the new collection has no approved matching evidence.
 */
export async function retrievePracticeDebateKnowledge<TLegacy>(
  params: EnglishDebateKnowledgeRequest,
  retrieveLegacy: () => Promise<TLegacy>,
  retrieveEnglish: (
    request: EnglishDebateKnowledgeRequest,
  ) => Promise<EnglishDebateKnowledgeContext | null> = retrieveEnglishDebateKnowledge,
): Promise<PracticeDebateKnowledgeSelection<TLegacy>> {
  const english = await retrieveEnglish(params);
  if (english) return { kind: "english", knowledge: english };
  return { kind: "legacy", knowledge: await retrieveLegacy() };
}
