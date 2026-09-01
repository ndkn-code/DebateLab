import { cn } from "@/lib/utils";
import type { LearnerGradingMetadata } from "./GradingResultDetails";

const COPY = {
  en: {
    confidence: "Confidence",
    level: { high: "High", medium: "Moderate", limited: "Limited" },
    acousticUnavailable:
      "Pronunciation confidence is limited because an acoustic analysis was not available.",
    adjacentEvidenceUnavailable:
      "Approved comparison examples were not available for this score.",
    retrievalUnavailable:
      "Some approved scoring references could not be retrieved.",
    limitationRecorded: "A scoring limitation was recorded.",
  },
  vi: {
    confidence: "Độ tin cậy",
    level: { high: "Cao", medium: "Vừa", limited: "Giới hạn" },
    acousticUnavailable:
      "Độ tin cậy về phát âm bị giới hạn vì chưa có phân tích âm học.",
    adjacentEvidenceUnavailable:
      "Không có bài mẫu so sánh đã duyệt cho mức điểm này.",
    retrievalUnavailable:
      "Không thể truy xuất một số tài liệu chấm điểm đã duyệt.",
    limitationRecorded: "Hệ thống đã ghi nhận một giới hạn khi chấm điểm.",
  },
} as const;

interface ConfidenceCopy {
  acousticUnavailable: string;
  adjacentEvidenceUnavailable: string;
  retrievalUnavailable: string;
  limitationRecorded: string;
}

function limitationText(code: string, copy: ConfidenceCopy): string {
  if (code === "pronunciation_acoustic_evidence_unavailable") {
    return copy.acousticUnavailable;
  }
  if (code === "no_approved_adjacent_band_evidence") {
    return copy.adjacentEvidenceUnavailable;
  }
  if (code.startsWith("retrieval:")) return copy.retrievalUnavailable;
  return copy.limitationRecorded;
}

export function gradingConfidencePresentation(
  metadata: LearnerGradingMetadata,
  locale: string,
) {
  const copy = locale.toLowerCase().startsWith("vi") ? COPY.vi : COPY.en;
  return {
    label: copy.confidence,
    level: copy.level[metadata.confidence],
    limitations: Array.from(
      new Set(metadata.limitations.map((code) => limitationText(code, copy))),
    ),
  };
}

export function GradingConfidenceNote({
  metadata,
  locale = "en",
}: {
  metadata: LearnerGradingMetadata;
  locale?: string;
}) {
  const presentation = gradingConfidencePresentation(metadata, locale);
  return (
    <div
      role="note"
      aria-label={presentation.label}
      className={cn(
        "rounded-control border px-3 py-2.5",
        presentation.limitations.length > 0
          ? "border-warning/30 bg-warning-container text-on-warning-container"
          : "border-outline-variant bg-surface text-on-surface",
      )}
    >
      <p className="type-label font-semibold">
        {presentation.label}: {presentation.level}
      </p>
      {presentation.limitations.length > 0 ? (
        <ul className="mt-1 flex list-disc flex-col gap-1 pl-4 type-caption">
          {presentation.limitations.map((limitation) => (
            <li key={limitation}>{limitation}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
