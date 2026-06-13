"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  Archive,
  BadgeCheck,
  BrainCircuit,
  CheckCircle2,
  Clock3,
  ExternalLink,
  FileText,
  Filter,
  Import,
  Layers,
  Layers3,
  Loader2,
  Lock,
  RefreshCw,
  Search,
  Sparkles,
  Target,
  X,
  XCircle,
} from "@/components/ui/icons";
import { cn } from "@/lib/utils";

type CorpusRow = Record<string, unknown> & { id?: string };

interface CorpusDashboardResponse {
  kpis: {
    sourceCount: number;
    matchCount: number;
    itemCount: number;
    motionCount: number;
    importCount: number;
    retrievalLogCount: number;
    missingEmbeddingCount: number;
    reviewCounts: Record<string, number>;
    providerCounts: Record<string, number>;
    publishedMotionCount: number;
  };
  sources: CorpusRow[];
  matches: CorpusRow[];
  items: CorpusRow[];
  motions: CorpusRow[];
  retrievalLogs: CorpusRow[];
  importBatches: CorpusRow[];
}

type TabKey =
  | "overview"
  | "import"
  | "sources"
  | "matches"
  | "items"
  | "motions"
  | "logs";

type DetailKind = "source" | "match" | "item" | "motion" | "log" | "import";

const TABS: Array<{ key: TabKey; label: string; icon: typeof Layers3 }> = [
  { key: "overview", label: "Overview", icon: Layers3 },
  { key: "import", label: "Import", icon: Import },
  { key: "sources", label: "Sources", icon: FileText },
  { key: "matches", label: "Matches", icon: Target },
  { key: "items", label: "Items", icon: Archive },
  { key: "motions", label: "Motions", icon: Sparkles },
  { key: "logs", label: "Retrieval Logs", icon: BrainCircuit },
];

const REVIEW_OPTIONS = [
  ["all", "All statuses"],
  ["candidate", "Candidate"],
  ["needs_review", "Needs review"],
  ["approved", "Approved"],
  ["rejected", "Rejected"],
  ["published", "Published"],
] as const;

const ITEM_TYPE_OPTIONS = [
  ["all", "All item types"],
  ["debate_moment", "Debate moments"],
  ["phrase_bank", "Phrase bank"],
  ["judging_lesson", "Judging lessons"],
] as const;

function getString(row: CorpusRow | null | undefined, key: string, fallback = "—") {
  const value = row?.[key];
  return typeof value === "string" && value.trim() ? value : fallback;
}

function getNumber(row: CorpusRow | null | undefined, key: string) {
  const value = row?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getArray(row: CorpusRow | null | undefined, key: string) {
  const value = row?.[key];
  return Array.isArray(value) ? value : [];
}

function getRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function getNestedNumber(value: Record<string, unknown>, key: string) {
  const next = value[key];
  return typeof next === "number" && Number.isFinite(next) ? next : null;
}

function formatDate(value: unknown) {
  if (typeof value !== "string") return "—";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatPercent(value: unknown) {
  return typeof value === "number" ? `${Math.round(value * 100)}%` : "—";
}

function formatSimilarity(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? value.toFixed(2)
    : "—";
}

function formatMilliseconds(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? `${value}ms` : "—";
}

function getRetrievedItems(row: CorpusRow) {
  return getArray(row, "retrieved_items")
    .map((item) => getRecord(item))
    .filter((item) => typeof item.item_id === "string");
}

function getRetrievalSummary(row: CorpusRow) {
  const filters = getRecord(row.filters);
  const gate = getRecord(filters.relevanceGate);
  const retrievedItems = getRetrievedItems(row);
  const similarities = retrievedItems
    .map((item) => getNestedNumber(item, "similarity"))
    .filter((value): value is number => typeof value === "number");
  const topSimilarity =
    getNestedNumber(gate, "topSimilarity") ??
    (similarities.length > 0 ? Math.max(...similarities) : null);
  const avgTop3Similarity =
    getNestedNumber(gate, "avgTop3Similarity") ??
    (similarities.length > 0
      ? similarities
          .sort((a, b) => b - a)
          .slice(0, 3)
          .reduce((total, value, _index, values) => total + value / values.length, 0)
      : null);
  const candidateCount =
    getNestedNumber(gate, "candidateCount") ?? retrievedItems.length;
  const injectedCount = getNestedNumber(gate, "injectedCount") ?? candidateCount;
  const itemsAboveThresholdCount =
    getNestedNumber(gate, "itemsAboveThresholdCount") ?? injectedCount;
  const skippedReason =
    typeof gate.skippedReason === "string" ? gate.skippedReason : null;
  const passed = typeof gate.passed === "boolean" ? gate.passed : null;
  const latencyMs = getNumber(row, "latency_ms");

  let status: "injected" | "low_relevance" | "timed_out" | "disabled" | "empty";
  if (skippedReason === "low_relevance") {
    status = "low_relevance";
  } else if (skippedReason?.startsWith("retrieval_failed")) {
    status = skippedReason.toLowerCase().includes("abort") ? "timed_out" : "empty";
  } else if (skippedReason === "flag_disabled" || passed === null && candidateCount === 0) {
    status = "disabled";
  } else if (injectedCount > 0) {
    status = "injected";
  } else if (latencyMs != null && latencyMs >= 19000 && candidateCount === 0) {
    status = "timed_out";
  } else {
    status = "empty";
  }

  return {
    status,
    skippedReason,
    topSimilarity,
    avgTop3Similarity,
    candidateCount,
    injectedCount,
    itemsAboveThresholdCount,
    minTopSimilarity: getNestedNumber(gate, "minTopSimilarity"),
    minItemSimilarity: getNestedNumber(gate, "minItemSimilarity"),
    minItemsAboveThreshold: getNestedNumber(gate, "minItemsAboveThreshold"),
    injectedItemIds: getArray(gate, "injectedItemIds").filter(
      (value): value is string => typeof value === "string"
    ),
    retrievedItems,
  };
}

function rowTitle(row: CorpusRow, kind: DetailKind) {
  if (kind === "source") return getString(row, "video_title", getString(row, "id"));
  if (kind === "match") return getString(row, "motion_vi", getString(row, "canonical_match_key"));
  if (kind === "item") return getString(row, "embedding_text", getString(row, "item_type"));
  if (kind === "motion") return getString(row, "motion_vi", getString(row, "motion_key"));
  if (kind === "log") return getString(row, "query_hash", getString(row, "id"));
  return getString(row, "file_name", getString(row, "import_key"));
}

function reviewTone(status: unknown) {
  if (status === "approved" || status === "published") return "success";
  if (status === "candidate") return "neutral";
  if (status === "rejected") return "error";
  return "warning";
}

function createQuery(params: Record<string, string>) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value && value !== "all") query.set(key, value);
  });
  return query.toString();
}

export function CorpusStudioDashboard() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") as TabKey | null;
  const [activeTab, setActiveTab] = useState<TabKey>(
    initialTab && TABS.some((tab) => tab.key === initialTab) ? initialTab : "overview"
  );
  const [reviewStatus, setReviewStatus] = useState("all");
  const [itemType, setItemType] = useState("all");
  const [queryText, setQueryText] = useState(searchParams.get("q") ?? "");
  const [data, setData] = useState<CorpusDashboardResponse | null>(null);
  const [selected, setSelected] = useState<{ kind: DetailKind; row: CorpusRow } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [importContent, setImportContent] = useState("");
  const [importFileName, setImportFileName] = useState("truong-teen-source-bundle.md");

  const query = useMemo(
    () => createQuery({ reviewStatus, itemType, q: queryText.trim() }),
    [itemType, queryText, reviewStatus]
  );

  const loadData = useCallback(() => {
    let cancelled = false;
    setError(null);
    fetch(`/api/admin/corpus?${query}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          const body = (await response.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error || "Unable to load Corpus Studio");
        }
        return response.json() as Promise<CorpusDashboardResponse>;
      })
      .then((nextData) => {
        if (!cancelled) setData(nextData);
      })
      .catch((nextError) => {
        if (!cancelled) {
          setData(null);
          setError(nextError instanceof Error ? nextError.message : "Unable to load corpus data");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [query]);

  useEffect(() => loadData(), [loadData]);

  const runAction = async (label: string, action: () => Promise<string | null | void>) => {
    setBusyAction(label);
    setNotice(null);
    setError(null);
    try {
      const message = await action();
      if (message) setNotice(message);
      loadData();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Action failed");
    } finally {
      setBusyAction(null);
    }
  };

  const patchReview = async (kind: "sources" | "matches" | "items" | "motions", row: CorpusRow, status: string) => {
    const id = getString(row, "id", "");
    if (!id) return;
    const endpoint = `/api/admin/corpus/${kind}/${id}`;
    await runAction(`${kind}:${id}:${status}`, async () => {
      const response = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewStatus: status }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || "Unable to update review status");
      }
      return `Marked ${status}.`;
    });
  };

  const publishMotion = async (row: CorpusRow) => {
    const id = getString(row, "id", "");
    if (!id) return;
    await runAction(`publish:${id}`, async () => {
      const response = await fetch(`/api/admin/corpus/motions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "publish" }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || "Unable to publish motion");
      }
      const body = (await response.json()) as { topicKey?: string };
      return `Published motion${body.topicKey ? ` as ${body.topicKey}` : ""}.`;
    });
  };

  const importBundle = async () => {
    await runAction("import", async () => {
      const response = await fetch("/api/admin/corpus/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: importContent, fileName: importFileName }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || "Unable to import bundle");
      }
      const body = (await response.json()) as {
        summary?: { sources: number; matches: number; items: number; motions: number };
      };
      setImportContent("");
      return body.summary
        ? `Imported ${body.summary.sources} sources, ${body.summary.matches} matches, ${body.summary.items} items, and ${body.summary.motions} motions.`
        : "Import completed.";
    });
  };

  const runEmbeddingBatch = async () => {
    await runAction("embeddings", async () => {
      const response = await fetch("/api/admin/corpus/embeddings/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 16 }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || "Unable to run embeddings");
      }
      const body = (await response.json()) as { embedded?: number; skipped?: number };
      return `Embedding batch finished: ${body.embedded ?? 0} embedded, ${body.skipped ?? 0} skipped.`;
    });
  };

  const loading = data === null && error === null;
  const kpis = data?.kpis;

  return (
    <div className="min-h-full bg-background px-4 py-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/8 px-3 py-1 type-eyebrow text-primary">
              <Lock className="h-3.5 w-3.5" />
              Corpus Studio
            </div>
            <h1 className="mt-3 text-3xl font-bold tracking-normal text-on-surface">
              Review, retrieve, publish
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-on-surface-variant">
              Import private Trường Teen source bundles, approve RAG-ready corpus items,
              inspect retrieval usage, and publish reviewed motions into the practice catalog.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => loadData()}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-outline-variant/20 bg-surface px-4 text-sm font-semibold text-on-surface-variant transition hover:border-primary/30 hover:text-primary"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
            <button
              type="button"
              onClick={runEmbeddingBatch}
              disabled={busyAction === "embeddings"}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-on-primary transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busyAction === "embeddings" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
              <Layers className="h-4 w-4" />
              )}
              Embed 16
            </button>
          </div>
        </header>

        {kpis && (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <Kpi label="Sources" value={String(kpis.sourceCount)} icon={FileText} />
            <Kpi label="Matches" value={String(kpis.matchCount)} icon={Target} />
            <Kpi label="Items" value={String(kpis.itemCount)} icon={Archive} />
            <Kpi label="Motions" value={String(kpis.motionCount)} icon={Sparkles} />
            <Kpi label="Published" value={String(kpis.publishedMotionCount)} icon={BadgeCheck} />
            <Kpi label="Stale vectors" value={String(kpis.missingEmbeddingCount)} icon={Layers} />
          </div>
        )}

        <section className="rounded-2xl border border-outline-variant/15 bg-surface p-3 shadow-sm">
          <div className="flex gap-2 overflow-x-auto">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    "inline-flex h-10 shrink-0 items-center gap-2 rounded-xl px-3 text-sm font-semibold transition",
                    activeTab === tab.key
                      ? "bg-primary text-on-primary"
                      : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </section>

        <section className="grid gap-3 rounded-2xl border border-outline-variant/15 bg-surface p-4 shadow-sm lg:grid-cols-[1.2fr_180px_180px]">
          <label className="relative block">
            <span className="sr-only">Search corpus</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" />
            <input
              value={queryText}
              onChange={(event) => setQueryText(event.target.value)}
              placeholder="Search by motion, school, item id, phrase, or evidence note"
              className="h-11 w-full rounded-xl border border-outline-variant/20 bg-surface-container-low pl-10 pr-3 text-sm text-on-surface outline-none transition placeholder:text-on-surface-variant focus:border-primary/50"
            />
          </label>
          <Select value={reviewStatus} onChange={setReviewStatus} options={REVIEW_OPTIONS} />
          <Select value={itemType} onChange={setItemType} options={ITEM_TYPE_OPTIONS} />
        </section>

        {error && (
          <StatusBanner tone="error">{error}</StatusBanner>
        )}
        {notice && (
          <StatusBanner tone="success">{notice}</StatusBanner>
        )}

        {loading ? (
          <div className="flex min-h-[360px] items-center justify-center rounded-2xl border border-outline-variant/15 bg-surface">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {activeTab === "overview" && data && (
              <OverviewPanel data={data} onSelect={setSelected} />
            )}
            {activeTab === "import" && (
              <ImportPanel
                content={importContent}
                fileName={importFileName}
                busy={busyAction === "import"}
                onContentChange={setImportContent}
                onFileNameChange={setImportFileName}
                onImport={importBundle}
              />
            )}
            {activeTab === "sources" && data && (
              <SourcesTable rows={data.sources} onSelect={(row) => setSelected({ kind: "source", row })} onReview={patchReview} busyAction={busyAction} />
            )}
            {activeTab === "matches" && data && (
              <MatchesTable rows={data.matches} onSelect={(row) => setSelected({ kind: "match", row })} onReview={patchReview} busyAction={busyAction} />
            )}
            {activeTab === "items" && data && (
              <ItemsTable rows={data.items} onSelect={(row) => setSelected({ kind: "item", row })} onReview={patchReview} busyAction={busyAction} />
            )}
            {activeTab === "motions" && data && (
              <MotionsTable rows={data.motions} onSelect={(row) => setSelected({ kind: "motion", row })} onReview={patchReview} onPublish={publishMotion} busyAction={busyAction} />
            )}
            {activeTab === "logs" && data && (
              <LogsTable rows={data.retrievalLogs} onSelect={(row) => setSelected({ kind: "log", row })} />
            )}
          </>
        )}
      </div>

      {selected && (
        <DetailDrawer
          kind={selected.kind}
          row={selected.row}
          onClose={() => setSelected(null)}
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
  icon: typeof Layers3;
}) {
  return (
    <div className="rounded-2xl border border-outline-variant/15 bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="type-eyebrow text-on-surface-variant">
          {label}
        </div>
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div className="mt-3 text-2xl font-bold text-on-surface">{value}</div>
    </div>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: readonly (readonly [string, string])[];
}) {
  return (
    <label className="block">
      <span className="sr-only">Filter</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-xl border border-outline-variant/20 bg-surface-container-low px-3 text-sm font-semibold text-on-surface outline-none transition focus:border-primary/50"
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

function StatusBanner({ tone, children }: { tone: "success" | "error"; children: ReactNode }) {
  return (
    <div
      className={cn(
        "rounded-2xl border px-4 py-3 text-sm font-semibold",
        tone === "success" && "border-secondary/20 bg-secondary/10 text-secondary",
        tone === "error" && "border-error/20 bg-error-container text-error"
      )}
    >
      {children}
    </div>
  );
}

function OverviewPanel({
  data,
  onSelect,
}: {
  data: CorpusDashboardResponse;
  onSelect: (selection: { kind: DetailKind; row: CorpusRow }) => void;
}) {
  const reviewCounts = data.kpis.reviewCounts ?? {};
  const providerCounts = data.kpis.providerCounts ?? {};
  const recentItems = data.items.slice(0, 5);
  const recentMotions = data.motions.slice(0, 5);

  return (
    <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
      <section className="rounded-2xl border border-outline-variant/15 bg-surface p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-primary" />
          <h2 className="text-lg font-bold text-on-surface">Review queue</h2>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {Object.entries(reviewCounts).map(([status, count]) => (
            <div key={status} className="rounded-xl border border-outline-variant/15 bg-surface-container-low p-4">
              <StatusPill status={status} />
              <div className="mt-3 text-2xl font-bold text-on-surface">{count}</div>
            </div>
          ))}
          {Object.keys(reviewCounts).length === 0 && (
            <EmptyState label="No corpus items are loaded yet." />
          )}
        </div>
        <div className="mt-5">
          <h3 className="text-sm font-bold text-on-surface">Embedding providers</h3>
          <div className="mt-3 space-y-2">
            {Object.entries(providerCounts).map(([provider, count]) => (
              <div key={provider} className="flex items-center justify-between rounded-xl bg-surface-container-low px-3 py-2 text-sm">
                <span className="truncate text-on-surface-variant">{provider}</span>
                <span className="font-bold text-on-surface">{count}</span>
              </div>
            ))}
            {Object.keys(providerCounts).length === 0 && (
              <EmptyState label="No embeddings recorded." />
            )}
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <QueueCard
          title="Recent corpus items"
          rows={recentItems}
          kind="item"
          onSelect={onSelect}
          renderMeta={(row) => `${getString(row, "item_type")} · ${getString(row, "evidence_status")}`}
        />
        <QueueCard
          title="Motion candidates"
          rows={recentMotions}
          kind="motion"
          onSelect={onSelect}
          renderMeta={(row) => `${getString(row, "category_key")} · ${getString(row, "difficulty")}`}
        />
      </section>
    </div>
  );
}

function QueueCard({
  title,
  rows,
  kind,
  onSelect,
  renderMeta,
}: {
  title: string;
  rows: CorpusRow[];
  kind: DetailKind;
  onSelect: (selection: { kind: DetailKind; row: CorpusRow }) => void;
  renderMeta: (row: CorpusRow) => string;
}) {
  return (
    <div className="rounded-2xl border border-outline-variant/15 bg-surface p-5 shadow-sm">
      <h2 className="text-lg font-bold text-on-surface">{title}</h2>
      <div className="mt-4 space-y-2">
        {rows.map((row) => (
          <button
            key={getString(row, "id")}
            type="button"
            onClick={() => onSelect({ kind, row })}
            className="flex w-full items-center justify-between gap-3 rounded-xl border border-outline-variant/10 bg-surface-container-low px-3 py-3 text-left transition hover:border-primary/30"
          >
            <div className="min-w-0">
              <div className="truncate text-sm font-bold text-on-surface">{rowTitle(row, kind)}</div>
              <div className="mt-1 truncate text-xs text-on-surface-variant">{renderMeta(row)}</div>
            </div>
            <StatusPill status={getString(row, "review_status", "candidate")} />
          </button>
        ))}
        {rows.length === 0 && <EmptyState label="Nothing in this queue." />}
      </div>
    </div>
  );
}

function ImportPanel({
  content,
  fileName,
  busy,
  onContentChange,
  onFileNameChange,
  onImport,
}: {
  content: string;
  fileName: string;
  busy: boolean;
  onContentChange: (value: string) => void;
  onFileNameChange: (value: string) => void;
  onImport: () => void;
}) {
  return (
    <section className="rounded-2xl border border-outline-variant/15 bg-surface p-5 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-lg font-bold text-on-surface">Import reviewed source bundle</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-on-surface-variant">
            Paste a JSON bundle or Markdown file with fenced JSON blocks. The original upload is
            stored privately for admin audit; beta users only see published motion catalog entries.
          </p>
        </div>
        <button
          type="button"
          disabled={busy || content.trim().length < 20}
          onClick={onImport}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-on-primary transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Import className="h-4 w-4" />}
          Import bundle
        </button>
      </div>
      <label className="mt-5 block">
        <span className="type-eyebrow text-on-surface-variant">
          File name
        </span>
        <input
          value={fileName}
          onChange={(event) => onFileNameChange(event.target.value)}
          className="mt-2 h-11 w-full rounded-xl border border-outline-variant/20 bg-surface-container-low px-3 text-sm text-on-surface outline-none transition focus:border-primary/50"
        />
      </label>
      <label className="mt-4 block">
        <span className="type-eyebrow text-on-surface-variant">
          Bundle content
        </span>
        <textarea
          value={content}
          onChange={(event) => onContentChange(event.target.value)}
          placeholder="Paste Gemini JSON output or your notes.md content with ```json fenced blocks..."
          className="mt-2 min-h-[420px] w-full resize-y rounded-xl border border-outline-variant/20 bg-surface-container-low p-4 type-code text-on-surface outline-none transition placeholder:text-on-surface-variant focus:border-primary/50"
        />
      </label>
    </section>
  );
}

function SourcesTable({
  rows,
  onSelect,
  onReview,
  busyAction,
}: {
  rows: CorpusRow[];
  onSelect: (row: CorpusRow) => void;
  onReview: (kind: "sources", row: CorpusRow, status: string) => void;
  busyAction: string | null;
}) {
  return (
    <DataTable
      rows={rows}
      emptyLabel="No sources match the filters."
      headers={["Source", "Season", "Quality", "Status", "Updated", "Actions"]}
      renderRow={(row) => (
        <tr key={getString(row, "id")} className="border-t border-outline-variant/10">
          <CellButton onClick={() => onSelect(row)} title={getString(row, "video_title")} subtitle={getString(row, "youtube_url")} />
          <td className="px-4 py-3 text-on-surface-variant">{getString(row, "season")}</td>
          <td className="px-4 py-3">
            <div className="font-semibold text-on-surface">{getString(row, "transcript_quality")}</div>
            <div className="text-xs text-on-surface-variant">{formatPercent(getNumber(row, "overall_confidence"))}</div>
          </td>
          <td className="px-4 py-3"><StatusPill status={getString(row, "review_status")} /></td>
          <td className="px-4 py-3 text-on-surface-variant">{formatDate(row.updated_at)}</td>
          <td className="px-4 py-3">
            <ReviewButtons
              row={row}
              kind="sources"
              busyAction={busyAction}
              onReview={(_, nextRow, status) => onReview("sources", nextRow, status)}
            />
          </td>
        </tr>
      )}
    />
  );
}

function MatchesTable({
  rows,
  onSelect,
  onReview,
  busyAction,
}: {
  rows: CorpusRow[];
  onSelect: (row: CorpusRow) => void;
  onReview: (kind: "matches", row: CorpusRow, status: string) => void;
  busyAction: string | null;
}) {
  return (
    <DataTable
      rows={rows}
      emptyLabel="No matches match the filters."
      headers={["Motion", "Decision", "Confidence", "Status", "Updated", "Actions"]}
      renderRow={(row) => (
        <tr key={getString(row, "id")} className="border-t border-outline-variant/10">
          <CellButton onClick={() => onSelect(row)} title={getString(row, "motion_vi")} subtitle={getString(row, "canonical_match_key")} />
          <td className="px-4 py-3 text-on-surface-variant">{getString(row, "import_decision")}</td>
          <td className="px-4 py-3 text-on-surface-variant">{formatPercent(getNumber(row, "aggregate_confidence"))}</td>
          <td className="px-4 py-3"><StatusPill status={getString(row, "review_status")} /></td>
          <td className="px-4 py-3 text-on-surface-variant">{formatDate(row.updated_at)}</td>
          <td className="px-4 py-3">
            <ReviewButtons
              row={row}
              kind="matches"
              busyAction={busyAction}
              onReview={(_, nextRow, status) => onReview("matches", nextRow, status)}
            />
          </td>
        </tr>
      )}
    />
  );
}

function ItemsTable({
  rows,
  onSelect,
  onReview,
  busyAction,
}: {
  rows: CorpusRow[];
  onSelect: (row: CorpusRow) => void;
  onReview: (kind: "items", row: CorpusRow, status: string) => void;
  busyAction: string | null;
}) {
  return (
    <DataTable
      rows={rows}
      emptyLabel="No corpus items match the filters."
      headers={["Item", "Use", "Evidence", "Status", "Updated", "Actions"]}
      renderRow={(row) => (
        <tr key={getString(row, "id")} className="border-t border-outline-variant/10">
          <CellButton onClick={() => onSelect(row)} title={getString(row, "embedding_text")} subtitle={getString(row, "item_type")} />
          <td className="px-4 py-3 text-on-surface-variant">{getArray(row, "usable_for").join(", ") || "—"}</td>
          <td className="px-4 py-3 text-on-surface-variant">{getString(row, "evidence_status")}</td>
          <td className="px-4 py-3"><StatusPill status={getString(row, "review_status")} /></td>
          <td className="px-4 py-3 text-on-surface-variant">{formatDate(row.updated_at)}</td>
          <td className="px-4 py-3">
            <ReviewButtons
              row={row}
              kind="items"
              busyAction={busyAction}
              onReview={(_, nextRow, status) => onReview("items", nextRow, status)}
            />
          </td>
        </tr>
      )}
    />
  );
}

function MotionsTable({
  rows,
  onSelect,
  onReview,
  onPublish,
  busyAction,
}: {
  rows: CorpusRow[];
  onSelect: (row: CorpusRow) => void;
  onReview: (kind: "motions", row: CorpusRow, status: string) => void;
  onPublish: (row: CorpusRow) => void;
  busyAction: string | null;
}) {
  return (
    <DataTable
      rows={rows}
      emptyLabel="No motion candidates match the filters."
      headers={["Motion", "Category", "Publish", "Status", "Updated", "Actions"]}
      renderRow={(row) => (
        <tr key={getString(row, "id")} className="border-t border-outline-variant/10">
          <CellButton onClick={() => onSelect(row)} title={getString(row, "motion_vi")} subtitle={getString(row, "source_stage")} />
          <td className="px-4 py-3">
            <div className="font-semibold text-on-surface">{getString(row, "category_key")}</div>
            <div className="text-xs text-on-surface-variant">{getString(row, "difficulty")}</div>
          </td>
          <td className="px-4 py-3 text-on-surface-variant">{getString(row, "publish_status")}</td>
          <td className="px-4 py-3"><StatusPill status={getString(row, "review_status")} /></td>
          <td className="px-4 py-3 text-on-surface-variant">{formatDate(row.updated_at)}</td>
          <td className="px-4 py-3">
            <div className="flex flex-wrap gap-1">
              <ReviewButtons
                row={row}
                kind="motions"
                busyAction={busyAction}
                onReview={(_, nextRow, status) => onReview("motions", nextRow, status)}
              />
              <button
                type="button"
                disabled={getString(row, "publish_status") === "published" || busyAction === `publish:${getString(row, "id", "")}`}
                onClick={() => onPublish(row)}
                className="h-8 rounded-lg border border-primary/25 bg-primary/8 px-3 text-xs font-bold text-primary transition hover:bg-primary/15 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Publish
              </button>
            </div>
          </td>
        </tr>
      )}
    />
  );
}

function LogsTable({
  rows,
  onSelect,
}: {
  rows: CorpusRow[];
  onSelect: (row: CorpusRow) => void;
}) {
  return (
    <DataTable
      rows={rows}
      emptyLabel="No retrieval logs yet."
      headers={["Query hash", "Provider", "Status", "Similarity", "Injected", "Latency", "AI run"]}
      renderRow={(row) => {
        const summary = getRetrievalSummary(row);
        const latencyMs = getNumber(row, "latency_ms");
        return (
          <tr key={getString(row, "id")} className="border-t border-outline-variant/10">
            <CellButton onClick={() => onSelect(row)} title={getString(row, "query_hash")} subtitle={formatDate(row.created_at)} />
            <td className="px-4 py-3">
              <div className="font-semibold text-on-surface">{getString(row, "provider")}</div>
              <div className="max-w-[220px] truncate text-xs text-on-surface-variant">{getString(row, "model")}</div>
            </td>
            <td className="px-4 py-3">
              <RetrievalStatusPill status={summary.status} />
            </td>
            <td className="px-4 py-3">
              <div className="font-semibold text-on-surface">{formatSimilarity(summary.topSimilarity)}</div>
              <div className="text-xs text-on-surface-variant">top-3 {formatSimilarity(summary.avgTop3Similarity)}</div>
            </td>
            <td className="px-4 py-3 text-on-surface-variant">
              {summary.injectedCount} / {summary.candidateCount}
            </td>
            <td className="px-4 py-3 text-on-surface-variant">
              {formatMilliseconds(latencyMs)}
            </td>
            <td className="px-4 py-3 text-on-surface-variant">{getString(row, "ai_quality_run_id")}</td>
          </tr>
        );
      }}
    />
  );
}

function DataTable({
  rows,
  headers,
  emptyLabel,
  renderRow,
}: {
  rows: CorpusRow[];
  headers: string[];
  emptyLabel: string;
  renderRow: (row: CorpusRow) => ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-outline-variant/15 bg-surface shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] text-left text-sm">
          <thead className="bg-surface-container-low type-eyebrow text-on-surface-variant">
            <tr>
              {headers.map((header) => (
                <th key={header} className="px-4 py-3 font-bold">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(renderRow)}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && <EmptyState label={emptyLabel} />}
    </section>
  );
}

function CellButton({
  onClick,
  title,
  subtitle,
}: {
  onClick: () => void;
  title: string;
  subtitle: string;
}) {
  return (
    <td className="px-4 py-3">
      <button type="button" onClick={onClick} className="block max-w-[420px] text-left">
        <span className="line-clamp-2 font-semibold leading-5 text-on-surface">{title}</span>
        <span className="mt-1 block truncate text-xs text-on-surface-variant">{subtitle}</span>
      </button>
    </td>
  );
}

function ReviewButtons({
  row,
  kind,
  busyAction,
  onReview,
}: {
  row: CorpusRow;
  kind: "sources" | "matches" | "items" | "motions";
  busyAction: string | null;
  onReview: (kind: "sources" | "matches" | "items" | "motions", row: CorpusRow, status: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {(["approved", "needs_review", "rejected"] as const).map((status) => {
        const actionKey = `${kind}:${getString(row, "id", "")}:${status}`;
        return (
          <button
            key={status}
            type="button"
            disabled={busyAction === actionKey}
            onClick={() => onReview(kind, row, status)}
            className={cn(
              "h-8 rounded-lg border px-2.5 text-xs font-bold capitalize transition disabled:cursor-not-allowed disabled:opacity-60",
              getString(row, "review_status") === status
                ? "border-primary bg-primary/10 text-primary"
                : "border-outline-variant/20 bg-surface text-on-surface-variant hover:border-primary/30 hover:text-primary"
            )}
          >
            {busyAction === actionKey ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : status.replace("_", " ")}
          </button>
        );
      })}
    </div>
  );
}

function StatusPill({ status }: { status: unknown }) {
  const label = typeof status === "string" ? status.replace("_", " ") : "unknown";
  const tone = reviewTone(status);
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
      {label}
    </span>
  );
}

function RetrievalStatusPill({
  status,
}: {
  status: ReturnType<typeof getRetrievalSummary>["status"];
}) {
  const config = {
    injected: {
      label: "Injected",
      icon: CheckCircle2,
      className: "border-secondary/20 bg-secondary/10 text-secondary",
    },
    low_relevance: {
      label: "Skipped",
      icon: AlertTriangle,
      className: "border-warning/30 bg-warning/15 text-warning",
    },
    timed_out: {
      label: "Timed out",
      icon: Clock3,
      className: "border-error/20 bg-error-container text-error",
    },
    disabled: {
      label: "Disabled",
      icon: XCircle,
      className: "border-outline-variant/20 bg-surface-container text-on-surface-variant",
    },
    empty: {
      label: "No context",
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

function EmptyState({ label }: { label: string }) {
  return (
    <div className="p-6 text-center text-sm text-on-surface-variant">
      {label}
    </div>
  );
}

function DetailDrawer({
  kind,
  row,
  onClose,
}: {
  kind: DetailKind;
  row: CorpusRow;
  onClose: () => void;
}) {
  const sourceUrl = getString(row, "youtube_url", getString(row, "source_url", ""));
  const retrievalSummary = kind === "log" ? getRetrievalSummary(row) : null;
  const itemIds =
    retrievalSummary?.retrievedItems
      .map((item) => item.item_id)
      .filter((value): value is string => typeof value === "string") ?? [];

  return (
    <div className="fixed inset-0 z-50 bg-black/20">
      <div className="absolute right-0 top-0 h-full w-full max-w-2xl overflow-y-auto border-l border-outline-variant/20 bg-surface p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="type-eyebrow text-primary">
              {kind}
            </div>
            <h2 className="mt-2 line-clamp-3 text-2xl font-bold text-on-surface">
              {rowTitle(row, kind)}
            </h2>
            <p className="mt-1 text-sm text-on-surface-variant">
              {getString(row, "id", getString(row, "canonical_match_key"))} · {formatDate(row.updated_at ?? row.created_at)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-on-surface-variant hover:bg-surface-container"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <MiniMetric label="Status" value={getString(row, "review_status", getString(row, "status"))} />
          <MiniMetric label="Confidence" value={formatPercent(getNumber(row, "confidence") ?? getNumber(row, "aggregate_confidence") ?? getNumber(row, "overall_confidence"))} />
          <MiniMetric label="Updated" value={formatDate(row.updated_at ?? row.created_at)} />
        </div>

        {retrievalSummary && (
          <div className="mt-6 rounded-2xl border border-outline-variant/15 bg-surface-container-low p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-semibold text-on-surface">Relevance summary</h3>
              <RetrievalStatusPill status={retrievalSummary.status} />
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <MiniMetric label="Top similarity" value={formatSimilarity(retrievalSummary.topSimilarity)} />
              <MiniMetric label="Avg top-3" value={formatSimilarity(retrievalSummary.avgTop3Similarity)} />
              <MiniMetric
                label="Injected"
                value={`${retrievalSummary.injectedCount}/${retrievalSummary.candidateCount}`}
              />
            </div>
            <div className="mt-4 rounded-xl border border-outline-variant/15 bg-surface p-3 text-sm text-on-surface-variant">
              <div className="flex items-center justify-between gap-3">
                <span>Items above threshold</span>
                <span className="font-semibold text-on-surface">
                  {retrievalSummary.itemsAboveThresholdCount}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3">
                <span>Thresholds</span>
                <span className="text-right font-semibold text-on-surface">
                  top {formatSimilarity(retrievalSummary.minTopSimilarity)} · item{" "}
                  {formatSimilarity(retrievalSummary.minItemSimilarity)} · count{" "}
                  {retrievalSummary.minItemsAboveThreshold ?? "—"}
                </span>
              </div>
              {retrievalSummary.skippedReason && (
                <div className="mt-2 flex items-center justify-between gap-3">
                  <span>Gate decision</span>
                  <span className="font-semibold text-warning">
                    {retrievalSummary.skippedReason.replace("_", " ")}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {sourceUrl && sourceUrl !== "—" && (
          <a
            href={sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-6 inline-flex h-10 items-center gap-2 rounded-xl border border-outline-variant/20 px-4 text-sm font-semibold text-on-surface-variant transition hover:border-primary/30 hover:text-primary"
          >
            <ExternalLink className="h-4 w-4" />
            Open source
          </a>
        )}

        {itemIds.length > 0 && (
          <div className="mt-6 rounded-2xl border border-outline-variant/15 bg-surface-container-low p-4">
            <h3 className="font-semibold text-on-surface">Retrieved corpus items</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {itemIds.map((id) => (
                <a
                  key={id}
                  href={`/dashboard/admin/corpus?tab=items&q=${encodeURIComponent(id)}`}
                  className="rounded-lg bg-surface px-2.5 py-1.5 font-mono text-xs font-semibold text-primary"
                >
                  {id.slice(0, 8)}
                </a>
              ))}
            </div>
            {retrievalSummary?.injectedItemIds.length ? (
              <div className="mt-3 rounded-xl border border-secondary/15 bg-secondary/10 p-3 text-xs font-semibold text-secondary">
                Injected into prompt:{" "}
                {retrievalSummary.injectedItemIds.map((id) => id.slice(0, 8)).join(", ")}
              </div>
            ) : null}
          </div>
        )}

        <TextBlock title="Record JSON" value={JSON.stringify(row, null, 2)} />
      </div>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-low p-4">
      <div className="type-eyebrow text-on-surface-variant">
        {label}
      </div>
      <div className="mt-2 truncate text-lg font-bold text-on-surface">{value}</div>
    </div>
  );
}

function TextBlock({ title, value }: { title: string; value: string }) {
  return (
    <div className="mt-6 rounded-2xl border border-outline-variant/15 bg-surface-container-low p-4">
      <h3 className="font-semibold text-on-surface">{title}</h3>
      <pre className="mt-3 max-h-[560px] overflow-auto whitespace-pre-wrap rounded-xl bg-surface p-4 text-xs leading-5 text-on-surface-variant">
        {value}
      </pre>
    </div>
  );
}
