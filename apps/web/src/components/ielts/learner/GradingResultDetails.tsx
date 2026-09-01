import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type GradingProcessStatus = "pending" | "scoring" | "scored" | "overridden" | "failed";

export interface GradingCriterion {
  key: string;
  label: string;
  band: number | null;
  rationale: string | null;
}

interface GradingEvidenceReference {
  version: string;
  itemType: string;
  reviewStatus: string;
  sourceLocator: string | null;
  authorityTier: string | null;
  rightsStatus: string | null;
}

export interface LearnerGradingMetadata {
  gradingVersion: string;
  corpusVersion: string | null;
  confidence: "high" | "medium" | "limited";
  limitations: string[];
  evidenceReferences: GradingEvidenceReference[];
}

export interface LearnerGradingPresentation {
  metadata: LearnerGradingMetadata;
  retrySafeRunId: string | null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function nonEmptyString(value: unknown, maxLength = 160): string | null {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, maxLength) : null;
}

function parseEvidence(value: unknown): GradingEvidenceReference[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 20).flatMap((candidate) => {
    const record = asRecord(candidate);
    if (!record) return [];
    const version = nonEmptyString(record.version);
    const itemType = nonEmptyString(record.itemType);
    const reviewStatus = nonEmptyString(record.reviewStatus);
    if (!version || !itemType || !reviewStatus) return [];
    return [
      {
        version,
        itemType,
        reviewStatus,
        sourceLocator: nonEmptyString(record.sourceLocator, 500),
        authorityTier: nonEmptyString(record.authorityTier, 80),
        rightsStatus: nonEmptyString(record.rightsStatus, 80),
      },
    ];
  });
}

/**
 * Narrow the persisted JSON before it enters the learner UI. Unknown fields,
 * source ids, retrieval scores, and provider trace ids are intentionally not
 * returned, so protected calibration labels cannot leak through this surface.
 */
export function parseLearnerGradingMetadata(value: unknown): LearnerGradingMetadata | null {
  const record = asRecord(value);
  if (!record) return null;

  const gradingVersion = nonEmptyString(record.gradingVersion);
  if (!gradingVersion) return null;

  const confidence = record.confidence;
  if (confidence !== "high" && confidence !== "medium" && confidence !== "limited") {
    return null;
  }

  const corpusVersion = nonEmptyString(record.corpusVersion);
  const limitations = Array.isArray(record.limitations)
    ? record.limitations.slice(0, 8).flatMap((item) => {
        const limitation = nonEmptyString(item);
        return limitation ? [limitation] : [];
      })
    : [];

  return {
    gradingVersion,
    corpusVersion,
    confidence,
    limitations,
    evidenceReferences: parseEvidence(record.evidenceReferences),
  };
}

/**
 * Compatibility seam for the learner results and polling view models. It also
 * accepts the direct database-shaped key in fixtures while preferring the
 * sanitized camelCase projection used by the stable results contract.
 */
export function gradingPresentationFromResult(result: unknown): LearnerGradingPresentation | null {
  const record = asRecord(result);
  if (!record) return null;

  const rawMetadata = record.gradingMetadata ?? record.grading_metadata;
  const metadata = parseLearnerGradingMetadata(rawMetadata);
  if (!metadata) return null;

  const metadataRecord = asRecord(rawMetadata);
  const retrySafeRunId = nonEmptyString(metadataRecord?.runId, 200) ?? nonEmptyString(record.workflowRunId, 200);

  return { metadata, retrySafeRunId };
}

function formatBand(value: number | null): string {
  return value === null ? "—" : value.toFixed(1);
}

const COPY = {
  en: {
    ariaLabel: "Score review details",
    title: "Score review",
    criterionScores: "Criterion scores",
    confidence: "Confidence",
    gradingMethod: "Grading method",
    runId: "Run ID",
    notAvailable: "Not available",
    keepInMind: "What to keep in mind",
    scoringReferences: "Scoring references",
    reviewed: "reviewed",
    version: "Version",
    noReferences: "No reviewed references are available to display.",
    referenceSet: "Reference set",
    officialGuidance: "Official scoring guidance",
    approvedSample: "Approved sample response",
    reviewedReference: "Reviewed scoring reference",
    sourceLocation: "Source location",
    acousticUnavailable: "Pronunciation confidence is limited because an acoustic analysis was not available.",
    adjacentEvidenceUnavailable: "Approved comparison examples were not available for this score.",
    retrievalUnavailable: "Some approved scoring references could not be retrieved.",
    limitationRecorded: "A scoring limitation was recorded.",
    status: {
      pending: "Waiting",
      scoring: "Checking",
      scored: "Complete",
      overridden: "Teacher reviewed",
      failed: "Needs retry",
    },
    confidenceLevel: { high: "High", medium: "Moderate", limited: "Limited" },
  },
  vi: {
    ariaLabel: "Chi tiết rà soát điểm",
    title: "Rà soát điểm",
    criterionScores: "Điểm theo tiêu chí",
    confidence: "Độ tin cậy",
    gradingMethod: "Phương pháp chấm",
    runId: "Mã lượt chấm",
    notAvailable: "Chưa có",
    keepInMind: "Điều cần lưu ý",
    scoringReferences: "Tài liệu chấm điểm",
    reviewed: "đã duyệt",
    version: "Phiên bản",
    noReferences: "Không có tài liệu đã duyệt để hiển thị.",
    referenceSet: "Bộ tài liệu",
    officialGuidance: "Hướng dẫn chấm điểm chính thức",
    approvedSample: "Bài mẫu đã duyệt",
    reviewedReference: "Tài liệu chấm điểm đã duyệt",
    sourceLocation: "Vị trí trong nguồn",
    acousticUnavailable: "Độ tin cậy về phát âm bị giới hạn vì chưa có phân tích âm học.",
    adjacentEvidenceUnavailable: "Không có bài mẫu so sánh đã duyệt cho mức điểm này.",
    retrievalUnavailable: "Không thể truy xuất một số tài liệu chấm điểm đã duyệt.",
    limitationRecorded: "Hệ thống đã ghi nhận một giới hạn khi chấm điểm.",
    status: {
      pending: "Đang chờ",
      scoring: "Đang chấm",
      scored: "Hoàn tất",
      overridden: "Giáo viên đã duyệt",
      failed: "Cần thử lại",
    },
    confidenceLevel: { high: "Cao", medium: "Vừa", limited: "Giới hạn" },
  },
} as const;

type GradingCopy = (typeof COPY)[keyof typeof COPY];

const STATUS_VARIANT: Record<GradingProcessStatus, "success" | "warning" | "destructive" | "info"> = {
  pending: "warning",
  scoring: "info",
  scored: "success",
  overridden: "success",
  failed: "destructive",
};

const CONFIDENCE_CLASS = {
  high: "text-success-dim",
  medium: "text-on-surface",
  limited: "text-on-warning-container",
} as const;

function evidenceLabel(itemType: string, copy: GradingCopy): string {
  const normalized = itemType.toLowerCase();
  if (normalized.includes("rubric") || normalized.includes("descriptor")) {
    return copy.officialGuidance;
  }
  if (normalized.includes("exemplar") || normalized.includes("example")) {
    return copy.approvedSample;
  }
  return copy.reviewedReference;
}

function evidencePolicyLabel(item: GradingEvidenceReference, locale: "en" | "vi") {
  const authority = {
    official: locale === "vi" ? "Nguồn chính thức" : "Official source",
    qualified_examiner_or_adjudicator: locale === "vi" ? "Giám khảo đủ điều kiện" : "Qualified examiner or adjudicator",
  }[item.authorityTier ?? ""];
  const rights = {
    approved_for_derived_use: locale === "vi" ? "Được phép sử dụng" : "Approved for use",
    approved_for_excerpt: locale === "vi" ? "Được phép trích dẫn" : "Approved excerpt",
    public_domain: locale === "vi" ? "Phạm vi công cộng" : "Public domain",
  }[item.rightsStatus ?? ""];
  return [authority, rights].filter(Boolean).join(" · ");
}

function limitationCopy(code: string, copy: GradingCopy): string {
  if (code === "pronunciation_acoustic_evidence_unavailable") {
    return copy.acousticUnavailable;
  }
  if (code === "no_approved_adjacent_band_evidence") {
    return copy.adjacentEvidenceUnavailable;
  }
  if (code.startsWith("retrieval:")) {
    return copy.retrievalUnavailable;
  }
  return copy.limitationRecorded;
}

function uniqueLimitationCopy(codes: string[], copy: GradingCopy): string[] {
  return Array.from(new Set(codes.map((code) => limitationCopy(code, copy))));
}

function isFinal(status: GradingProcessStatus): boolean {
  return status === "scored" || status === "overridden";
}

function CriteriaGrid({
  criteria,
  status,
  copy,
}: {
  criteria: GradingCriterion[];
  status: GradingProcessStatus;
  copy: GradingCopy;
}) {
  const final = isFinal(status);
  return (
    <div>
      <h4 className="type-label font-semibold text-on-surface">{copy.criterionScores}</h4>
      <ul className="mt-2 grid gap-2 sm:grid-cols-2">
        {criteria.map((criterion) => (
          <li key={criterion.key} className="rounded-control border border-outline-variant bg-surface px-3 py-2.5">
            <div className="flex items-start justify-between gap-3">
              <span className="type-label text-on-surface">{criterion.label}</span>
              <span
                className={cn(
                  "type-title shrink-0 font-semibold tabular-nums",
                  final ? "text-on-surface" : "text-on-surface-variant",
                )}
              >
                {final ? formatBand(criterion.band) : "—"}
              </span>
            </div>
            {final && criterion.rationale ? (
              <p className="mt-1.5 type-caption text-on-surface-variant">{criterion.rationale}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function EvidenceDetails({
  items,
  corpusVersion,
  copy,
  locale,
}: {
  items: GradingEvidenceReference[];
  corpusVersion: string | null;
  copy: GradingCopy;
  locale: "en" | "vi";
}) {
  const reviewed = items.filter((item) => item.reviewStatus.toLowerCase() === "approved");

  return (
    <details className="group rounded-control border border-outline-variant bg-surface">
      <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 rounded-control px-3 type-label text-on-surface outline-none focus-visible:ring-2 focus-visible:ring-primary/45 [&::-webkit-details-marker]:hidden">
        <span>{copy.scoringReferences}</span>
        <span className="text-on-surface-variant">
          {reviewed.length} {copy.reviewed}
        </span>
      </summary>
      <div className="border-t border-outline-variant px-3 py-3">
        {reviewed.length > 0 ? (
          <ol className="flex flex-col divide-y divide-outline-variant">
            {reviewed.map((item, index) => (
              <li
                key={`${item.itemType}-${item.version}-${index}`}
                className="flex min-h-10 items-start justify-between gap-3 py-2 first:pt-0 last:pb-0"
              >
                <span className="min-w-0 type-body-sm text-on-surface">
                  <span className="block">
                    {evidenceLabel(item.itemType, copy)} {index + 1}
                  </span>
                  {evidencePolicyLabel(item, locale) ? (
                    <span className="mt-0.5 block type-caption text-on-surface-variant">
                      {evidencePolicyLabel(item, locale)}
                    </span>
                  ) : null}
                  {item.sourceLocator ? (
                    <span className="mt-0.5 block break-words type-caption text-on-surface-variant">
                      {copy.sourceLocation}: {item.sourceLocator}
                    </span>
                  ) : null}
                </span>
                <span className="type-caption text-on-surface-variant">
                  {copy.version} {item.version}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="type-body-sm text-on-surface-variant">{copy.noReferences}</p>
        )}
        {corpusVersion ? (
          <p className="mt-3 type-caption text-on-surface-variant">
            {copy.referenceSet} {corpusVersion}
          </p>
        ) : null}
      </div>
    </details>
  );
}

export function GradingResultDetails({
  criteria,
  metadata,
  retrySafeRunId,
  status,
  locale = "en",
}: {
  criteria: GradingCriterion[];
  metadata: LearnerGradingMetadata;
  retrySafeRunId: string | null;
  status: GradingProcessStatus;
  locale?: string;
}) {
  const copy = locale.toLowerCase().startsWith("vi") ? COPY.vi : COPY.en;
  const evidenceLocale = locale.toLowerCase().startsWith("vi") ? "vi" : "en";
  const limitations = uniqueLimitationCopy(metadata.limitations, copy);

  return (
    <section
      aria-label={copy.ariaLabel}
      className="rounded-xl border border-outline-variant bg-surface-container-low p-3 sm:p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="type-title font-semibold text-on-surface">{copy.title}</h3>
        <Badge aria-live="polite" variant={STATUS_VARIANT[status]}>
          {copy.status[status]}
        </Badge>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 rounded-control border border-outline-variant bg-surface px-3 py-2.5 sm:grid-cols-3">
        <div>
          <p className="type-caption text-on-surface-variant">{copy.confidence}</p>
          <p className={cn("type-label font-semibold", CONFIDENCE_CLASS[metadata.confidence])}>
            {copy.confidenceLevel[metadata.confidence]}
          </p>
        </div>
        <div>
          <p className="type-caption text-on-surface-variant">{copy.gradingMethod}</p>
          <p className="type-label font-semibold text-on-surface break-words">{metadata.gradingVersion}</p>
        </div>
        <div className="col-span-2 sm:col-span-1">
          <p className="type-caption text-on-surface-variant">{copy.runId}</p>
          <p className="type-label font-semibold text-on-surface break-all">{retrySafeRunId ?? copy.notAvailable}</p>
        </div>
      </div>

      {limitations.length > 0 ? (
        <div
          role="note"
          className="mt-3 rounded-control border border-warning/30 bg-warning-container px-3 py-2.5 text-on-warning-container"
        >
          <p className="type-label font-semibold">{copy.keepInMind}</p>
          <ul className="mt-1 flex list-disc flex-col gap-1 pl-4 type-body-sm">
            {limitations.map((limitation) => (
              <li key={limitation}>{limitation}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-3">
        <CriteriaGrid criteria={criteria} status={status} copy={copy} />
      </div>

      <div className="mt-3">
        <EvidenceDetails
          corpusVersion={metadata.corpusVersion}
          items={metadata.evidenceReferences}
          copy={copy}
          locale={evidenceLocale}
        />
      </div>
    </section>
  );
}
