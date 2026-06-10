"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  Clock3,
  FileSearch,
  Filter,
  Loader2,
  MessageSquareText,
  Search,
  ShieldCheck,
  Wand2,
  X,
  XCircle,
} from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import type { AiQualityRating, AiQualityRun, Profile } from "@/types";
import type {
  AiQualityOutputType,
  AiQualityReasonTag,
  AiQualityReviewStatus,
} from "@/lib/ai/quality-model";

type Row = AiQualityRun & {
  rating: AiQualityRating | null;
  user: Pick<Profile, "id" | "email" | "display_name"> | null;
  contextText: string | null;
};

type ProviderRequestRow = {
  id: string;
  provider: string;
  model: string;
  status: "success" | "error";
  source_route: string | null;
  output_type: string | null;
  latency_ms: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;
  cache_hit_tokens: number | null;
  cache_miss_tokens: number | null;
  reasoning_tokens: number | null;
  estimated_cost_usd: number | string | null;
  error_code: string | null;
  error_message: string | null;
  practice_attempt_id: string | null;
  analysis_job_id: string | null;
  ai_quality_run_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

type ProviderRequestGroup = {
  key: string;
  provider: string;
  model: string;
  sourceRoute: string | null;
  outputType: string | null;
  status: "success" | "error";
  requestCount: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  cacheHitTokens: number;
  cacheMissTokens: number;
  estimatedCostUsd: number;
  medianLatencyMs: number | null;
};

type CorpusRagStatus =
  | "injected"
  | "low_relevance"
  | "timed_out"
  | "failed"
  | "disabled"
  | "no_context"
  | "none";

type SttStatus = "normalized" | "fallback" | "warning" | "clean" | "none";
type SttRepairStatus =
  | "not_attempted"
  | "skipped"
  | "repaired"
  | "uncertain"
  | "hallucination_risk"
  | "failed";
type SttRepairFilter = "all" | "has_repair" | "needs_review" | "repaired" | "risk";
type OpponentOnlyRebuttalRisk = "low" | "medium" | "high";

interface DashboardResponse {
  kpis: {
    totalRuns: number;
    ratedRuns: number;
    usefulRate: number | null;
    fairRate: number | null;
    errorRate: number | null;
    medianLatencyMs: number | null;
    estimatedCostUsd: number;
    cacheHitRatio: number | null;
  };
  providerRequestKpis: {
    requestCount: number;
    errorCount: number;
    errorRate: number | null;
    totalTokens: number;
    inputTokens: number;
    outputTokens: number;
    estimatedCostUsd: number;
    cacheHitRatio: number | null;
    medianLatencyMs: number | null;
  };
  providerRequestGroups: ProviderRequestGroup[];
  providerRequestsByRunId: Record<string, ProviderRequestRow[]>;
  rows: Row[];
}

const EMPTY_ROWS: Row[] = [];

const OUTPUT_LABELS: Record<AiQualityOutputType, string> = {
  rebuttal: "Rebuttal",
  practice_judging: "Practice judge",
  duel_judging: "Duel judge",
};

const REASON_OPTIONS: Array<{ value: AiQualityReasonTag; label: string }> = [
  { value: "too_generic", label: "Too generic" },
  { value: "missed_argument", label: "Missed argument" },
  { value: "wrong_winner", label: "Wrong winner" },
  { value: "score_felt_wrong", label: "Score felt wrong" },
  { value: "vietnamese_sounded_weird", label: "Vietnamese weird" },
  { value: "hallucinated_evidence", label: "Invented evidence" },
  { value: "too_harsh", label: "Too harsh" },
  { value: "too_easy", label: "Too easy" },
  { value: "latency_too_slow", label: "Too slow" },
];

function formatPercent(value: number | null) {
  return value == null ? "—" : `${Math.round(value * 100)}%`;
}

function formatCost(value: number) {
  return `$${value.toFixed(value < 0.01 ? 4 : 2)}`;
}

function formatLatency(value: number | null) {
  if (value == null) return "—";
  return value > 1000 ? `${(value / 1000).toFixed(1)}s` : `${value}ms`;
}

function formatCompactNumber(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en", {
    notation: value >= 10_000 ? "compact" : "standard",
    maximumFractionDigits: value >= 10_000 ? 1 : 0,
  }).format(value);
}

function formatSignedNumber(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(Math.abs(value) < 1 ? 1 : 0)}`;
}

function formatSimilarity(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? value.toFixed(2)
    : "—";
}

function median(values: number[]) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[middle - 1] + sorted[middle]) / 2)
    : sorted[middle];
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function ratingTone(row: Row) {
  if (row.status === "error") return "error";
  if (row.review_status === "flagged") return "warning";
  if (row.rating?.usefulness === "no" || row.rating?.fairness === "too_harsh") {
    return "warning";
  }
  if (row.rating?.usefulness === "yes" || row.rating?.fairness === "fair") {
    return "success";
  }
  return "neutral";
}

function getCorpusMetadata(row: Row) {
  const metadata = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
  const retrievedCorpusItemIds = Array.isArray(metadata.retrievedCorpusItemIds)
    ? metadata.retrievedCorpusItemIds.filter((id): id is string => typeof id === "string")
    : [];
  const corpusRetrievalLogId =
    typeof metadata.corpusRetrievalLogId === "string"
      ? metadata.corpusRetrievalLogId
      : null;
  const candidateCorpusItemIds = Array.isArray(metadata.candidateCorpusItemIds)
    ? metadata.candidateCorpusItemIds.filter((id): id is string => typeof id === "string")
    : [];
  const skippedReason =
    typeof metadata.corpusRagSkippedReason === "string"
      ? metadata.corpusRagSkippedReason
      : null;
  const enabled =
    typeof metadata.corpusRagEnabled === "boolean" ? metadata.corpusRagEnabled : null;
  const topSimilarity =
    typeof metadata.corpusRagTopSimilarity === "number"
      ? metadata.corpusRagTopSimilarity
      : null;
  const avgTop3Similarity =
    typeof metadata.corpusRagAvgTop3Similarity === "number"
      ? metadata.corpusRagAvgTop3Similarity
      : null;
  const retrievedCorpusCount =
    typeof metadata.retrievedCorpusCount === "number"
      ? metadata.retrievedCorpusCount
      : retrievedCorpusItemIds.length;
  const candidateCorpusCount =
    typeof metadata.candidateCorpusCount === "number"
      ? metadata.candidateCorpusCount
      : Math.max(candidateCorpusItemIds.length, retrievedCorpusCount);
  const itemsAboveThresholdCount =
    typeof metadata.corpusRagItemsAboveThresholdCount === "number"
      ? metadata.corpusRagItemsAboveThresholdCount
      : null;
  const relevanceGatePassed =
    typeof metadata.corpusRagRelevanceGatePassed === "boolean"
      ? metadata.corpusRagRelevanceGatePassed
      : null;
  const cacheHit =
    typeof metadata.corpusRetrievalCacheHit === "boolean"
      ? metadata.corpusRetrievalCacheHit
      : false;
  const latencyMs =
    typeof metadata.corpusRetrievalLatencyMs === "number"
      ? metadata.corpusRetrievalLatencyMs
      : null;
  const thresholds =
    metadata.corpusRagRelevanceThresholds &&
    typeof metadata.corpusRagRelevanceThresholds === "object" &&
    !Array.isArray(metadata.corpusRagRelevanceThresholds)
      ? (metadata.corpusRagRelevanceThresholds as Record<string, unknown>)
      : null;
  const status: CorpusRagStatus =
    enabled === false || skippedReason === "flag_disabled"
      ? "disabled"
      : skippedReason === "low_relevance"
        ? "low_relevance"
        : skippedReason?.startsWith("retrieval_failed")
          ? skippedReason.toLowerCase().includes("abort")
            ? "timed_out"
            : "failed"
          : retrievedCorpusCount > 0
            ? "injected"
            : candidateCorpusCount > 0
              ? "no_context"
              : "none";
  return {
    retrievedCorpusItemIds,
    candidateCorpusItemIds,
    corpusRetrievalLogId,
    skippedReason,
    enabled,
    topSimilarity,
    avgTop3Similarity,
    candidateCorpusCount,
    retrievedCorpusCount,
    itemsAboveThresholdCount,
    relevanceGatePassed,
    cacheHit,
    latencyMs,
    thresholds,
    status,
  };
}

function readRecordArray(value: unknown, limit: number) {
  return Array.isArray(value)
    ? value
        .filter(
          (item): item is Record<string, unknown> =>
            Boolean(item && typeof item === "object" && !Array.isArray(item))
        )
        .slice(0, limit)
    : [];
}

function readStringArray(value: unknown, limit = 24) {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, limit)
    : [];
}

function getScoreMetadata(row: Row) {
  const metadata = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
  return {
    shadowVariant:
      typeof metadata.shadowVariant === "string" ? metadata.shadowVariant : "baseline",
    scoreBefore:
      typeof metadata.scoreBefore === "number" ? metadata.scoreBefore : null,
    scoreAfter:
      typeof metadata.scoreAfter === "number" ? metadata.scoreAfter : null,
    scoreDelta:
      typeof metadata.scoreDelta === "number" ? metadata.scoreDelta : null,
    softCapReasons: readStringArray(metadata.softCapReasons),
  };
}

function getTranscriptionMetadata(row: Row) {
  const metadata = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
  const transcription =
    metadata.transcription &&
    typeof metadata.transcription === "object" &&
    !Array.isArray(metadata.transcription)
      ? (metadata.transcription as Record<string, unknown>)
      : null;
  if (!transcription) return null;

  const warnings = readStringArray(transcription.warnings);
  const normalizationHints = readRecordArray(transcription.normalizationHints, 8);
  const alternatives = readRecordArray(transcription.alternativeProviders, 4);
  const repairSource =
    transcription.repair &&
    typeof transcription.repair === "object" &&
    !Array.isArray(transcription.repair)
      ? (transcription.repair as Record<string, unknown>)
      : null;
  const repair = repairSource
    ? {
        version:
          typeof repairSource.version === "number" ? repairSource.version : null,
        provider:
          typeof repairSource.provider === "string" ? repairSource.provider : "unknown",
        model:
          typeof repairSource.model === "string" ? repairSource.model : "unknown",
        status:
          typeof repairSource.status === "string"
            ? (repairSource.status as SttRepairStatus)
            : "skipped",
        mode:
          typeof repairSource.mode === "string" ? repairSource.mode : "shadow",
        latencyMs:
          typeof repairSource.latencyMs === "number" ? repairSource.latencyMs : null,
        rawTranscriptHash:
          typeof repairSource.rawTranscriptHash === "string"
            ? repairSource.rawTranscriptHash
            : null,
        editCount:
          typeof repairSource.editCount === "number"
            ? repairSource.editCount
            : readRecordArray(repairSource.edits, 24).length,
        uncertainSpanCount:
          typeof repairSource.uncertainSpanCount === "number"
            ? repairSource.uncertainSpanCount
            : readRecordArray(repairSource.uncertainSpans, 16).length,
        warnings: readStringArray(repairSource.warnings),
        hallucinationRisk:
          typeof repairSource.hallucinationRisk === "number"
            ? repairSource.hallucinationRisk
            : null,
        repairedAt:
          typeof repairSource.repairedAt === "string" ? repairSource.repairedAt : null,
        edits: readRecordArray(repairSource.edits, 24),
        uncertainSpans: readRecordArray(repairSource.uncertainSpans, 16),
      }
    : null;
  const provider =
    typeof transcription.provider === "string" ? transcription.provider : "unknown";
  const model = typeof transcription.model === "string" ? transcription.model : "unknown";
  const status: SttStatus =
    warnings.includes("fallback_transcript_used")
      ? "fallback"
      : normalizationHints.length > 0
        ? "normalized"
        : warnings.length > 0
          ? "warning"
          : "clean";
  return {
    provider,
    model,
    confidence:
      typeof transcription.confidence === "number" ? transcription.confidence : null,
    wordCount:
      typeof transcription.wordCount === "number" ? transcription.wordCount : null,
    warnings,
    normalizationHints,
    alternatives,
    hasJudgeTranscript: Boolean(transcription.hasJudgeTranscript),
    rawTranscriptPreview:
      typeof transcription.rawTranscriptPreview === "string"
        ? transcription.rawTranscriptPreview
        : null,
    judgeTranscriptPreview:
      typeof transcription.judgeTranscriptPreview === "string"
        ? transcription.judgeTranscriptPreview
        : null,
    repair,
    status,
  };
}

function computeSttRepairKpis(rows: Row[]) {
  const practiceRows = rows.filter((row) => row.output_type === "practice_judging");
  const repairRows = practiceRows
    .map((row) => ({ row, transcription: getTranscriptionMetadata(row) }))
    .filter((item) => item.transcription?.repair);
  const latencies = repairRows
    .map((item) => item.transcription?.repair?.latencyMs)
    .filter((value): value is number => typeof value === "number");
  const scoreDeltas = practiceRows
    .map((row) => getScoreMetadata(row).scoreDelta)
    .filter((value): value is number => typeof value === "number");
  const riskCount = repairRows.filter((item) => {
    const repair = item.transcription?.repair;
    return (
      repair?.status === "hallucination_risk" ||
      (repair?.hallucinationRisk ?? 0) >= 0.35
    );
  }).length;
  const needsReviewCount = repairRows.filter((item) => {
    const repair = item.transcription?.repair;
    return (
      repair?.status === "uncertain" ||
      repair?.status === "hallucination_risk" ||
      repair?.status === "failed" ||
      (repair?.warnings.length ?? 0) > 0
    );
  }).length;
  const reviewedCount = repairRows.filter((item) =>
    ["reviewed", "flagged", "ignored"].includes(item.row.review_status)
  ).length;
  const reviewedFailCount = repairRows.filter(
    (item) => item.row.review_status === "flagged"
  ).length;
  const reviewedPassCount = repairRows.filter(
    (item) => item.row.review_status === "reviewed"
  ).length;
  const avgScoreDelta = scoreDeltas.length
    ? scoreDeltas.reduce((sum, value) => sum + value, 0) / scoreDeltas.length
    : null;

  return {
    coverage: practiceRows.length ? repairRows.length / practiceRows.length : null,
    repairCount: repairRows.length,
    needsReviewCount,
    riskCount,
    medianLatencyMs: median(latencies),
    reviewedCount,
    reviewedPassCount,
    reviewedFailCount,
    avgScoreDelta,
  };
}

function getSpeedMetadata(row: Row) {
  const metadata = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
  const stageCacheHits =
    metadata.judgeStageCacheHits &&
    typeof metadata.judgeStageCacheHits === "object" &&
    !Array.isArray(metadata.judgeStageCacheHits)
      ? (metadata.judgeStageCacheHits as Record<string, unknown>)
      : null;
  const stageLatencies =
    metadata.judgeStageLatenciesMs &&
    typeof metadata.judgeStageLatenciesMs === "object" &&
    !Array.isArray(metadata.judgeStageLatenciesMs)
      ? (metadata.judgeStageLatenciesMs as Record<string, unknown>)
      : null;
  const stageCacheHitCount =
    typeof metadata.judgeStageCacheHitCount === "number"
      ? metadata.judgeStageCacheHitCount
      : stageCacheHits
        ? Object.values(stageCacheHits).filter(Boolean).length
        : null;
  const firstTokenLatencyMs =
    typeof metadata.firstTokenLatencyMs === "number"
      ? metadata.firstTokenLatencyMs
      : null;
  const streamMode =
    typeof metadata.rebuttalStreamMode === "string"
      ? metadata.rebuttalStreamMode
      : null;
  const duplicateCacheHit =
    typeof metadata.rebuttalDuplicateCacheHit === "boolean"
      ? metadata.rebuttalDuplicateCacheHit
      : false;

  return {
    hasSpeedData:
      Boolean(stageCacheHits) ||
      Boolean(stageLatencies) ||
      firstTokenLatencyMs != null ||
      Boolean(streamMode) ||
      duplicateCacheHit,
    stageCacheHits,
    stageLatencies,
    stageCacheHitCount,
    firstTokenLatencyMs,
    streamMode,
    duplicateCacheHit,
  };
}

function getOpponentQualityMetadata(row: Row) {
  const metadata = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
  const metrics =
    metadata.opponentQualityMetrics &&
    typeof metadata.opponentQualityMetrics === "object" &&
    !Array.isArray(metadata.opponentQualityMetrics)
      ? (metadata.opponentQualityMetrics as Record<string, unknown>)
      : null;
  const usage =
    metadata.opponentCasePlanUsage &&
    typeof metadata.opponentCasePlanUsage === "object" &&
    !Array.isArray(metadata.opponentCasePlanUsage)
      ? (metadata.opponentCasePlanUsage as Record<string, unknown>)
      : null;

  return {
    hasMetrics: Boolean(metrics),
    standaloneClaimCount:
      typeof metrics?.standaloneClaimCount === "number"
        ? metrics.standaloneClaimCount
        : null,
    hasStandaloneOffense:
      typeof metrics?.hasStandaloneOffense === "boolean"
        ? metrics.hasStandaloneOffense
        : null,
    hasWeighing:
      typeof metrics?.hasWeighing === "boolean" ? metrics.hasWeighing : null,
    hasInventedEvidenceRisk:
      typeof metrics?.hasInventedEvidenceRisk === "boolean"
        ? metrics.hasInventedEvidenceRisk
        : null,
    onlyRebuttalRisk:
      metrics?.onlyRebuttalRisk === "low" ||
      metrics?.onlyRebuttalRisk === "medium" ||
      metrics?.onlyRebuttalRisk === "high"
        ? (metrics.onlyRebuttalRisk as OpponentOnlyRebuttalRisk)
        : null,
    rebuttalCueParagraphRatio:
      typeof metrics?.rebuttalCueParagraphRatio === "number"
        ? metrics.rebuttalCueParagraphRatio
        : null,
    wordCount:
      typeof metrics?.wordCount === "number" ? metrics.wordCount : null,
    paragraphCount:
      typeof metrics?.paragraphCount === "number" ? metrics.paragraphCount : null,
    casePlanVersion:
      typeof metadata.opponentCasePlanVersion === "string"
        ? metadata.opponentCasePlanVersion
        : null,
    casePlanSource:
      typeof metadata.opponentCasePlanSource === "string"
        ? metadata.opponentCasePlanSource
        : null,
    casePlanCacheHit:
      typeof metadata.opponentCasePlanCacheHit === "boolean"
        ? metadata.opponentCasePlanCacheHit
        : null,
    casePlanLatencyMs:
      typeof metadata.opponentCasePlanLatencyMs === "number"
        ? metadata.opponentCasePlanLatencyMs
        : null,
    casePlanClaimCount:
      typeof metadata.opponentCasePlanClaimCount === "number"
        ? metadata.opponentCasePlanClaimCount
        : null,
    exactMotionSkeletonCount:
      typeof metadata.opponentCasePlanExactMotionSkeletonCount === "number"
        ? metadata.opponentCasePlanExactMotionSkeletonCount
        : null,
    casePlanInputTokens:
      typeof usage?.inputTokens === "number" ? usage.inputTokens : null,
    casePlanOutputTokens:
      typeof usage?.outputTokens === "number" ? usage.outputTokens : null,
    casePlanCacheHitTokens:
      typeof usage?.cacheHitTokens === "number" ? usage.cacheHitTokens : null,
    casePlanCacheMissTokens:
      typeof usage?.cacheMissTokens === "number" ? usage.cacheMissTokens : null,
  };
}

function computeOpponentQualityKpis(rows: Row[]) {
  const opponentRows = rows
    .map((row) => getOpponentQualityMetadata(row))
    .filter((item) => item.hasMetrics);
  const casePlanRows = opponentRows.filter((item) => item.casePlanVersion);
  const standaloneRows = opponentRows.filter(
    (item) => item.hasStandaloneOffense === true
  );
  const claimCounts = opponentRows
    .map((item) => item.standaloneClaimCount)
    .filter((value): value is number => typeof value === "number");
  const casePlanLatencies = casePlanRows
    .map((item) => item.casePlanLatencyMs)
    .filter((value): value is number => typeof value === "number");
  const cacheEligible = casePlanRows.filter(
    (item) => typeof item.casePlanCacheHit === "boolean"
  );

  return {
    coverage: rows.length ? opponentRows.length / rows.length : null,
    standaloneRate: opponentRows.length
      ? standaloneRows.length / opponentRows.length
      : null,
    avgStandaloneClaims: claimCounts.length
      ? claimCounts.reduce((sum, value) => sum + value, 0) / claimCounts.length
      : null,
    onlyRebuttalRiskCount: opponentRows.filter(
      (item) => item.onlyRebuttalRisk === "high"
    ).length,
    casePlanCount: casePlanRows.length,
    casePlanCacheHitRate: cacheEligible.length
      ? cacheEligible.filter((item) => item.casePlanCacheHit).length /
        cacheEligible.length
      : null,
    medianCasePlanLatencyMs: median(casePlanLatencies),
  };
}

function createQuery(params: Record<string, string>) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value && value !== "all") query.set(key, value);
  });
  return query.toString();
}

export function AiQualityDashboard() {
  const [rangeDays, setRangeDays] = useState("7");
  const [outputType, setOutputType] = useState("all");
  const [language, setLanguage] = useState("all");
  const [provider, setProvider] = useState("all");
  const [status, setStatus] = useState("all");
  const [usefulness, setUsefulness] = useState("all");
  const [fairness, setFairness] = useState("all");
  const [reasonTag, setReasonTag] = useState("all");
  const [sttRepairFilter, setSttRepairFilter] = useState<SttRepairFilter>("all");
  const [tab, setTab] = useState<"all" | "flagged">("all");
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [selectedRow, setSelectedRow] = useState<Row | null>(null);
  const [error, setError] = useState<string | null>(null);

  const query = useMemo(
    () =>
      createQuery({
        rangeDays,
        outputType,
        language,
        provider,
        status,
        usefulness,
        fairness,
        reasonTag,
        tab: tab === "flagged" ? "flagged" : "",
      }),
    [fairness, language, outputType, provider, rangeDays, reasonTag, status, tab, usefulness]
  );

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/ai-quality?${query}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          const body = (await response.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error || "Unable to load AI quality data");
        }
        return response.json() as Promise<DashboardResponse>;
      })
      .then((nextData) => {
        if (!cancelled) {
          setData(nextData);
          setError(null);
        }
      })
      .catch((nextError) => {
        if (!cancelled) {
          setData(null);
          setError(nextError instanceof Error ? nextError.message : "Unable to load data");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [query]);

  const rows = data?.rows ?? EMPTY_ROWS;
  const displayRows = useMemo(
    () =>
      rows.filter((row) => {
        if (sttRepairFilter === "all") return true;
        const transcription = getTranscriptionMetadata(row);
        const repair = transcription?.repair;
        if (sttRepairFilter === "has_repair") return Boolean(repair);
        if (sttRepairFilter === "repaired") return repair?.status === "repaired";
        if (sttRepairFilter === "risk") {
          return (
            repair?.status === "hallucination_risk" ||
            (repair?.hallucinationRisk ?? 0) >= 0.35
          );
        }
        if (sttRepairFilter === "needs_review") {
          return Boolean(
            repair &&
              (repair.status === "uncertain" ||
                repair.status === "hallucination_risk" ||
                repair.status === "failed" ||
                repair.warnings.length > 0)
          );
        }
        return true;
      }),
    [rows, sttRepairFilter]
  );
  const sttRepairKpis = useMemo(() => computeSttRepairKpis(rows), [rows]);
  const opponentQualityKpis = useMemo(
    () => computeOpponentQualityKpis(rows),
    [rows]
  );
  const kpis = data?.kpis;
  const providerKpis = data?.providerRequestKpis;
  const providerGroups = data?.providerRequestGroups ?? [];
  const loading = data === null && error === null;

  const updateReview = async (
    row: Row,
    reviewStatus: AiQualityReviewStatus
  ) => {
    const response = await fetch(`/api/admin/ai-quality/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reviewStatus, adminNotes: row.admin_notes ?? "" }),
    });
    if (!response.ok) return;
    const body = (await response.json()) as { run: AiQualityRun };
    setData((current) =>
      current
        ? {
            ...current,
            rows: current.rows.map((item) =>
              item.id === row.id ? { ...item, ...body.run } : item
            ),
          }
        : current
    );
    setSelectedRow((current) =>
      current?.id === row.id ? { ...current, ...body.run } : current
    );
  };

  return (
    <div className="min-h-full bg-background px-4 py-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/8 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
              <BrainCircuit className="h-3.5 w-3.5" />
              AI Quality
            </div>
            <h1 className="mt-3 text-3xl font-bold tracking-normal text-on-surface">
              Feedback quality loop
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-on-surface-variant">
              Review beta ratings, model behavior, cost, latency, and flagged AI outputs.
            </p>
          </div>
          <div className="flex rounded-2xl border border-outline-variant/15 bg-surface p-1">
            {(["all", "flagged"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setTab(value)}
                className={cn(
                  "h-10 rounded-xl px-4 text-sm font-semibold capitalize transition",
                  tab === value
                    ? "bg-primary text-on-primary"
                    : "text-on-surface-variant hover:bg-surface-container"
                )}
              >
                {value}
              </button>
            ))}
          </div>
        </header>

        <section className="grid gap-3 md:grid-cols-4 xl:grid-cols-7">
          <Kpi label="Runs" value={String(kpis?.totalRuns ?? "—")} icon={BrainCircuit} />
          <Kpi label="Rated" value={String(kpis?.ratedRuns ?? "—")} icon={MessageSquareText} />
          <Kpi label="Useful" value={formatPercent(kpis?.usefulRate ?? null)} icon={CheckCircle2} />
          <Kpi label="Fair" value={formatPercent(kpis?.fairRate ?? null)} icon={ShieldCheck} />
          <Kpi label="Errors" value={formatPercent(kpis?.errorRate ?? null)} icon={AlertTriangle} />
          <Kpi label="Median latency" value={formatLatency(kpis?.medianLatencyMs ?? null)} icon={Clock3} />
          <Kpi label="Est. cost" value={formatCost(kpis?.estimatedCostUsd ?? 0)} icon={Search} />
        </section>

        <section className="grid gap-3 md:grid-cols-4">
          <Kpi
            label="Provider requests"
            value={formatCompactNumber(providerKpis?.requestCount)}
            icon={BrainCircuit}
          />
          <Kpi
            label="Provider errors"
            value={
              providerKpis
                ? `${providerKpis.errorCount} · ${formatPercent(providerKpis.errorRate)}`
                : "—"
            }
            icon={AlertTriangle}
          />
          <Kpi
            label="Provider tokens"
            value={formatCompactNumber(providerKpis?.totalTokens)}
            icon={Search}
          />
          <Kpi
            label="DeepSeek cache"
            value={formatPercent(providerKpis?.cacheHitRatio ?? null)}
            icon={Clock3}
          />
        </section>

        <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-7">
          <Kpi
            label="Opponent coverage"
            value={formatPercent(opponentQualityKpis.coverage)}
            icon={BrainCircuit}
          />
          <Kpi
            label="Standalone offense"
            value={formatPercent(opponentQualityKpis.standaloneRate)}
            icon={MessageSquareText}
          />
          <Kpi
            label="Avg claims"
            value={
              opponentQualityKpis.avgStandaloneClaims == null
                ? "—"
                : opponentQualityKpis.avgStandaloneClaims.toFixed(1)
            }
            icon={CheckCircle2}
          />
          <Kpi
            label="Only-rebuttal risk"
            value={formatCompactNumber(opponentQualityKpis.onlyRebuttalRiskCount)}
            icon={AlertTriangle}
          />
          <Kpi
            label="Case plans"
            value={formatCompactNumber(opponentQualityKpis.casePlanCount)}
            icon={FileSearch}
          />
          <Kpi
            label="Plan cache"
            value={formatPercent(opponentQualityKpis.casePlanCacheHitRate)}
            icon={Clock3}
          />
          <Kpi
            label="Plan latency"
            value={formatLatency(opponentQualityKpis.medianCasePlanLatencyMs)}
            icon={Search}
          />
        </section>

        <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-7">
          <Kpi
            label="STT repair coverage"
            value={formatPercent(sttRepairKpis.coverage)}
            icon={Wand2}
          />
          <Kpi
            label="Repair runs"
            value={formatCompactNumber(sttRepairKpis.repairCount)}
            icon={FileSearch}
          />
          <Kpi
            label="Needs review"
            value={formatCompactNumber(sttRepairKpis.needsReviewCount)}
            icon={AlertTriangle}
          />
          <Kpi
            label="Risk count"
            value={formatCompactNumber(sttRepairKpis.riskCount)}
            icon={ShieldCheck}
          />
          <Kpi
            label="Repair latency"
            value={formatLatency(sttRepairKpis.medianLatencyMs)}
            icon={Clock3}
          />
          <Kpi
            label="Avg score delta"
            value={formatSignedNumber(sttRepairKpis.avgScoreDelta)}
            icon={Search}
          />
          <Kpi
            label="Reviewed pass/fail"
            value={`${sttRepairKpis.reviewedPassCount}/${sttRepairKpis.reviewedFailCount}`}
            icon={CheckCircle2}
          />
        </section>

        <section className="rounded-2xl border border-outline-variant/15 bg-surface p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-on-surface">
            <Filter className="h-4 w-4 text-primary" />
            Filters
          </div>
          <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-9">
            <Select label="Range" value={rangeDays} onChange={setRangeDays} options={[["7", "7d"], ["30", "30d"], ["90", "90d"]]} />
            <Select label="Type" value={outputType} onChange={setOutputType} options={[["all", "All"], ["rebuttal", "Rebuttal"], ["practice_judging", "Practice judge"], ["duel_judging", "Duel judge"]]} />
            <Select label="Language" value={language} onChange={setLanguage} options={[["all", "All"], ["en", "English"], ["vi", "Vietnamese"]]} />
            <Select label="Provider" value={provider} onChange={setProvider} options={[["all", "All"], ["DeepSeek", "DeepSeek"], ["google", "Gemini"]]} />
            <Select label="Status" value={status} onChange={setStatus} options={[["all", "All"], ["success", "Success"], ["error", "Error"]]} />
            <Select label="Useful" value={usefulness} onChange={setUsefulness} options={[["all", "All"], ["yes", "Yes"], ["somewhat", "Somewhat"], ["no", "No"]]} />
            <Select label="Fairness" value={fairness} onChange={setFairness} options={[["all", "All"], ["too_harsh", "Too harsh"], ["fair", "Fair"], ["too_generous", "Too generous"]]} />
            <Select label="Reason" value={reasonTag} onChange={setReasonTag} options={[["all", "All"], ...REASON_OPTIONS.map((item) => [item.value, item.label] as [string, string])]} />
            <Select label="STT Repair" value={sttRepairFilter} onChange={(value) => setSttRepairFilter(value as SttRepairFilter)} options={[["all", "All"], ["has_repair", "Has repair"], ["needs_review", "Needs review"], ["repaired", "Repaired"], ["risk", "Risk"]]} />
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-outline-variant/15 bg-surface">
          {loading ? (
            <div className="flex h-64 items-center justify-center text-on-surface-variant">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Loading AI quality data
            </div>
          ) : error ? (
            <div className="flex h-64 items-center justify-center text-error">
              <AlertTriangle className="mr-2 h-5 w-5" />
              {error}
            </div>
          ) : displayRows.length === 0 ? (
            <div className="flex h-64 items-center justify-center text-on-surface-variant">
              No AI quality runs match these filters yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-outline-variant/10">
                <thead className="bg-surface-container-low">
                  <tr className="text-left text-xs font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
                    <th className="px-4 py-3">Output</th>
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">Model</th>
                    <th className="px-4 py-3">Rating</th>
                    <th className="px-4 py-3">Result</th>
                    <th className="px-4 py-3">Latency</th>
                    <th className="px-4 py-3">Cost</th>
                    <th className="px-4 py-3">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10 text-sm">
                  {displayRows.map((row) => (
                    <tr
                      key={row.id}
                      onClick={() => setSelectedRow(row)}
                      className="cursor-pointer hover:bg-surface-container-low"
                    >
                      <td className="px-4 py-3">
                        <div className="font-semibold text-on-surface">
                          {OUTPUT_LABELS[row.output_type]}
                        </div>
                        <div className="text-xs text-on-surface-variant">
                          {row.practice_language?.toUpperCase() ?? "—"} · {row.debate_format ?? "—"}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-on-surface-variant">
                        {row.user?.display_name || row.user?.email || row.user_id.slice(0, 8)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-on-surface">{row.provider}</div>
                        <div className="max-w-[180px] truncate text-xs text-on-surface-variant">
                          {row.model}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <RatingPill tone={ratingTone(row)}>
                          {row.rating?.fairness ?? row.rating?.usefulness ?? row.review_status}
                        </RatingPill>
                      </td>
                      <td className="px-4 py-3 text-on-surface-variant">
                        {row.winner ? `${row.winner}${row.score != null ? ` · ${row.score}` : ""}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-on-surface-variant">
                        {formatLatency(row.latency_ms)}
                      </td>
                      <td className="px-4 py-3 text-on-surface-variant">
                        {formatCost(Number(row.estimated_cost_usd ?? 0))}
                      </td>
                      <td className="px-4 py-3 text-on-surface-variant">
                        {formatDate(row.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="overflow-hidden rounded-2xl border border-outline-variant/15 bg-surface">
          <div className="flex flex-col gap-1 border-b border-outline-variant/10 bg-surface-container-low px-4 py-3">
            <h2 className="font-semibold text-on-surface">Provider Requests</h2>
            <p className="text-xs text-on-surface-variant">
              Raw API-call counts grouped by provider, model, route, output type, and status.
            </p>
          </div>
          {providerGroups.length === 0 ? (
            <div className="flex h-32 items-center justify-center text-sm text-on-surface-variant">
              No provider requests match these filters yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-outline-variant/10">
                <thead className="bg-surface-container-low">
                  <tr className="text-left text-xs font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
                    <th className="px-4 py-3">Provider</th>
                    <th className="px-4 py-3">Route</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Requests</th>
                    <th className="px-4 py-3">Tokens</th>
                    <th className="px-4 py-3">Cache</th>
                    <th className="px-4 py-3">Median latency</th>
                    <th className="px-4 py-3">Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10 text-sm">
                  {providerGroups.slice(0, 24).map((group) => (
                    <tr key={group.key}>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-on-surface">{group.provider}</div>
                        <div className="max-w-[180px] truncate text-xs text-on-surface-variant">
                          {group.model}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-on-surface-variant">
                        <div>{group.outputType ?? "—"}</div>
                        <div className="max-w-[220px] truncate text-xs">
                          {group.sourceRoute ?? "unknown route"}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <RatingPill tone={group.status === "success" ? "success" : "error"}>
                          {group.status}
                        </RatingPill>
                      </td>
                      <td className="px-4 py-3 font-semibold text-on-surface">
                        {formatCompactNumber(group.requestCount)}
                      </td>
                      <td className="px-4 py-3 text-on-surface-variant">
                        {formatCompactNumber(group.totalTokens)}
                      </td>
                      <td className="px-4 py-3 text-on-surface-variant">
                        {group.cacheHitTokens || group.cacheMissTokens
                          ? `${formatCompactNumber(group.cacheHitTokens)} hit / ${formatCompactNumber(group.cacheMissTokens)} miss`
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-on-surface-variant">
                        {formatLatency(group.medianLatencyMs)}
                      </td>
                      <td className="px-4 py-3 text-on-surface-variant">
                        {formatCost(group.estimatedCostUsd)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {selectedRow && (
        <DetailDrawer
          row={selectedRow}
          providerRequests={data?.providerRequestsByRunId[selectedRow.id] ?? []}
          onClose={() => setSelectedRow(null)}
          onReview={updateReview}
        />
      )}
    </div>
  );
}

function Kpi({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof BrainCircuit;
}) {
  return (
    <div className="rounded-2xl border border-outline-variant/15 bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
          {label}
        </div>
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div className="mt-3 text-2xl font-bold text-on-surface">{value}</div>
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-on-surface-variant">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 h-10 w-full rounded-xl border border-outline-variant/20 bg-surface-container-low px-3 text-sm text-on-surface outline-none focus:border-primary/50"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

function RatingPill({
  tone,
  children,
}: {
  tone: "success" | "warning" | "error" | "neutral";
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize",
        tone === "success" && "bg-secondary/10 text-secondary",
        tone === "warning" && "bg-warning/15 text-warning",
        tone === "error" && "bg-error-container text-error",
        tone === "neutral" && "bg-surface-container text-on-surface-variant"
      )}
    >
      {children}
    </span>
  );
}

function DetailDrawer({
  row,
  providerRequests,
  onClose,
  onReview,
}: {
  row: Row;
  providerRequests: ProviderRequestRow[];
  onClose: () => void;
  onReview: (row: Row, reviewStatus: AiQualityReviewStatus) => Promise<void>;
}) {
  const corpusMetadata = getCorpusMetadata(row);
  const transcriptionMetadata = getTranscriptionMetadata(row);
  const speedMetadata = getSpeedMetadata(row);
  const scoreMetadata = getScoreMetadata(row);
  const opponentQualityMetadata = getOpponentQualityMetadata(row);

  return (
    <div className="fixed inset-0 z-50 bg-black/20">
      <div className="absolute right-0 top-0 h-full w-full max-w-2xl overflow-y-auto border-l border-outline-variant/20 bg-surface p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
              {OUTPUT_LABELS[row.output_type]}
            </div>
            <h2 className="mt-2 text-2xl font-bold text-on-surface">
              {row.topic_title || "Untitled AI run"}
            </h2>
            <p className="mt-1 text-sm text-on-surface-variant">
              {row.provider} · {row.model} · {formatDate(row.created_at)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-on-surface-variant hover:bg-surface-container"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <MiniMetric label="Latency" value={formatLatency(row.latency_ms)} />
          <MiniMetric label="Cost" value={formatCost(Number(row.estimated_cost_usd ?? 0))} />
          <MiniMetric
            label="Tokens"
            value={String(
              (row.total_tokens ?? (row.input_tokens ?? 0) + (row.output_tokens ?? 0)) || "—"
            )}
          />
        </div>

        <div className="mt-6 rounded-2xl border border-outline-variant/15 bg-surface-container-low p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-semibold text-on-surface">Provider calls</h3>
            <span className="rounded-full bg-primary/8 px-2.5 py-1 text-xs font-semibold text-primary">
              {providerRequests.length} requests
            </span>
          </div>
          {providerRequests.length === 0 ? (
            <p className="mt-3 text-sm text-on-surface-variant">
              No linked provider request rows yet.
            </p>
          ) : (
            <div className="mt-4 overflow-hidden rounded-xl border border-outline-variant/15 bg-surface">
              <table className="min-w-full divide-y divide-outline-variant/10 text-xs">
                <thead className="bg-surface-container-low text-left font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
                  <tr>
                    <th className="px-3 py-2">Call</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Tokens</th>
                    <th className="px-3 py-2">Cache</th>
                    <th className="px-3 py-2">Latency</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {providerRequests.slice(0, 12).map((request) => {
                    const stage =
                      request.metadata && typeof request.metadata.stage === "string"
                        ? request.metadata.stage
                        : request.output_type;
                    return (
                      <tr key={request.id}>
                        <td className="px-3 py-2">
                          <div className="font-semibold text-on-surface">
                            {request.provider} · {stage ?? "call"}
                          </div>
                          <div className="max-w-[220px] truncate text-on-surface-variant">
                            {request.model}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <RatingPill
                            tone={request.status === "success" ? "success" : "error"}
                          >
                            {request.error_code ?? request.status}
                          </RatingPill>
                        </td>
                        <td className="px-3 py-2 text-on-surface-variant">
                          {formatCompactNumber(request.total_tokens)}
                        </td>
                        <td className="px-3 py-2 text-on-surface-variant">
                          {request.cache_hit_tokens || request.cache_miss_tokens
                            ? `${formatCompactNumber(request.cache_hit_tokens)} / ${formatCompactNumber(request.cache_miss_tokens)}`
                            : "—"}
                        </td>
                        <td className="px-3 py-2 text-on-surface-variant">
                          {formatLatency(request.latency_ms)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {speedMetadata.hasSpeedData && (
          <div className="mt-6 rounded-2xl border border-outline-variant/15 bg-surface-container-low p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-semibold text-on-surface">Speed pass</h3>
              {speedMetadata.streamMode && (
                <span className="rounded-full bg-primary/8 px-2.5 py-1 text-xs font-semibold text-primary">
                  {speedMetadata.streamMode}
                </span>
              )}
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-4">
              <MiniMetric
                label="Stage cache"
                value={
                  speedMetadata.stageCacheHitCount == null
                    ? "—"
                    : `${speedMetadata.stageCacheHitCount} hit`
                }
              />
              <MiniMetric
                label="First token"
                value={formatLatency(speedMetadata.firstTokenLatencyMs)}
              />
              <MiniMetric
                label="Duplicate"
                value={speedMetadata.duplicateCacheHit ? "hit" : "miss"}
              />
              <MiniMetric
                label="Speech map"
                value={formatLatency(
                  typeof speedMetadata.stageLatencies?.speech_map === "number"
                    ? speedMetadata.stageLatencies.speech_map
                    : null
                )}
              />
            </div>
          </div>
        )}

        {(opponentQualityMetadata.hasMetrics ||
          opponentQualityMetadata.casePlanVersion) && (
          <div className="mt-6 rounded-2xl border border-outline-variant/15 bg-surface-container-low p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold text-on-surface">
                  Opponent quality
                </h3>
                <p className="mt-1 text-xs text-on-surface-variant">
                  Standalone offense, case-plan usage, and DeepSeek cache signals.
                </p>
              </div>
              {opponentQualityMetadata.onlyRebuttalRisk && (
                <RatingPill
                  tone={
                    opponentQualityMetadata.onlyRebuttalRisk === "high"
                      ? "warning"
                      : opponentQualityMetadata.onlyRebuttalRisk === "medium"
                        ? "neutral"
                        : "success"
                  }
                >
                  {opponentQualityMetadata.onlyRebuttalRisk} risk
                </RatingPill>
              )}
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-4">
              <MiniMetric
                label="Standalone claims"
                value={String(opponentQualityMetadata.standaloneClaimCount ?? "—")}
              />
              <MiniMetric
                label="Has offense"
                value={
                  opponentQualityMetadata.hasStandaloneOffense == null
                    ? "—"
                    : opponentQualityMetadata.hasStandaloneOffense
                      ? "yes"
                      : "no"
                }
              />
              <MiniMetric
                label="Has weighing"
                value={
                  opponentQualityMetadata.hasWeighing == null
                    ? "—"
                    : opponentQualityMetadata.hasWeighing
                      ? "yes"
                      : "no"
                }
              />
              <MiniMetric
                label="Evidence risk"
                value={
                  opponentQualityMetadata.hasInventedEvidenceRisk == null
                    ? "—"
                    : opponentQualityMetadata.hasInventedEvidenceRisk
                      ? "yes"
                      : "no"
                }
              />
              <MiniMetric
                label="Rebuttal ratio"
                value={formatPercent(
                  opponentQualityMetadata.rebuttalCueParagraphRatio
                )}
              />
              <MiniMetric
                label="Case plan"
                value={opponentQualityMetadata.casePlanSource ?? "—"}
              />
              <MiniMetric
                label="Plan cache"
                value={
                  opponentQualityMetadata.casePlanCacheHit == null
                    ? "—"
                    : opponentQualityMetadata.casePlanCacheHit
                      ? "hit"
                      : "miss"
                }
              />
              <MiniMetric
                label="Plan latency"
                value={formatLatency(opponentQualityMetadata.casePlanLatencyMs)}
              />
              <MiniMetric
                label="Exact skeletons"
                value={String(
                  opponentQualityMetadata.exactMotionSkeletonCount ?? "—"
                )}
              />
              <MiniMetric
                label="Plan tokens"
                value={
                  opponentQualityMetadata.casePlanInputTokens ||
                  opponentQualityMetadata.casePlanOutputTokens
                    ? `${formatCompactNumber(opponentQualityMetadata.casePlanInputTokens)} in / ${formatCompactNumber(opponentQualityMetadata.casePlanOutputTokens)} out`
                    : "—"
                }
              />
              <MiniMetric
                label="Plan cache tokens"
                value={
                  opponentQualityMetadata.casePlanCacheHitTokens ||
                  opponentQualityMetadata.casePlanCacheMissTokens
                    ? `${formatCompactNumber(opponentQualityMetadata.casePlanCacheHitTokens)} hit / ${formatCompactNumber(opponentQualityMetadata.casePlanCacheMissTokens)} miss`
                    : "—"
                }
              />
              <MiniMetric
                label="Words"
                value={String(opponentQualityMetadata.wordCount ?? "—")}
              />
              <MiniMetric
                label="Paragraphs"
                value={String(opponentQualityMetadata.paragraphCount ?? "—")}
              />
            </div>
          </div>
        )}

        <div className="mt-6 rounded-2xl border border-outline-variant/15 bg-surface-container-low p-4">
          <h3 className="font-semibold text-on-surface">User rating</h3>
          {row.rating ? (
            <div className="mt-3 space-y-2 text-sm text-on-surface-variant">
              <p>Usefulness: {row.rating.usefulness ?? "—"}</p>
              <p>Fairness: {row.rating.fairness ?? "—"}</p>
              <p>Tags: {row.rating.reason_tags.join(", ") || "—"}</p>
              <p>Comment: {row.rating.comment || "—"}</p>
            </div>
          ) : (
            <p className="mt-3 text-sm text-on-surface-variant">No rating yet.</p>
          )}
        </div>

        <div className="mt-6 space-y-4">
          {transcriptionMetadata && (
            <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-low p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-semibold text-on-surface">STT Quality</h3>
                <SttStatusPill status={transcriptionMetadata.status} />
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-4">
                <MiniMetric label="Provider" value={transcriptionMetadata.provider} />
                <MiniMetric label="Model" value={transcriptionMetadata.model} />
                <MiniMetric
                  label="Confidence"
                  value={formatSimilarity(transcriptionMetadata.confidence)}
                />
                <MiniMetric
                  label="Words"
                  value={String(transcriptionMetadata.wordCount ?? "—")}
                />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {transcriptionMetadata.alternatives.map((alternative, index) => (
                  <span
                    key={`${String(alternative.provider)}-${index}`}
                    className={cn(
                      "rounded-lg px-2.5 py-1.5 text-xs font-semibold",
                      alternative.selected
                        ? "bg-secondary/10 text-secondary"
                        : alternative.errorCode
                          ? "bg-warning/10 text-warning"
                          : "bg-surface text-on-surface-variant"
                    )}
                  >
                    {String(alternative.provider ?? "provider")} ·{" "}
                    {alternative.selected ? "selected" : alternative.errorCode ? "fallback" : "candidate"}
                    {Array.isArray(alternative.qualityFlags) &&
                      alternative.qualityFlags.length > 0
                      ? ` · ${alternative.qualityFlags
                          .map((flag) => String(flag).replaceAll("_", " "))
                          .join(", ")}`
                      : ""}
                  </span>
                ))}
                {transcriptionMetadata.warnings.map((warning) => (
                  <span
                    key={warning}
                    className="rounded-lg bg-warning/10 px-2.5 py-1.5 text-xs font-semibold text-warning"
                  >
                    {warning.replaceAll("_", " ")}
                  </span>
                ))}
              </div>
              {transcriptionMetadata.normalizationHints.length > 0 && (
                <div className="mt-4 overflow-hidden rounded-xl border border-outline-variant/15 bg-surface">
                  <table className="min-w-full divide-y divide-outline-variant/10 text-xs">
                    <thead className="bg-surface-container-low text-left font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
                      <tr>
                        <th className="px-3 py-2">Raw</th>
                        <th className="px-3 py-2">Normalized</th>
                        <th className="px-3 py-2">Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/10">
                      {transcriptionMetadata.normalizationHints.map((hint, index) => (
                        <tr key={`${String(hint.raw)}-${index}`}>
                          <td className="px-3 py-2 font-mono text-warning">
                            {String(hint.raw ?? "—")}
                          </td>
                          <td className="px-3 py-2 font-semibold text-secondary">
                            {String(hint.normalized ?? "—")}
                          </td>
                          <td className="px-3 py-2 text-on-surface-variant">
                            {String(hint.reason ?? "Possible STT artifact")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="mt-3 rounded-xl border border-primary/15 bg-primary/8 px-3 py-2 text-xs font-semibold text-primary">
                Possible speech-to-text artifacts: do not penalize pronunciation without audio evidence.
              </p>
            </div>
          )}
          {transcriptionMetadata?.repair && (
            <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-low p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-on-surface">STT Repair</h3>
                  <p className="mt-1 text-xs text-on-surface-variant">
                    v{transcriptionMetadata.repair.version ?? "—"} ·{" "}
                    {transcriptionMetadata.repair.provider} ·{" "}
                    {transcriptionMetadata.repair.model}
                  </p>
                </div>
                <SttRepairStatusPill status={transcriptionMetadata.repair.status} />
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-4">
                <MiniMetric label="Mode" value={String(transcriptionMetadata.repair.mode)} />
                <MiniMetric
                  label="Latency"
                  value={formatLatency(transcriptionMetadata.repair.latencyMs)}
                />
                <MiniMetric
                  label="Edits"
                  value={String(transcriptionMetadata.repair.editCount ?? 0)}
                />
                <MiniMetric
                  label="Risk"
                  value={formatSimilarity(transcriptionMetadata.repair.hallucinationRisk)}
                />
                <MiniMetric
                  label="Score before"
                  value={String(scoreMetadata.scoreBefore ?? "—")}
                />
                <MiniMetric
                  label="Score after"
                  value={String(scoreMetadata.scoreAfter ?? "—")}
                />
                <MiniMetric
                  label="Score delta"
                  value={formatSignedNumber(scoreMetadata.scoreDelta)}
                />
                <MiniMetric
                  label="Variant"
                  value={scoreMetadata.shadowVariant.replaceAll("_", " ")}
                />
              </div>
              {(transcriptionMetadata.repair.warnings.length > 0 ||
                scoreMetadata.softCapReasons.length > 0) && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {transcriptionMetadata.repair.warnings.map((warning) => (
                    <span
                      key={warning}
                      className="rounded-lg bg-warning/10 px-2.5 py-1.5 text-xs font-semibold text-warning"
                    >
                      {warning.replaceAll("_", " ")}
                    </span>
                  ))}
                  {scoreMetadata.softCapReasons.map((reason) => (
                    <span
                      key={reason}
                      className="rounded-lg bg-primary/8 px-2.5 py-1.5 text-xs font-semibold text-primary"
                    >
                      {reason}
                    </span>
                  ))}
                </div>
              )}
              {(transcriptionMetadata.rawTranscriptPreview ||
                transcriptionMetadata.judgeTranscriptPreview) && (
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <TranscriptPreview
                    title="Raw preview"
                    value={transcriptionMetadata.rawTranscriptPreview}
                  />
                  <TranscriptPreview
                    title="Repaired preview"
                    value={transcriptionMetadata.judgeTranscriptPreview}
                  />
                </div>
              )}
              {transcriptionMetadata.repair.edits.length > 0 && (
                <div className="mt-4 overflow-hidden rounded-xl border border-outline-variant/15 bg-surface">
                  <table className="min-w-full divide-y divide-outline-variant/10 text-xs">
                    <thead className="bg-surface-container-low text-left font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
                      <tr>
                        <th className="px-3 py-2">Raw</th>
                        <th className="px-3 py-2">Repair</th>
                        <th className="px-3 py-2">Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/10">
                      {transcriptionMetadata.repair.edits.map((edit, index) => (
                        <tr key={`${String(edit.raw)}-${index}`}>
                          <td className="max-w-[180px] break-words px-3 py-2 font-mono text-warning">
                            {String(edit.raw ?? "—")}
                          </td>
                          <td className="max-w-[180px] break-words px-3 py-2 font-semibold text-secondary">
                            {String(edit.repaired ?? "—")}
                          </td>
                          <td className="max-w-[260px] break-words px-3 py-2 text-on-surface-variant">
                            {String(edit.category ?? "edit")} · {String(edit.reason ?? "—")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {transcriptionMetadata.repair.uncertainSpans.length > 0 && (
                <div className="mt-4 space-y-2">
                  {transcriptionMetadata.repair.uncertainSpans.map((span, index) => (
                    <div
                      key={`${String(span.text)}-${index}`}
                      className="rounded-xl border border-warning/20 bg-warning/10 px-3 py-2 text-xs text-warning"
                    >
                      <div className="font-semibold">{String(span.text ?? "—")}</div>
                      <div className="mt-1 text-warning/80">
                        {String(span.reason ?? "uncertain")}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {(corpusMetadata.enabled != null ||
            corpusMetadata.corpusRetrievalLogId ||
            corpusMetadata.candidateCorpusCount > 0 ||
            corpusMetadata.retrievedCorpusCount > 0) && (
            <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-low p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-semibold text-on-surface">Corpus RAG quality</h3>
                <CorpusRagStatusPill status={corpusMetadata.status} />
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-4">
                <MiniMetric
                  label="Top sim"
                  value={formatSimilarity(corpusMetadata.topSimilarity)}
                />
                <MiniMetric
                  label="Avg top-3"
                  value={formatSimilarity(corpusMetadata.avgTop3Similarity)}
                />
                <MiniMetric
                  label="Injected"
                  value={`${corpusMetadata.retrievedCorpusCount}/${corpusMetadata.candidateCorpusCount}`}
                />
                <MiniMetric label="RAG latency" value={formatLatency(corpusMetadata.latencyMs)} />
                <MiniMetric label="Cache" value={corpusMetadata.cacheHit ? "hit" : "miss"} />
              </div>
              {corpusMetadata.skippedReason && (
                <p className="mt-3 rounded-xl border border-warning/20 bg-warning/10 px-3 py-2 text-xs font-semibold text-warning">
                  Decision: {corpusMetadata.skippedReason.replace("_", " ")}
                </p>
              )}
              {corpusMetadata.thresholds && (
                <p className="mt-3 text-xs text-on-surface-variant">
                  Thresholds: top{" "}
                  {formatSimilarity(corpusMetadata.thresholds.minTopSimilarity)} · item{" "}
                  {formatSimilarity(corpusMetadata.thresholds.minItemSimilarity)} · count{" "}
                  {String(corpusMetadata.thresholds.minItemsAboveThreshold ?? "—")}
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {corpusMetadata.retrievedCorpusItemIds.map((itemId) => (
                  <a
                    key={itemId}
                    href={`/dashboard/admin/corpus?tab=items&q=${encodeURIComponent(itemId)}`}
                    className="rounded-lg bg-surface px-2.5 py-1.5 font-mono text-xs font-semibold text-primary"
                  >
                    {itemId.slice(0, 8)}
                  </a>
                ))}
                {corpusMetadata.retrievedCorpusItemIds.length === 0 &&
                  corpusMetadata.candidateCorpusItemIds.slice(0, 6).map((itemId) => (
                    <a
                      key={itemId}
                      href={`/dashboard/admin/corpus?tab=items&q=${encodeURIComponent(itemId)}`}
                      className="rounded-lg bg-warning/10 px-2.5 py-1.5 font-mono text-xs font-semibold text-warning"
                    >
                      candidate {itemId.slice(0, 8)}
                    </a>
                  ))}
                {corpusMetadata.corpusRetrievalLogId && (
                  <a
                    href={`/dashboard/admin/corpus?tab=logs&q=${encodeURIComponent(
                      corpusMetadata.corpusRetrievalLogId
                    )}`}
                    className="rounded-lg bg-primary/10 px-2.5 py-1.5 text-xs font-semibold text-primary"
                  >
                    Retrieval log
                  </a>
                )}
              </div>
            </div>
          )}
          <TextBlock title="Input/context preview" value={row.contextText ?? row.input_preview} />
          <TextBlock title="AI output" value={row.output_text || row.output_preview} />
        </div>

        <div className="mt-6 rounded-2xl border border-outline-variant/15 bg-surface-container-low p-4">
          <h3 className="font-semibold text-on-surface">Admin review</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {(["reviewed", "flagged", "ignored"] as AiQualityReviewStatus[]).map(
              (status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => onReview(row, status)}
                  className={cn(
                    "h-10 rounded-xl border px-4 text-sm font-semibold capitalize transition",
                    row.review_status === status
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-outline-variant/20 bg-surface text-on-surface-variant hover:border-primary/30"
                  )}
                >
                  {status}
                </button>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SttStatusPill({ status }: { status: SttStatus }) {
  const config = {
    normalized: {
      label: "Normalized",
      icon: CheckCircle2,
      className: "border-secondary/20 bg-secondary/10 text-secondary",
    },
    fallback: {
      label: "Fallback used",
      icon: AlertTriangle,
      className: "border-warning/30 bg-warning/15 text-warning",
    },
    warning: {
      label: "Needs review",
      icon: AlertTriangle,
      className: "border-warning/30 bg-warning/15 text-warning",
    },
    clean: {
      label: "Clean",
      icon: ShieldCheck,
      className: "border-primary/20 bg-primary/8 text-primary",
    },
    none: {
      label: "No STT",
      icon: BrainCircuit,
      className: "border-outline-variant/20 bg-surface-container text-on-surface-variant",
    },
  }[status];
  const Icon = config.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
        config.className
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {config.label}
    </span>
  );
}

function SttRepairStatusPill({ status }: { status: SttRepairStatus }) {
  const config = {
    not_attempted: {
      label: "Not attempted",
      icon: BrainCircuit,
      className: "border-outline-variant/20 bg-surface-container text-on-surface-variant",
    },
    skipped: {
      label: "Skipped",
      icon: Clock3,
      className: "border-outline-variant/20 bg-surface-container text-on-surface-variant",
    },
    repaired: {
      label: "Repaired",
      icon: CheckCircle2,
      className: "border-secondary/20 bg-secondary/10 text-secondary",
    },
    uncertain: {
      label: "Uncertain",
      icon: AlertTriangle,
      className: "border-warning/30 bg-warning/15 text-warning",
    },
    hallucination_risk: {
      label: "Risk",
      icon: XCircle,
      className: "border-error/20 bg-error-container text-error",
    },
    failed: {
      label: "Failed",
      icon: XCircle,
      className: "border-error/20 bg-error-container text-error",
    },
  }[status] ?? {
    label: "Repair",
    icon: Wand2,
    className: "border-outline-variant/20 bg-surface-container text-on-surface-variant",
  };
  const Icon = config.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
        config.className
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {config.label}
    </span>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-low p-4">
      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
        {label}
      </div>
      <div className="mt-2 break-words text-lg font-bold text-on-surface">{value}</div>
    </div>
  );
}

function TranscriptPreview({
  title,
  value,
}: {
  title: string;
  value: string | null;
}) {
  return (
    <div className="rounded-xl border border-outline-variant/15 bg-surface p-3">
      <div className="text-xs font-semibold uppercase tracking-[0.12em] text-on-surface-variant">
        {title}
      </div>
      <pre className="mt-2 max-h-56 whitespace-pre-wrap break-words text-xs leading-5 text-on-surface-variant">
        {value || "No preview recorded."}
      </pre>
    </div>
  );
}

function CorpusRagStatusPill({
  status,
}: {
  status: CorpusRagStatus;
}) {
  const config = {
    injected: {
      label: "Injected",
      icon: CheckCircle2,
      className: "border-secondary/20 bg-secondary/10 text-secondary",
    },
    low_relevance: {
      label: "Skipped: low relevance",
      icon: AlertTriangle,
      className: "border-warning/30 bg-warning/15 text-warning",
    },
    timed_out: {
      label: "Timed out",
      icon: Clock3,
      className: "border-error/20 bg-error-container text-error",
    },
    failed: {
      label: "Failed",
      icon: XCircle,
      className: "border-error/20 bg-error-container text-error",
    },
    disabled: {
      label: "Disabled",
      icon: XCircle,
      className: "border-outline-variant/20 bg-surface-container text-on-surface-variant",
    },
    no_context: {
      label: "No context",
      icon: BrainCircuit,
      className: "border-outline-variant/20 bg-surface-container text-on-surface-variant",
    },
    none: {
      label: "Not attempted",
      icon: BrainCircuit,
      className: "border-outline-variant/20 bg-surface-container text-on-surface-variant",
    },
  }[status];
  const Icon = config.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
        config.className
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {config.label}
    </span>
  );
}

function TextBlock({ title, value }: { title: string; value: string | null }) {
  return (
    <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-low p-4">
      <h3 className="font-semibold text-on-surface">{title}</h3>
      <pre className="mt-3 max-h-72 whitespace-pre-wrap break-words rounded-xl bg-surface p-4 text-sm leading-6 text-on-surface-variant">
        {value || "No content recorded."}
      </pre>
    </div>
  );
}
