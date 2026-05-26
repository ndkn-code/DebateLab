"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  Clock3,
  Filter,
  Loader2,
  MessageSquareText,
  Search,
  ShieldCheck,
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

type CorpusRagStatus =
  | "injected"
  | "low_relevance"
  | "timed_out"
  | "failed"
  | "disabled"
  | "no_context"
  | "none";

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
  rows: Row[];
}

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

function formatSimilarity(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? value.toFixed(2)
    : "—";
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
    latencyMs,
    thresholds,
    status,
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

  const rows = data?.rows ?? [];
  const kpis = data?.kpis;
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

        <section className="rounded-2xl border border-outline-variant/15 bg-surface p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-on-surface">
            <Filter className="h-4 w-4 text-primary" />
            Filters
          </div>
          <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-8">
            <Select label="Range" value={rangeDays} onChange={setRangeDays} options={[["7", "7d"], ["30", "30d"], ["90", "90d"]]} />
            <Select label="Type" value={outputType} onChange={setOutputType} options={[["all", "All"], ["rebuttal", "Rebuttal"], ["practice_judging", "Practice judge"], ["duel_judging", "Duel judge"]]} />
            <Select label="Language" value={language} onChange={setLanguage} options={[["all", "All"], ["en", "English"], ["vi", "Vietnamese"]]} />
            <Select label="Provider" value={provider} onChange={setProvider} options={[["all", "All"], ["DeepSeek", "DeepSeek"], ["google", "Gemini"]]} />
            <Select label="Status" value={status} onChange={setStatus} options={[["all", "All"], ["success", "Success"], ["error", "Error"]]} />
            <Select label="Useful" value={usefulness} onChange={setUsefulness} options={[["all", "All"], ["yes", "Yes"], ["somewhat", "Somewhat"], ["no", "No"]]} />
            <Select label="Fairness" value={fairness} onChange={setFairness} options={[["all", "All"], ["too_harsh", "Too harsh"], ["fair", "Fair"], ["too_generous", "Too generous"]]} />
            <Select label="Reason" value={reasonTag} onChange={setReasonTag} options={[["all", "All"], ...REASON_OPTIONS.map((item) => [item.value, item.label] as [string, string])]} />
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
          ) : rows.length === 0 ? (
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
                  {rows.map((row) => (
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
      </div>

      {selectedRow && (
        <DetailDrawer
          row={selectedRow}
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
  onClose,
  onReview,
}: {
  row: Row;
  onClose: () => void;
  onReview: (row: Row, reviewStatus: AiQualityReviewStatus) => Promise<void>;
}) {
  const corpusMetadata = getCorpusMetadata(row);

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

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-low p-4">
      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
        {label}
      </div>
      <div className="mt-2 text-lg font-bold text-on-surface">{value}</div>
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
      <pre className="mt-3 max-h-72 whitespace-pre-wrap rounded-xl bg-surface p-4 text-sm leading-6 text-on-surface-variant">
        {value || "No content recorded."}
      </pre>
    </div>
  );
}
