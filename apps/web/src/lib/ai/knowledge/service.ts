import "server-only";

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getCoachContextEnvelope, getCoachProfile } from "@/lib/api/coach-profile";
import { loadSpeakingExemplars } from "@/lib/corpus/ielts-speaking-exemplars";
import { loadWritingExemplars } from "@/lib/corpus/ielts-exemplars";
import {
  retrieveDebateCorpusContext,
  type DebateCorpusRetrievalResult,
} from "@/lib/corpus/retrieval";
import {
  formatRetrievedDebateCorpusContext,
  purposeToCorpusUsableFor,
  type RetrievedDebateCorpusItem,
} from "@/lib/corpus/model";
import { isDebateCorpusRagEnabled } from "@/lib/corpus/config";
import { tryCreateAdminClient } from "@/lib/supabase/admin";
import {
  IELTS_SPEAKING_SCORER_BUNDLE_KEY,
  IELTS_SPEAKING_SCORER_BUNDLE_VERSION,
} from "@/lib/ielts/speaking-scorer/constants";
import {
  IELTS_WRITING_SCORER_BUNDLE_KEY,
  IELTS_WRITING_SCORER_BUNDLE_VERSION,
} from "@/lib/ielts/writing-scorer/constants";
import {
  PRACTICE_FEEDBACK_PROMPT_BUNDLE_KEY,
  PRACTICE_FEEDBACK_PROMPT_BUNDLE_VERSION,
  PRACTICE_FEEDBACK_RUBRIC_VERSION,
} from "@/lib/practice-analysis/constants";
import type {
  DebateKnowledgeRequest,
  IeltsExemplarKnowledgeRequest,
  KnowledgeEvidence,
  KnowledgeResult,
  KnowledgeSearchRequest,
  LearnerHistoryKnowledgeRequest,
  RubricKnowledgeRequest,
} from "./contracts";

const DEFAULT_DEADLINE_MS = 15_000;
const MAX_HIGHLIGHT_CHARS = 700;

function compact(value: string, max = MAX_HIGHLIGHT_CHARS) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > max ? `${normalized.slice(0, max - 1)}…` : normalized;
}

function hash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function deadline<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label}_deadline_exceeded`)), timeoutMs);
    }),
  ]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

function debateEvidence(retrieval: DebateCorpusRetrievalResult): KnowledgeEvidence[] {
  return retrieval.items.map((item) => ({
    sourceId: item.item_id,
    version: item.canonical_match_key,
    itemType: item.item_type,
    highlight: compact(item.embedding_text),
    score: item.similarity,
    reviewStatus: item.review_status,
    metadata: {
      side: item.side,
      evidenceStatus: item.evidence_status,
      confidence: item.confidence,
      usableFor: item.usable_for,
      motion: item.motion_vi,
    },
  }));
}

type LexicalDebateRow = RetrievedDebateCorpusItem & {
  lexical_rank: number;
  lexical_score: number;
};

function buildLexicalQuery(request: DebateKnowledgeRequest): string {
  const terms = `${request.topic} ${request.query}`
    .normalize("NFKC")
    .toLocaleLowerCase("vi")
    .match(/[\p{L}\p{N}_-]{3,}/gu);
  return Array.from(new Set(terms ?? []))
    .slice(0, 24)
    .map((term) => `"${term.replaceAll('"', "")}"`)
    .join(" OR ");
}

function normalizeLexicalRows(value: unknown): LexicalDebateRow[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((row) => row as Partial<LexicalDebateRow>)
    .filter(
      (row): row is LexicalDebateRow =>
        typeof row.item_id === "string" &&
        typeof row.canonical_match_key === "string" &&
        typeof row.motion_vi === "string" &&
        typeof row.item_type === "string" &&
        typeof row.embedding_text === "string" &&
        typeof row.lexical_rank === "number" &&
        typeof row.lexical_score === "number" &&
        Boolean(row.content),
    );
}

async function searchDebateLexically(
  request: DebateKnowledgeRequest,
): Promise<LexicalDebateRow[]> {
  if (
    !isDebateCorpusRagEnabled() ||
    request.language !== "vi" ||
    request.practiceTrack === "speaking"
  ) {
    return [];
  }
  const admin = request.supabase ?? tryCreateAdminClient();
  const queryText = buildLexicalQuery(request);
  if (!admin || !queryText) return [];

  // This RPC is introduced by the same forward-only migration as the durable
  // workflow table, so generated database types intentionally lag until the
  // migration is deployed and types are regenerated.
  const untyped = admin as SupabaseClient<any>;
  const { data, error } = await untyped.rpc("search_debate_corpus_items_lexical", {
    query_text: queryText,
    match_count: Math.min(Math.max((request.limit ?? 8) * 2, 8), 24),
    language: "vi",
    usable_for: purposeToCorpusUsableFor(request.debatePurpose),
    review_statuses: ["approved", "needs_review"],
    min_confidence: 0.72,
  });
  if (error) throw new Error(`lexical_retrieval:${error.message}`);
  return normalizeLexicalRows(data);
}

export function fuseDebateResults(
  semantic: DebateCorpusRetrievalResult,
  lexical: LexicalDebateRow[],
  purpose: DebateKnowledgeRequest["debatePurpose"],
  limit: number,
): DebateCorpusRetrievalResult {
  if (lexical.length === 0) return semantic;

  const byId = new Map<string, RetrievedDebateCorpusItem>();
  const scores = new Map<string, number>();
  const addRank = (item: RetrievedDebateCorpusItem, rank: number) => {
    byId.set(item.item_id, item);
    scores.set(item.item_id, (scores.get(item.item_id) ?? 0) + 1 / (60 + rank));
  };
  semantic.candidateItems.forEach((item, index) => addRank(item, index + 1));
  lexical.forEach((item, index) => addRank(item, item.lexical_rank || index + 1));

  const fused = [...byId.values()]
    .sort(
      (left, right) =>
        (scores.get(right.item_id) ?? 0) - (scores.get(left.item_id) ?? 0),
    )
    .slice(0, limit);
  const semanticApproved = new Set(semantic.items.map((item) => item.item_id));
  const lexicalApproved = new Set(lexical.map((item) => item.item_id));
  const items = fused.filter(
    (item) => semanticApproved.has(item.item_id) || lexicalApproved.has(item.item_id),
  );

  return {
    ...semantic,
    enabled: true,
    items,
    candidateItems: fused,
    contextBlock: formatRetrievedDebateCorpusContext(items, purpose),
    cacheHit: semantic.cacheHit && lexical.length === 0,
    skippedReason: items.length > 0 ? undefined : semantic.skippedReason,
  };
}

async function searchDebate(
  request: DebateKnowledgeRequest,
): Promise<KnowledgeResult<DebateCorpusRetrievalResult>> {
  const startedAt = Date.now();
  const [semantic, lexical] = await deadline(
    Promise.all([
      retrieveDebateCorpusContext({
        purpose: request.debatePurpose,
        practiceLanguage: request.language,
        practiceTrack: request.practiceTrack ?? "debate",
        topic: request.topic,
        side: request.side,
        transcript: request.query,
        roundsText: request.roundsText,
        userId: request.userId,
        sourceRoute: request.sourceRoute,
        supabase: request.supabase,
        cacheEntry: request.cacheEntry,
        onCacheEntry: request.onCacheEntry,
      }),
      searchDebateLexically(request).catch(() => []),
    ]),
    request.deadlineMs ?? DEFAULT_DEADLINE_MS,
    "debate_knowledge",
  );
  const retrieval = fuseDebateResults(
    semantic,
    lexical,
    request.debatePurpose,
    request.limit ?? 8,
  );
  return {
    collection: "debate",
    context: retrieval.contextBlock,
    evidence: debateEvidence(retrieval).slice(0, request.limit ?? 8),
    data: retrieval,
    cacheKey: retrieval.cacheKey,
    cacheHit: retrieval.cacheHit,
    latencyMs: retrieval.latencyMs ?? Date.now() - startedAt,
    skippedReason: retrieval.skippedReason,
  };
}

async function searchIeltsExemplars(
  request: IeltsExemplarKnowledgeRequest,
): Promise<KnowledgeResult> {
  const startedAt = Date.now();
  const admin = request.supabase ?? tryCreateAdminClient();
  if (!admin) {
    return {
      collection: "ielts_exemplar",
      context: "",
      evidence: [],
      data: null,
      cacheKey: null,
      cacheHit: false,
      latencyMs: Date.now() - startedAt,
      skippedReason: "missing_supabase_service_role",
    };
  }

  const data =
    request.skill === "speaking"
      ? await deadline(
          loadSpeakingExemplars(admin, request),
          request.deadlineMs ?? 5_000,
          "ielts_speaking_grounding",
        )
      : await deadline(
          loadWritingExemplars(admin, request),
          request.deadlineMs ?? 5_000,
          "ielts_writing_grounding",
        );
  const values = Object.values(data)
    .flatMap((value) => (Array.isArray(value) ? value : [value]))
    .filter((value): value is string => typeof value === "string" && value.trim() !== "");
  const version =
    request.skill === "speaking"
      ? `${IELTS_SPEAKING_SCORER_BUNDLE_KEY}@${IELTS_SPEAKING_SCORER_BUNDLE_VERSION}`
      : `${IELTS_WRITING_SCORER_BUNDLE_KEY}@${IELTS_WRITING_SCORER_BUNDLE_VERSION}`;
  const evidence = values.slice(0, request.limit ?? 8).map((value, index) => ({
    sourceId: `${request.questionId}:${index}`,
    version,
    itemType: `${request.skill}_exemplar`,
    highlight: compact(value),
    score: index === 0 ? 1 : 0.9 - index * 0.05,
    reviewStatus: "approved",
  }));
  return {
    collection: "ielts_exemplar",
    context: evidence.map((item) => item.highlight).join("\n\n"),
    evidence,
    data,
    cacheKey: hash({
      collection: request.collection,
      skill: request.skill,
      questionId: request.questionId,
      questionType: request.questionType,
      version,
    }),
    cacheHit: false,
    latencyMs: Date.now() - startedAt,
    skippedReason: evidence.length === 0 ? "no_approved_exemplars" : undefined,
  };
}

function loadRubric(request: RubricKnowledgeRequest): KnowledgeResult {
  const knownRubrics: Record<string, { bundle: string; bundleVersion: number }> = {
    debate_v1: {
      bundle: PRACTICE_FEEDBACK_PROMPT_BUNDLE_KEY,
      bundleVersion: PRACTICE_FEEDBACK_PROMPT_BUNDLE_VERSION,
    },
    speaking_v1: {
      bundle: IELTS_SPEAKING_SCORER_BUNDLE_KEY,
      bundleVersion: IELTS_SPEAKING_SCORER_BUNDLE_VERSION,
    },
    ielts_speaking_v1: {
      bundle: IELTS_SPEAKING_SCORER_BUNDLE_KEY,
      bundleVersion: IELTS_SPEAKING_SCORER_BUNDLE_VERSION,
    },
    ielts_writing_v1: {
      bundle: IELTS_WRITING_SCORER_BUNDLE_KEY,
      bundleVersion: IELTS_WRITING_SCORER_BUNDLE_VERSION,
    },
  };
  const manifest = knownRubrics[request.rubricKey];
  const version = `${request.rubricKey}@${request.rubricVersion}`;
  if (!manifest) {
    return {
      collection: "ielts_rubric",
      context: "",
      evidence: [],
      data: null,
      cacheKey: hash({ version }),
      cacheHit: true,
      latencyMs: 0,
      skippedReason: "unknown_rubric",
    };
  }
  const context = `Rubric ${version}; prompt bundle ${manifest.bundle}@${manifest.bundleVersion}.`;
  return {
    collection: "ielts_rubric",
    context,
    evidence: [
      {
        sourceId: request.rubricKey,
        version,
        itemType: "rubric_manifest",
        highlight: context,
        score: 1,
        reviewStatus: "approved",
        metadata: manifest,
      },
    ],
    data: { ...manifest, rubricVersion: request.rubricVersion },
    cacheKey: hash({ version, manifest }),
    cacheHit: true,
    latencyMs: 0,
  };
}

async function searchLearnerHistory(
  request: LearnerHistoryKnowledgeRequest,
): Promise<KnowledgeResult> {
  const startedAt = Date.now();
  if (!request.userId) {
    return {
      collection: "learner_history",
      context: "",
      evidence: [],
      data: null,
      cacheKey: null,
      cacheHit: false,
      latencyMs: 0,
      skippedReason: "missing_user_id",
    };
  }
  const profile = await deadline(
    getCoachProfile(request.userId, request.language),
    request.deadlineMs ?? DEFAULT_DEADLINE_MS,
    "learner_profile",
  );
  const envelope = await deadline(
    getCoachContextEnvelope({
      userId: request.userId,
      profile,
      contextType: request.contextType,
      contextId: request.contextId,
      message: request.query,
      practiceLanguage: request.language,
    }),
    request.deadlineMs ?? DEFAULT_DEADLINE_MS,
    "learner_context",
  );
  const context = compact(envelope.promptContext, 6_000);
  return {
    collection: "learner_history",
    context,
    evidence: context
      ? [
          {
            sourceId: request.userId,
            version: "coach-context-v1",
            itemType: "learner_context",
            highlight: compact(envelope.focusSummary ?? context),
            score: 1,
            reviewStatus: "private",
          },
        ]
      : [],
    data: envelope,
    cacheKey: null,
    cacheHit: false,
    latencyMs: Date.now() - startedAt,
    skippedReason: context ? undefined : "no_learner_history",
  };
}

export function searchKnowledge(
  request: DebateKnowledgeRequest,
): Promise<KnowledgeResult<DebateCorpusRetrievalResult>>;
export function searchKnowledge(
  request: KnowledgeSearchRequest,
): Promise<KnowledgeResult>;
export async function searchKnowledge(
  request: KnowledgeSearchRequest,
): Promise<KnowledgeResult> {
  try {
    switch (request.collection) {
      case "debate":
        return await searchDebate(request);
      case "ielts_exemplar":
        return await searchIeltsExemplars(request);
      case "ielts_rubric":
        return loadRubric(request);
      case "learner_history":
        return await searchLearnerHistory(request);
    }
  } catch (error) {
    return {
      collection: request.collection,
      context: "",
      evidence: [],
      data: null,
      cacheKey: null,
      cacheHit: false,
      latencyMs: 0,
      skippedReason:
        error instanceof Error ? `knowledge_failed:${error.message}` : "knowledge_failed",
    };
  }
}

export const DEFAULT_PRACTICE_RUBRIC_VERSION = PRACTICE_FEEDBACK_RUBRIC_VERSION;
