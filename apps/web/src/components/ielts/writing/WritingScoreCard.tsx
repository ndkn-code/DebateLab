"use client";

/** Band + criteria + model-answer result for a scored Writing response. */
import { useLocale, useTranslations } from "next-intl";
import type { WritingResponseView } from "@/lib/api/ielts/writing-responses-repository";
import { GradingConfidenceNote } from "@/components/ielts/learner/GradingConfidenceNote";
import { gradingPresentationFromResult } from "@/components/ielts/learner/GradingResultDetails";
import { extractFeedbackSummary } from "@/lib/ielts/capture/capture-format";
import {
  CaptureBandResult,
  CaptureDetails,
  type CaptureBandRow,
} from "../questions/CaptureBandResult";

export function WritingScoreCard({ view }: { view: WritingResponseView }) {
  const t = useTranslations("ielts.player");
  const locale = useLocale();
  const grading = gradingPresentationFromResult(view);
  const rows: CaptureBandRow[] = [
    { key: "tr", label: t("bands.taskResponse"), band: view.bands.taskResponse },
    {
      key: "cc",
      label: t("bands.coherenceCohesion"),
      band: view.bands.coherenceCohesion,
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
  ];
  return (
    <CaptureBandResult
      headlineLabel={t("writing.taskBand")}
      headlineBand={view.bands.task}
      rows={rows}
      summary={extractFeedbackSummary(view.criteriaFeedback, locale)}
    >
      {view.modelAnswer ? (
        <CaptureDetails summary={t("writing.modelAnswer")}>
          {view.modelAnswer}
        </CaptureDetails>
      ) : null}
      {grading ? (
        <GradingConfidenceNote metadata={grading.metadata} locale={locale} />
      ) : null}
    </CaptureBandResult>
  );
}
