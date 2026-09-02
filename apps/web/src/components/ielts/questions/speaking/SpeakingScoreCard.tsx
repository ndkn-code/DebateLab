"use client";

/** Band + criteria + transcript result for a scored Speaking response. */
import { useLocale, useTranslations } from "next-intl";
import type { SpeakingResponseView } from "@/lib/api/ielts/speaking-responses-repository";
import { GradingConfidenceNote } from "@/components/ielts/learner/GradingConfidenceNote";
import { gradingPresentationFromResult } from "@/components/ielts/learner/GradingResultDetails";
import {
  extractFeedbackSummary,
  hasPhonemeDetail,
} from "@/lib/ielts/capture/capture-format";
import {
  CaptureBandResult,
  CaptureDetails,
  type CaptureBandRow,
} from "../CaptureBandResult";

export function SpeakingScoreCard({ view }: { view: SpeakingResponseView }) {
  const t = useTranslations("ielts.player");
  const locale = useLocale();
  const grading = gradingPresentationFromResult(view);
  const rows: CaptureBandRow[] = [
    {
      key: "fc",
      label: t("bands.fluencyCoherence"),
      band: view.bands.fluencyCoherence,
    },
    {
      key: "lr",
      label: t("bands.lexicalResource"),
      band: view.bands.lexicalResource,
    },
    {
      key: "gr",
      label: t("bands.grammaticalRangeAccuracy"),
      band: view.bands.grammaticalRangeAccuracy,
    },
    { key: "pr", label: t("bands.pronunciation"), band: view.bands.pronunciation },
  ];
  return (
    <CaptureBandResult
      headlineLabel={t("speaking.speakingBand")}
      headlineBand={view.bands.speaking}
      rows={rows}
      summary={extractFeedbackSummary(view.feedback, locale)}
    >
      {view.transcript ? (
        <CaptureDetails summary={t("speaking.transcript")}>
          {view.transcript}
        </CaptureDetails>
      ) : null}
      {hasPhonemeDetail(view.phonemeReport) ? (
        <p className="type-caption text-on-surface-variant">
          {t("speaking.pronunciationDetail")}
        </p>
      ) : null}
      {grading ? (
        <GradingConfidenceNote metadata={grading.metadata} locale={locale} />
      ) : null}
    </CaptureBandResult>
  );
}
