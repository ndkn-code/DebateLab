"use client";

import Link from "next/link";
import { useLocale } from "next-intl";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import type { ResultsNextStep } from "@/lib/ielts/results/next-step";

const COPY = {
  en: {
    studyPlan: "Open study plan",
    assigned: "Back to assigned work",
    review: "Review answers",
    refresh: "Refresh scores",
    refreshing: "Refreshing…",
    failed: "Some skills could not be scored. Refresh to check for updates.",
  },
  vi: {
    studyPlan: "Mở kế hoạch học tập",
    assigned: "Về bài tập được giao",
    review: "Xem lại câu trả lời",
    refresh: "Cập nhật điểm",
    refreshing: "Đang cập nhật…",
    failed: "Một số kỹ năng chưa chấm được. Cập nhật điểm để kiểm tra lại.",
  },
} as const;

/** Adapted Review/Continue composition from Lumist; see README.md. */
export function ResultsActions({
  nextStep,
  hasReview,
  awaitingScores,
  hasFailedScores = false,
}: {
  nextStep: ResultsNextStep;
  hasReview: boolean;
  awaitingScores: boolean;
  hasFailedScores?: boolean;
}) {
  const locale = useLocale();
  const copy = COPY[locale === "vi" ? "vi" : "en"];
  const router = useRouter();
  const [refreshing, startTransition] = useTransition();
  return (
    <div className="flex min-w-0 flex-col gap-2">
      {hasFailedScores ? (
        <p role="status" className="type-body-sm text-on-surface-variant">
          {copy.failed}
        </p>
      ) : null}
      {nextStep.context ? (
        <p className="break-words type-body-sm text-on-surface-variant">
          {nextStep.context}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="primary"
          size="lg"
          nativeButton={false}
          className="h-auto min-h-9 max-w-full whitespace-normal py-2"
          render={<Link href={nextStep.href} />}
        >
          {copy[nextStep.kind]}
        </Button>
        {hasReview ? (
          <Button
            variant="outline"
            size="lg"
            nativeButton={false}
            className="h-auto min-h-9 max-w-full whitespace-normal py-2"
            render={<a href="#results-review" />}
          >
            {copy.review}
          </Button>
        ) : null}
        {awaitingScores ? (
          <Button
            variant="ghost"
            size="lg"
            disabled={refreshing}
            aria-busy={refreshing}
            className="h-auto min-h-9 max-w-full whitespace-normal py-2"
            onClick={() => startTransition(() => router.refresh())}
          >
            {refreshing ? copy.refreshing : copy.refresh}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
