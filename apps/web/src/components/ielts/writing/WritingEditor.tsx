"use client";

/**
 * The Writing task editor row: exam textarea, minimum-length meter, and the
 * one action (submit for scoring in practice; autosave note in simulation).
 */
import { useTranslations } from "next-intl";
import { ExamButton } from "../exam/ExamButton";
import { ExamTextarea } from "../exam/ExamTextarea";
import {
  canStartPaidScoring,
  type CaptureActionState,
} from "../questions/capture-action-state";
import { WritingProgress } from "./WritingProgress";

export function WritingEditor({
  essay,
  words,
  minWords,
  disabled,
  isSimulation,
  actionState,
  canSubmit,
  onEssay,
  onSubmit,
}: {
  essay: string;
  words: number;
  minWords: number;
  disabled: boolean;
  isSimulation: boolean;
  actionState: CaptureActionState;
  canSubmit: boolean;
  onEssay: (text: string) => void;
  onSubmit: () => void;
}) {
  const t = useTranslations("ielts.player");
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <ExamTextarea
        value={essay}
        disabled={disabled}
        onChange={(event) => onEssay(event.target.value)}
        placeholder={t("writing.placeholder")}
      />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <WritingProgress
          words={words}
          minWords={minWords}
          className="min-w-[12rem] flex-1"
        />
        {isSimulation ? (
          <span className="type-caption font-medium text-on-surface-variant">
            {t("writing.simulationAutosave")}
          </span>
        ) : canStartPaidScoring(actionState) ? (
          <ExamButton tone="primary" onClick={onSubmit} disabled={!canSubmit}>
            {actionState === "retryable"
              ? t("writing.retry")
              : t("writing.submit")}
          </ExamButton>
        ) : null}
      </div>
    </div>
  );
}
