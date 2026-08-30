"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
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
import { AdminV2Frame } from "@/components/admin/AdminV2Frame";
import { useAdminDialogFocus } from "@/components/admin/use-admin-dialog-focus";
import {
  AiKnowledgeGovernanceDetail,
  CollectionVersionCell,
  EvidencePolicyBadge,
  getAiKnowledgeGovernance,
  ProvenanceCell,
  redactProtectedBenchmarkFields,
  SourceAuthorityCell,
  SourceRightsCell,
  useAiKnowledgeCopy,
} from "./AiKnowledgeGovernance";
import { AiKnowledgeGovernanceWorkbench } from "./AiKnowledgeGovernanceWorkbench";

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
  | "knowledge"
  | "import"
  | "sources"
  | "matches"
  | "items"
  | "motions"
  | "logs";

type DetailKind = "source" | "match" | "item" | "motion" | "log" | "import";

const TABS: Array<{
  key: TabKey;
  labelKey: `tabs.${TabKey}`;
  icon: typeof Layers3;
}> = [
  { key: "overview", labelKey: "tabs.overview", icon: Layers3 },
  { key: "knowledge", labelKey: "tabs.knowledge", icon: BadgeCheck },
  { key: "import", labelKey: "tabs.import", icon: Import },
  { key: "sources", labelKey: "tabs.sources", icon: FileText },
  { key: "matches", labelKey: "tabs.matches", icon: Target },
  { key: "items", labelKey: "tabs.items", icon: Archive },
  { key: "motions", labelKey: "tabs.motions", icon: Sparkles },
  { key: "logs", labelKey: "tabs.logs", icon: BrainCircuit },
];

const REVIEW_OPTIONS = [
  ["all", "filters.allStatuses"],
  ["candidate", "filters.candidate"],
  ["needs_review", "filters.needsReview"],
  ["approved", "filters.approved"],
  ["rejected", "filters.rejected"],
  ["published", "filters.published"],
] as const;

const ITEM_TYPE_OPTIONS = [
  ["all", "filters.allItemTypes"],
  ["debate_moment", "filters.debateMoments"],
  ["phrase_bank", "filters.phraseBank"],
  ["judging_lesson", "filters.judgingLessons"],
] as const;

function getString(
  row: CorpusRow | null | undefined,
  key: string,
  fallback = "—",
) {
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
  return typeof value === "number" && Number.isFinite(value)
    ? `${value}ms`
    : "—";
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
          .reduce(
            (total, value, _index, values) => total + value / values.length,
            0,
          )
      : null);
  const candidateCount =
    getNestedNumber(gate, "candidateCount") ?? retrievedItems.length;
  const injectedCount =
    getNestedNumber(gate, "injectedCount") ?? candidateCount;
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
    status = skippedReason.toLowerCase().includes("abort")
      ? "timed_out"
      : "empty";
  } else if (
    skippedReason === "flag_disabled" ||
    (passed === null && candidateCount === 0)
  ) {
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
      (value): value is string => typeof value === "string",
    ),
    retrievedItems,
  };
}

function rowTitle(row: CorpusRow, kind: DetailKind) {
  if (kind === "source") {
    return getString(
      row,
      "title",
      getString(row, "video_title", getString(row, "id")),
    );
  }
  if (kind === "match")
    return getString(row, "motion_vi", getString(row, "canonical_match_key"));
  if (kind === "item")
    return getString(row, "embedding_text", getString(row, "item_type"));
  if (kind === "motion")
    return getString(row, "motion_vi", getString(row, "motion_key"));
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
  const t = useTranslations("admin.corpus");
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") as TabKey | null;
  const [activeTab, setActiveTab] = useState<TabKey>(
    initialTab && TABS.some((tab) => tab.key === initialTab)
      ? initialTab
      : "overview",
  );
  const [reviewStatus, setReviewStatus] = useState("all");
  const [itemType, setItemType] = useState("all");
  const [queryText, setQueryText] = useState(searchParams.get("q") ?? "");
  const [data, setData] = useState<CorpusDashboardResponse | null>(null);
  const [selected, setSelected] = useState<{
    kind: DetailKind;
    row: CorpusRow;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [importContent, setImportContent] = useState("");
  const [importFileName, setImportFileName] = useState(
    "truong-teen-source-bundle.md",
  );

  const query = useMemo(
    () => createQuery({ reviewStatus, itemType, q: queryText.trim() }),
    [itemType, queryText, reviewStatus],
  );

  const loadData = useCallback(() => {
    let cancelled = false;
    setError(null);
    fetch(`/api/admin/corpus?${query}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          const body = (await response.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(body.error || t("messages.loadStudioError"));
        }
        return response.json() as Promise<CorpusDashboardResponse>;
      })
      .then((nextData) => {
        if (!cancelled) setData(nextData);
      })
      .catch((nextError) => {
        if (!cancelled) {
          setData(null);
          setError(
            nextError instanceof Error
              ? nextError.message
              : t("messages.loadDataError"),
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [query, t]);

  useEffect(() => loadData(), [loadData]);

  const runAction = async (
    label: string,
    action: () => Promise<string | null | void>,
  ) => {
    setBusyAction(label);
    setNotice(null);
    setError(null);
    try {
      const message = await action();
      if (message) setNotice(message);
      loadData();
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : t("messages.actionFailed"),
      );
    } finally {
      setBusyAction(null);
    }
  };

  const patchReview = async (
    kind: "sources" | "matches" | "items" | "motions",
    row: CorpusRow,
    status: string,
  ) => {
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
        const body = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error || t("messages.updateReviewError"));
      }
      return t("messages.marked", {
        status: t(
          `filters.${status === "needs_review" ? "needsReview" : status}`,
        ),
      });
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
        const body = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error || t("messages.publishError"));
      }
      const body = (await response.json()) as { topicKey?: string };
      return t("messages.publishedMotion", {
        topic: body.topicKey ? ` as ${body.topicKey}` : "",
      });
    });
  };

  const importBundle = async () => {
    await runAction("import", async () => {
      const response = await fetch("/api/admin/corpus/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: importContent,
          fileName: importFileName,
        }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error || t("messages.importError"));
      }
      const body = (await response.json()) as {
        summary?: {
          sources: number;
          matches: number;
          items: number;
          motions: number;
        };
      };
      setImportContent("");
      return body.summary
        ? `Imported ${body.summary.sources} sources, ${body.summary.matches} matches, ${body.summary.items} items, and ${body.summary.motions} motions.`
        : t("messages.importCompleted");
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
        const body = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error || t("messages.embeddingError"));
      }
      const body = (await response.json()) as {
        embedded?: number;
        skipped?: number;
      };
      return t("messages.embeddingCompleted", {
        embedded: body.embedded ?? 0,
        skipped: body.skipped ?? 0,
      });
    });
  };

  const loading = data === null && error === null;
  const kpis = data?.kpis;

  return (
    <AdminV2Frame>
      <div className="min-h-full bg-background px-4 py-6 lg:px-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/8 px-3 py-1 type-eyebrow text-primary">
                <Lock className="h-3.5 w-3.5" />
                {t("title")}
              </div>
              <h1 className="mt-3 text-3xl font-bold tracking-normal text-on-surface">
                {t("heading")}
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-on-surface-variant">
                {t("description")}
              </p>
            </div>
            {activeTab !== "knowledge" ? (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => loadData()}
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-outline-variant/20 bg-surface px-4 text-sm font-semibold text-on-surface-variant transition hover:border-primary/30 hover:text-primary"
                >
                  <RefreshCw className="h-4 w-4" />
                  {t("actions.refresh")}
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
                  {t("actions.embed", { count: 16 })}
                </button>
              </div>
            ) : null}
          </header>

          {kpis && activeTab !== "knowledge" && (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
              <Kpi
                label={t("kpis.sources")}
                value={String(kpis.sourceCount)}
                icon={FileText}
              />
              <Kpi
                label={t("kpis.matches")}
                value={String(kpis.matchCount)}
                icon={Target}
              />
              <Kpi
                label={t("kpis.items")}
                value={String(kpis.itemCount)}
                icon={Archive}
              />
              <Kpi
                label={t("kpis.motions")}
                value={String(kpis.motionCount)}
                icon={Sparkles}
              />
              <Kpi
                label={t("kpis.published")}
                value={String(kpis.publishedMotionCount)}
                icon={BadgeCheck}
              />
              <Kpi
                label={t("kpis.staleVectors")}
                value={String(kpis.missingEmbeddingCount)}
                icon={Layers}
              />
            </div>
          )}

          <section className="rounded-2xl border border-outline-variant/15 bg-surface p-3 shadow-sm">
            <div
              role="tablist"
              aria-label={t("labels.corpusViews")}
              className="flex gap-2 overflow-x-auto"
            >
              {TABS.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    role="tab"
                    id={`corpus-tab-${tab.key}`}
                    aria-controls="corpus-tabpanel"
                    aria-selected={activeTab === tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    onKeyDown={(event) => {
                      if (
                        event.key !== "ArrowRight" &&
                        event.key !== "ArrowLeft"
                      )
                        return;
                      event.preventDefault();
                      const currentIndex = TABS.findIndex(
                        (item) => item.key === tab.key,
                      );
                      const offset = event.key === "ArrowRight" ? 1 : -1;
                      const next =
                        TABS[
                          (currentIndex + offset + TABS.length) % TABS.length
                        ];
                      setActiveTab(next.key);
                      document
                        .getElementById(`corpus-tab-${next.key}`)
                        ?.focus();
                    }}
                    className={cn(
                      "inline-flex h-10 shrink-0 items-center gap-2 rounded-xl px-3 text-sm font-semibold transition",
                      activeTab === tab.key
                        ? "bg-primary text-on-primary"
                        : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {t(tab.labelKey)}
                  </button>
                );
              })}
            </div>
          </section>

          {activeTab !== "knowledge" ? (
            <section className="grid gap-3 rounded-2xl border border-outline-variant/15 bg-surface p-4 shadow-sm lg:grid-cols-[1.2fr_180px_180px]">
              <label className="relative block">
                <span className="sr-only">{t("labels.searchCorpus")}</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" />
                <input
                  value={queryText}
                  onChange={(event) => setQueryText(event.target.value)}
                  placeholder={t("labels.searchPlaceholder")}
                  className="h-11 w-full rounded-xl border border-outline-variant/20 bg-surface-container-low pl-10 pr-3 text-sm text-on-surface outline-none transition placeholder:text-on-surface-variant focus:border-primary/50"
                />
              </label>
              <Select
                value={reviewStatus}
                onChange={setReviewStatus}
                options={REVIEW_OPTIONS}
              />
              <Select
                value={itemType}
                onChange={setItemType}
                options={ITEM_TYPE_OPTIONS}
              />
            </section>
          ) : null}

          {error && <StatusBanner tone="error">{error}</StatusBanner>}
          {notice && <StatusBanner tone="success">{notice}</StatusBanner>}

          {loading ? (
            <div className="flex min-h-[360px] items-center justify-center rounded-2xl border border-outline-variant/15 bg-surface">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <div
              id="corpus-tabpanel"
              role="tabpanel"
              aria-labelledby={`corpus-tab-${activeTab}`}
              tabIndex={0}
            >
              {activeTab === "overview" && data && (
                <OverviewPanel data={data} onSelect={setSelected} />
              )}
              {activeTab === "knowledge" && <AiKnowledgeGovernanceWorkbench />}
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
                <SourcesTable
                  rows={data.sources}
                  onSelect={(row) => setSelected({ kind: "source", row })}
                  onReview={patchReview}
                  busyAction={busyAction}
                />
              )}
              {activeTab === "matches" && data && (
                <MatchesTable
                  rows={data.matches}
                  onSelect={(row) => setSelected({ kind: "match", row })}
                  onReview={patchReview}
                  busyAction={busyAction}
                />
              )}
              {activeTab === "items" && data && (
                <ItemsTable
                  rows={data.items}
                  onSelect={(row) => setSelected({ kind: "item", row })}
                  onReview={patchReview}
                  busyAction={busyAction}
                />
              )}
              {activeTab === "motions" && data && (
                <MotionsTable
                  rows={data.motions}
                  onSelect={(row) => setSelected({ kind: "motion", row })}
                  onReview={patchReview}
                  onPublish={publishMotion}
                  busyAction={busyAction}
                />
              )}
              {activeTab === "logs" && data && (
                <LogsTable
                  rows={data.retrievalLogs}
                  onSelect={(row) => setSelected({ kind: "log", row })}
                />
              )}
            </div>
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
    </AdminV2Frame>
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
        <div className="type-eyebrow text-on-surface-variant">{label}</div>
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
  const t = useTranslations("admin.corpus");
  return (
    <label className="block">
      <span className="sr-only">{t("labels.filter")}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-xl border border-outline-variant/20 bg-surface-container-low px-3 text-sm font-semibold text-on-surface outline-none transition focus:border-primary/50"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {t(optionLabel as `filters.${string}`)}
          </option>
        ))}
      </select>
    </label>
  );
}

function StatusBanner({
  tone,
  children,
}: {
  tone: "success" | "error";
  children: ReactNode;
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      aria-live={tone === "error" ? "assertive" : "polite"}
      className={cn(
        "rounded-2xl border px-4 py-3 text-sm font-semibold",
        tone === "success" &&
          "border-secondary/20 bg-secondary/10 text-secondary",
        tone === "error" && "border-error/20 bg-error-container text-error",
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
  const t = useTranslations("admin.corpus");
  const reviewCounts = data.kpis.reviewCounts ?? {};
  const providerCounts = data.kpis.providerCounts ?? {};
  const recentItems = data.items.slice(0, 5);
  const recentMotions = data.motions.slice(0, 5);

  return (
    <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
      <section className="rounded-2xl border border-outline-variant/15 bg-surface p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-primary" />
          <h2 className="text-lg font-bold text-on-surface">
            {t("headings.reviewQueue")}
          </h2>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {Object.entries(reviewCounts).map(([status, count]) => (
            <div
              key={status}
              className="rounded-xl border border-outline-variant/15 bg-surface-container-low p-4"
            >
              <StatusPill status={status} />
              <div className="mt-3 text-2xl font-bold text-on-surface">
                {count}
              </div>
            </div>
          ))}
          {Object.keys(reviewCounts).length === 0 && (
            <EmptyState label={t("empty.noItemsLoaded")} />
          )}
        </div>
        <div className="mt-5">
          <h3 className="text-sm font-bold text-on-surface">
            {t("headings.embeddingProviders")}
          </h3>
          <div className="mt-3 space-y-2">
            {Object.entries(providerCounts).map(([provider, count]) => (
              <div
                key={provider}
                className="flex items-center justify-between rounded-xl bg-surface-container-low px-3 py-2 text-sm"
              >
                <span className="truncate text-on-surface-variant">
                  {provider}
                </span>
                <span className="font-bold text-on-surface">{count}</span>
              </div>
            ))}
            {Object.keys(providerCounts).length === 0 && (
              <EmptyState label={t("empty.noEmbeddings")} />
            )}
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <QueueCard
          title={t("headings.recentItems")}
          rows={recentItems}
          kind="item"
          onSelect={onSelect}
          renderMeta={(row) =>
            `${getString(row, "item_type")} · ${getString(row, "evidence_status")}`
          }
        />
        <QueueCard
          title={t("headings.motionCandidates")}
          rows={recentMotions}
          kind="motion"
          onSelect={onSelect}
          renderMeta={(row) =>
            `${getString(row, "category_key")} · ${getString(row, "difficulty")}`
          }
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
  const t = useTranslations("admin.corpus");
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
              <div className="truncate text-sm font-bold text-on-surface">
                {rowTitle(row, kind)}
              </div>
              <div className="mt-1 truncate text-xs text-on-surface-variant">
                {renderMeta(row)}
              </div>
            </div>
            <StatusPill status={getString(row, "review_status", "candidate")} />
          </button>
        ))}
        {rows.length === 0 && <EmptyState label={t("empty.queue")} />}
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
  const t = useTranslations("admin.corpus");
  return (
    <section className="rounded-2xl border border-outline-variant/15 bg-surface p-5 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-lg font-bold text-on-surface">
            {t("headings.importBundle")}
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-on-surface-variant">
            {t("importDescription")}
          </p>
        </div>
        <button
          type="button"
          disabled={busy || content.trim().length < 20}
          onClick={onImport}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-on-primary transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Import className="h-4 w-4" />
          )}
          {t("actions.importBundle")}
        </button>
      </div>
      <label className="mt-5 block">
        <span className="type-eyebrow text-on-surface-variant">
          {t("labels.fileName")}
        </span>
        <input
          value={fileName}
          onChange={(event) => onFileNameChange(event.target.value)}
          className="mt-2 h-11 w-full rounded-xl border border-outline-variant/20 bg-surface-container-low px-3 text-sm text-on-surface outline-none transition focus:border-primary/50"
        />
      </label>
      <label className="mt-4 block">
        <span className="type-eyebrow text-on-surface-variant">
          {t("labels.bundleContent")}
        </span>
        <textarea
          value={content}
          onChange={(event) => onContentChange(event.target.value)}
          placeholder={t("labels.bundlePlaceholder")}
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
  const t = useTranslations("admin.corpus");
  const knowledgeCopy = useAiKnowledgeCopy();
  return (
    <DataTable
      rows={rows}
      emptyLabel={t("empty.sources")}
      headers={[
        t("table.source"),
        knowledgeCopy.authority,
        knowledgeCopy.rights,
        knowledgeCopy.review,
        knowledgeCopy.provenance,
        t("table.actions"),
      ]}
      renderRow={(row) => (
        <tr
          key={getString(row, "id")}
          className="border-t border-outline-variant/10"
        >
          <CellButton
            onClick={() => onSelect(row)}
            title={getString(row, "title", getString(row, "video_title"))}
            subtitle={getString(
              row,
              "publisher",
              getString(row, "source_type"),
            )}
          />
          <SourceAuthorityCell row={row} />
          <SourceRightsCell row={row} />
          <td className="px-4 py-3">
            <StatusPill
              status={getString(
                row,
                "review_status",
                getString(row, "reviewStatus"),
              )}
            />
          </td>
          <ProvenanceCell row={row} />
          <td className="px-4 py-3">
            {getAiKnowledgeGovernance(row).hasGovernanceData ? (
              <span className="type-caption font-semibold text-on-surface-variant">
                {knowledgeCopy.readOnly}
              </span>
            ) : (
              <ReviewButtons
                row={row}
                kind="sources"
                busyAction={busyAction}
                onReview={(_, nextRow, status) =>
                  onReview("sources", nextRow, status)
                }
              />
            )}
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
  const t = useTranslations("admin.corpus");
  return (
    <DataTable
      rows={rows}
      emptyLabel={t("empty.matches")}
      headers={[
        t("table.motion"),
        t("table.decision"),
        t("table.confidence"),
        t("table.status"),
        t("table.updated"),
        t("table.actions"),
      ]}
      renderRow={(row) => (
        <tr
          key={getString(row, "id")}
          className="border-t border-outline-variant/10"
        >
          <CellButton
            onClick={() => onSelect(row)}
            title={getString(row, "motion_vi")}
            subtitle={getString(row, "canonical_match_key")}
          />
          <td className="px-4 py-3 text-on-surface-variant">
            {getString(row, "import_decision")}
          </td>
          <td className="px-4 py-3 text-on-surface-variant">
            {formatPercent(getNumber(row, "aggregate_confidence"))}
          </td>
          <td className="px-4 py-3">
            <StatusPill status={getString(row, "review_status")} />
          </td>
          <td className="px-4 py-3 text-on-surface-variant">
            {formatDate(row.updated_at)}
          </td>
          <td className="px-4 py-3">
            <ReviewButtons
              row={row}
              kind="matches"
              busyAction={busyAction}
              onReview={(_, nextRow, status) =>
                onReview("matches", nextRow, status)
              }
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
  const t = useTranslations("admin.corpus");
  const knowledgeCopy = useAiKnowledgeCopy();
  return (
    <DataTable
      rows={rows}
      emptyLabel={t("empty.items")}
      headers={[
        t("table.item"),
        knowledgeCopy.evidenceUse,
        knowledgeCopy.collection,
        knowledgeCopy.provenance,
        knowledgeCopy.review,
        t("table.actions"),
      ]}
      renderRow={(row) => (
        <tr
          key={getString(row, "id")}
          className="border-t border-outline-variant/10"
        >
          <CellButton
            onClick={() => onSelect(row)}
            title={getString(row, "embedding_text")}
            subtitle={getString(row, "item_type", getString(row, "item_kind"))}
          />
          <td className="px-4 py-3 align-top">
            <EvidencePolicyBadge row={row} />
          </td>
          <CollectionVersionCell row={row} />
          <ProvenanceCell row={row} />
          <td className="px-4 py-3 align-top">
            <StatusPill
              status={getString(
                row,
                "review_status",
                getString(row, "reviewStatus"),
              )}
            />
          </td>
          <td className="px-4 py-3">
            {getAiKnowledgeGovernance(row).hasGovernanceData ? (
              <span className="type-caption font-semibold text-on-surface-variant">
                {knowledgeCopy.readOnly}
              </span>
            ) : (
              <ReviewButtons
                row={row}
                kind="items"
                busyAction={busyAction}
                onReview={(_, nextRow, status) =>
                  onReview("items", nextRow, status)
                }
              />
            )}
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
  const t = useTranslations("admin.corpus");
  return (
    <DataTable
      rows={rows}
      emptyLabel={t("empty.motions")}
      headers={[
        t("table.motion"),
        t("table.category"),
        t("table.publish"),
        t("table.status"),
        t("table.updated"),
        t("table.actions"),
      ]}
      renderRow={(row) => (
        <tr
          key={getString(row, "id")}
          className="border-t border-outline-variant/10"
        >
          <CellButton
            onClick={() => onSelect(row)}
            title={getString(row, "motion_vi")}
            subtitle={getString(row, "source_stage")}
          />
          <td className="px-4 py-3">
            <div className="font-semibold text-on-surface">
              {getString(row, "category_key")}
            </div>
            <div className="text-xs text-on-surface-variant">
              {getString(row, "difficulty")}
            </div>
          </td>
          <td className="px-4 py-3 text-on-surface-variant">
            {getString(row, "publish_status")}
          </td>
          <td className="px-4 py-3">
            <StatusPill status={getString(row, "review_status")} />
          </td>
          <td className="px-4 py-3 text-on-surface-variant">
            {formatDate(row.updated_at)}
          </td>
          <td className="px-4 py-3">
            <div className="flex flex-wrap gap-1">
              <ReviewButtons
                row={row}
                kind="motions"
                busyAction={busyAction}
                onReview={(_, nextRow, status) =>
                  onReview("motions", nextRow, status)
                }
              />
              <button
                type="button"
                disabled={
                  getString(row, "publish_status") === "published" ||
                  busyAction === `publish:${getString(row, "id", "")}`
                }
                onClick={() => onPublish(row)}
                className="h-8 rounded-lg border border-primary/25 bg-primary/8 px-3 text-xs font-bold text-primary transition hover:bg-primary/15 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t("actions.publish")}
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
  const t = useTranslations("admin.corpus");
  return (
    <DataTable
      rows={rows}
      emptyLabel={t("empty.logs")}
      headers={[
        t("table.queryHash"),
        t("table.provider"),
        t("table.status"),
        t("table.similarity"),
        t("table.injected"),
        t("table.latency"),
        t("table.aiRun"),
      ]}
      renderRow={(row) => {
        const summary = getRetrievalSummary(row);
        const latencyMs = getNumber(row, "latency_ms");
        return (
          <tr
            key={getString(row, "id")}
            className="border-t border-outline-variant/10"
          >
            <CellButton
              onClick={() => onSelect(row)}
              title={getString(row, "query_hash")}
              subtitle={formatDate(row.created_at)}
            />
            <td className="px-4 py-3">
              <div className="font-semibold text-on-surface">
                {getString(row, "provider")}
              </div>
              <div className="max-w-[220px] truncate text-xs text-on-surface-variant">
                {getString(row, "model")}
              </div>
            </td>
            <td className="px-4 py-3">
              <RetrievalStatusPill status={summary.status} />
            </td>
            <td className="px-4 py-3">
              <div className="font-semibold text-on-surface">
                {formatSimilarity(summary.topSimilarity)}
              </div>
              <div className="text-xs text-on-surface-variant">
                {t("detail.top3Short")}{" "}
                {formatSimilarity(summary.avgTop3Similarity)}
              </div>
            </td>
            <td className="px-4 py-3 text-on-surface-variant">
              {summary.injectedCount} / {summary.candidateCount}
            </td>
            <td className="px-4 py-3 text-on-surface-variant">
              {formatMilliseconds(latencyMs)}
            </td>
            <td className="px-4 py-3 text-on-surface-variant">
              {getString(row, "ai_quality_run_id")}
            </td>
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
          <tbody>{rows.map(renderRow)}</tbody>
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
      <button
        type="button"
        onClick={onClick}
        className="block max-w-[420px] text-left"
      >
        <span className="line-clamp-2 font-semibold leading-5 text-on-surface">
          {title}
        </span>
        <span className="mt-1 block truncate text-xs text-on-surface-variant">
          {subtitle}
        </span>
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
  onReview: (
    kind: "sources" | "matches" | "items" | "motions",
    row: CorpusRow,
    status: string,
  ) => void;
}) {
  const t = useTranslations("admin.corpus");
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
                : "border-outline-variant/20 bg-surface text-on-surface-variant hover:border-primary/30 hover:text-primary",
            )}
          >
            {busyAction === actionKey ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : status === "needs_review" ? (
              t("filters.needsReview")
            ) : (
              t(`filters.${status}`)
            )}
          </button>
        );
      })}
    </div>
  );
}

function StatusPill({ status }: { status: unknown }) {
  const t = useTranslations("admin.corpus");
  const statusLabels: Record<string, string> = {
    approved: t("filters.approved"),
    published: t("filters.published"),
    candidate: t("filters.candidate"),
    needs_review: t("filters.needsReview"),
    rejected: t("filters.rejected"),
  };
  const label =
    typeof status === "string"
      ? (statusLabels[status] ?? status.replace("_", " "))
      : "unknown";
  const tone = reviewTone(status);
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize",
        tone === "success" && "bg-secondary/10 text-secondary",
        tone === "warning" && "bg-warning/15 text-warning",
        tone === "error" && "bg-error-container text-error",
        tone === "neutral" && "bg-surface-container text-on-surface-variant",
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
  const t = useTranslations("admin.corpus");
  const config = {
    injected: {
      label: t("status.injected"),
      icon: CheckCircle2,
      className: "border-secondary/20 bg-secondary/10 text-secondary",
    },
    low_relevance: {
      label: t("status.skipped"),
      icon: AlertTriangle,
      className: "border-warning/30 bg-warning/15 text-warning",
    },
    timed_out: {
      label: t("status.timedOut"),
      icon: Clock3,
      className: "border-error/20 bg-error-container text-error",
    },
    disabled: {
      label: t("status.disabled"),
      icon: XCircle,
      className:
        "border-outline-variant/20 bg-surface-container text-on-surface-variant",
    },
    empty: {
      label: t("status.noContext"),
      icon: BrainCircuit,
      className:
        "border-outline-variant/20 bg-surface-container text-on-surface-variant",
    },
  }[status];
  const Icon = config.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
        config.className,
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
  const t = useTranslations("admin.corpus");
  const dialogRef = useAdminDialogFocus(true, onClose);
  const sourceUrl = getString(
    row,
    "youtube_url",
    getString(row, "source_url", ""),
  );
  const retrievalSummary = kind === "log" ? getRetrievalSummary(row) : null;
  const itemIds =
    retrievalSummary?.retrievedItems
      .map((item) => item.item_id)
      .filter((value): value is string => typeof value === "string") ?? [];

  return (
    <div className="fixed inset-0 z-50 bg-black/20">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="corpus-detail-title"
        tabIndex={-1}
        className="absolute right-0 top-0 h-full w-full max-w-2xl overflow-y-auto border-l border-outline-variant/20 bg-surface p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="type-eyebrow text-primary">
              {t(
                `tabs.${kind === "source" ? "sources" : kind === "match" ? "matches" : kind === "item" ? "items" : kind === "motion" ? "motions" : kind === "log" ? "logs" : "import"}`,
              )}
            </div>
            <h2
              id="corpus-detail-title"
              className="mt-2 line-clamp-3 text-2xl font-bold text-on-surface"
            >
              {rowTitle(row, kind)}
            </h2>
            <p className="mt-1 text-sm text-on-surface-variant">
              {getString(row, "id", getString(row, "canonical_match_key"))} ·{" "}
              {formatDate(row.updated_at ?? row.created_at)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-on-surface-variant hover:bg-surface-container"
            aria-label={t("actions.close")}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <MiniMetric
            label={t("detail.status")}
            value={getString(row, "review_status", getString(row, "status"))}
          />
          <MiniMetric
            label={t("detail.confidence")}
            value={formatPercent(
              getNumber(row, "confidence") ??
                getNumber(row, "aggregate_confidence") ??
                getNumber(row, "overall_confidence"),
            )}
          />
          <MiniMetric
            label={t("detail.updated")}
            value={formatDate(row.updated_at ?? row.created_at)}
          />
        </div>

        {retrievalSummary && (
          <div className="mt-6 rounded-2xl border border-outline-variant/15 bg-surface-container-low p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-semibold text-on-surface">
                {t("detail.relevanceSummary")}
              </h3>
              <RetrievalStatusPill status={retrievalSummary.status} />
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <MiniMetric
                label={t("detail.topSimilarity")}
                value={formatSimilarity(retrievalSummary.topSimilarity)}
              />
              <MiniMetric
                label={t("detail.avgTop3")}
                value={formatSimilarity(retrievalSummary.avgTop3Similarity)}
              />
              <MiniMetric
                label={t("detail.injected")}
                value={`${retrievalSummary.injectedCount}/${retrievalSummary.candidateCount}`}
              />
            </div>
            <div className="mt-4 rounded-xl border border-outline-variant/15 bg-surface p-3 text-sm text-on-surface-variant">
              <div className="flex items-center justify-between gap-3">
                <span>{t("detail.itemsAboveThreshold")}</span>
                <span className="font-semibold text-on-surface">
                  {retrievalSummary.itemsAboveThresholdCount}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3">
                <span>{t("detail.thresholds")}</span>
                <span className="text-right font-semibold text-on-surface">
                  top {formatSimilarity(retrievalSummary.minTopSimilarity)} ·
                  item {formatSimilarity(retrievalSummary.minItemSimilarity)} ·
                  count {retrievalSummary.minItemsAboveThreshold ?? "—"}
                </span>
              </div>
              {retrievalSummary.skippedReason && (
                <div className="mt-2 flex items-center justify-between gap-3">
                  <span>{t("detail.gateDecision")}</span>
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
            {t("actions.openSource")}
          </a>
        )}

        {itemIds.length > 0 && (
          <div className="mt-6 rounded-2xl border border-outline-variant/15 bg-surface-container-low p-4">
            <h3 className="font-semibold text-on-surface">
              {t("detail.retrievedItems")}
            </h3>
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
                {t("detail.injectedIntoPrompt")}:{" "}
                {retrievalSummary.injectedItemIds
                  .map((id) => id.slice(0, 8))
                  .join(", ")}
              </div>
            ) : null}
          </div>
        )}

        {(kind === "source" || kind === "item") && (
          <AiKnowledgeGovernanceDetail row={row} />
        )}

        <TextBlock
          title={t("detail.recordJson")}
          value={JSON.stringify(redactProtectedBenchmarkFields(row), null, 2)}
        />
      </div>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-low p-4">
      <div className="type-eyebrow text-on-surface-variant">{label}</div>
      <div className="mt-2 truncate text-lg font-bold text-on-surface">
        {value}
      </div>
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
