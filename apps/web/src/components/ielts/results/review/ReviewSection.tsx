"use client";

/**
 * One objective skill (Listening / Reading) in review: a CD-IELTS split pane
 * per part — source on the left, questions on the right — with the jump
 * controller scoped to that part. Nothing about the split is persisted.
 */
import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { ExamSplitPane } from "@/components/ielts/exam/ExamSplitPane";
import type { IeltsResponseMap } from "@/lib/ielts/question-contract";
import {
  indexGroupsByKey,
  type IeltsQuestionGroupView,
} from "@/lib/ielts/question-types";
import type { ObjectiveReviewSection } from "@/lib/ielts/results/types";
import { ReviewQuestionList } from "./ReviewQuestionList";
import { ReviewSourcePane } from "./ReviewSourcePane";
import { ReviewSourceProvider } from "./review-source-context";

export function ReviewSection({
  section,
  groups,
  responses,
}: {
  section: ObjectiveReviewSection;
  groups: IeltsQuestionGroupView[];
  responses: IeltsResponseMap;
}) {
  const t = useTranslations("ielts.results.review");
  const groupsByKey = useMemo(() => indexGroupsByKey(groups), [groups]);
  const sourceLabel = section.skill === "listening" ? t("transcript") : t("passage");

  return (
    <div className="flex flex-col gap-5">
      {section.parts.map((part, index) => (
        <ReviewSourceProvider key={part.partId}>
          <ExamSplitPane
            attemptId={null}
            leftLabel={sourceLabel}
            rightLabel={t("title")}
            left={
              <ReviewSourcePane
                part={part}
                skill={section.skill}
                partNumber={index + 1}
              />
            }
            right={
              <ReviewQuestionList
                part={part}
                groups={groupsByKey}
                responses={responses}
              />
            }
            className="rounded-xl border border-outline-variant bg-surface-container-lowest lg:h-[70vh]"
          />
        </ReviewSourceProvider>
      ))}
    </div>
  );
}
