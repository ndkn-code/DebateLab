import type { Tables } from "@/types/supabase";
import { useLocale, useTranslations } from "next-intl";
import type {
  SectionRuntimeStatus,
  SectionTimingState,
} from "@/lib/ielts/section-timing";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { ProductIcon } from "@/components/ui/product-icon";
import { cn } from "@/lib/utils";
import type { MockHighlightColor } from "@/lib/stores/mockAnnotationsStore";
import type {
  MockQuestionCounts,
  MockQuestionStatus,
} from "../mock-flow-status";
import { QuestionNavigator } from "../QuestionNavigator";
import { SectionTimer } from "../SectionTimer";
import { ExamButton } from "./ExamButton";
import { ExamAnnotationToolbar } from "./ExamAnnotationToolbar";
import {
  IELTS_PLAYER_EXPERIENCE_COPY,
  type IeltsPlayerLocale,
} from "../player-experience";
import { useIeltsPlayerExperience } from "../player-experience-context";

interface AnnotationToolbarProps {
  highlightMode: boolean;
  selectedColor: MockHighlightColor;
  noteCount: number;
  onToggleHighlightMode: () => void;
  onSelectHighlightColor: (color: MockHighlightColor) => void;
  onOpenNotes: () => void;
}

function ExamToolbar(props: AnnotationToolbarProps) {
  return (
    <div data-exam-toolbar="reserved" className="hidden lg:block">
      <ExamAnnotationToolbar
        highlightMode={props.highlightMode}
        selectedColor={props.selectedColor}
        noteCount={props.noteCount}
        onToggleHighlightMode={props.onToggleHighlightMode}
        onSelectColor={props.onSelectHighlightColor}
        onOpenNotes={props.onOpenNotes}
      />
    </div>
  );
}

export function ExamSectionHeader({
  testTitle,
  sectionLabel,
  sections,
  activeSectionIndex,
  timing,
  paused,
  busy,
  locked,
  allowPause,
  sectionNavigationLocked,
  guideOpen,
  warningSeconds,
  onTimerStatusChange,
  onExpire,
  onWarning,
  onPause,
  onResume,
  onOpenGuide,
  onSwitchSection,
  highlightMode,
  selectedHighlightColor,
  noteCount,
  onToggleHighlightMode,
  onSelectHighlightColor,
  onOpenNotes,
}: {
  testTitle: string;
  sectionLabel: string;
  sections: Tables<"ielts_attempt_sections">[];
  activeSectionIndex: number;
  timing: SectionTimingState;
  paused: boolean;
  busy: boolean;
  locked: boolean;
  allowPause: boolean;
  sectionNavigationLocked: boolean;
  guideOpen: boolean;
  /** Timer thresholds (seconds) to announce — see assessment-mode policy. */
  warningSeconds?: readonly number[];
  onTimerStatusChange: (status: SectionRuntimeStatus) => void;
  onExpire: () => void;
  onWarning?: (threshold: number) => void;
  onPause: () => void;
  onResume: () => void;
  onOpenGuide: () => void;
  onSwitchSection: (index: number) => void;
  highlightMode: boolean;
  selectedHighlightColor: MockHighlightColor;
  noteCount: number;
  onToggleHighlightMode: () => void;
  onSelectHighlightColor: (color: MockHighlightColor) => void;
  onOpenNotes: () => void;
}) {
  const t = useTranslations("ielts.player.exam");
  const currentLocale = useLocale();
  const locale: IeltsPlayerLocale = currentLocale === "vi" ? "vi" : "en";
  const experience = useIeltsPlayerExperience();
  const experienceLabel =
    IELTS_PLAYER_EXPERIENCE_COPY[locale][experience].label;

  return (
    <header className="z-20 shrink-0 border-b border-outline-variant bg-surface/95 shadow-sm backdrop-blur">
      <div className="flex min-h-16 items-center gap-1 px-3 py-2 sm:gap-3 sm:px-5">
        <div className="hidden min-w-0 flex-1 sm:block">
          <div className="flex min-w-0 items-center gap-2">
            <span className="type-caption shrink-0 rounded-md border border-outline-variant bg-surface-container px-2 py-1 font-extrabold uppercase tracking-wide text-on-surface-variant">
              {experienceLabel}
            </span>
            <h1 className="truncate text-sm font-extrabold text-on-surface sm:text-base">
              {testTitle}
            </h1>
          </div>
          <p className="truncate text-xs font-bold text-on-surface-variant sm:text-sm">
            {t("sectionPosition", {
              sectionLabel,
              current: activeSectionIndex + 1,
              total: sections.length,
            })}
          </p>
        </div>
        <div className="flex min-w-0 flex-1 items-center justify-end gap-1 sm:shrink-0 sm:gap-2">
          <SectionTimer
            timing={timing}
            warningSeconds={warningSeconds}
            onExpire={onExpire}
            onStatusChange={onTimerStatusChange}
            onWarning={onWarning}
          />
          {allowPause ? (
            <ExamButton
              onClick={paused ? onResume : onPause}
              disabled={busy || locked}
              className="size-10 px-0 sm:w-auto sm:px-4"
              aria-label={paused ? t("resumeSection") : t("pauseSection")}
            >
              <ProductIcon
                name={paused ? "play" : "pause"}
                size="sm"
                weight="bold"
              />
              <span className="hidden sm:inline">
                {paused ? t("resume") : t("pause")}
              </span>
            </ExamButton>
          ) : null}
          <div className="lg:hidden">
            <ExamAnnotationToolbar
              compact
              highlightMode={highlightMode}
              selectedColor={selectedHighlightColor}
              noteCount={noteCount}
              onToggleHighlightMode={onToggleHighlightMode}
              onSelectColor={onSelectHighlightColor}
              onOpenNotes={onOpenNotes}
            />
          </div>
          <ExamToolbar
            highlightMode={highlightMode}
            selectedColor={selectedHighlightColor}
            noteCount={noteCount}
            onToggleHighlightMode={onToggleHighlightMode}
            onSelectHighlightColor={onSelectHighlightColor}
            onOpenNotes={onOpenNotes}
          />
          <button
            type="button"
            onClick={onOpenGuide}
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-outline-variant bg-surface-container-lowest text-on-surface transition hover:bg-surface-container-low focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-haspopup="dialog"
            aria-expanded={guideOpen}
            aria-label={t("guideLabel")}
          >
            <ProductIcon name="help" size="md" weight="bold" />
          </button>
          <ThemeToggle
            variant="public"
            className="size-10 justify-center px-0 [&>span]:hidden"
          />
        </div>
      </div>
      <nav
        className="flex gap-2 overflow-x-auto border-t border-outline-variant px-3 py-2 sm:px-5"
        aria-label={t("testSections")}
      >
        {sections.map((candidate, index) => (
          <button
            key={candidate.id}
            type="button"
            onClick={() => onSwitchSection(index)}
            disabled={
              busy || (sectionNavigationLocked && index !== activeSectionIndex)
            }
            aria-current={index === activeSectionIndex ? "step" : undefined}
            className={cn(
              "inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-50",
              index === activeSectionIndex
                ? "bg-primary text-on-primary"
                : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high",
            )}
          >
            {candidate.label ?? candidate.skill}
            {candidate.submitted_at !== null ? (
              <ProductIcon
                name="checkCircle"
                size="xs"
                weight="fill"
                aria-hidden="true"
              />
            ) : null}
          </button>
        ))}
      </nav>
    </header>
  );
}

function questionChipClass(status: MockQuestionStatus) {
  if (status.current) return "border-primary bg-primary text-on-primary";
  if (status.flagged)
    return "border-warning bg-warning-container text-on-warning-container";
  if (status.answered)
    return "border-success/40 bg-success-container text-on-success-container";
  return "border-outline-variant bg-surface text-on-surface-variant hover:border-primary/50";
}

export function ExamSectionFooter({
  sectionLabel,
  statuses,
  counts,
  activePartIndex,
  partsLength,
  busy,
  locked,
  submissionLocked,
  previousLocked = false,
  isLastSection,
  onSelectPart,
  onJump,
  onReview,
  onFinish,
}: {
  sectionLabel: string;
  statuses: MockQuestionStatus[];
  counts: MockQuestionCounts;
  activePartIndex: number;
  partsLength: number;
  busy: boolean;
  locked: boolean;
  submissionLocked: boolean;
  /** Listening in exam mode: recordings play once, so earlier parts are closed. */
  previousLocked?: boolean;
  isLastSection: boolean;
  onSelectPart: (index: number) => void;
  onJump: (partIndex: number, questionId: string) => void;
  onReview: () => void;
  onFinish: () => void;
}) {
  const t = useTranslations("ielts.player.exam");
  const previousDisabled = busy || activePartIndex <= 0 || previousLocked;
  const previousHint =
    previousLocked && activePartIndex > 0 ? t("previousLocked") : undefined;
  return (
    <footer className="z-20 shrink-0 border-t border-outline-variant bg-surface/95 shadow-[0_-4px_16px_rgb(0_0_0/0.06)] backdrop-blur">
      <div className="flex min-w-0 items-center gap-2 border-b border-outline-variant px-3 py-2 sm:px-5">
        <span className="shrink-0 text-xs font-extrabold text-on-surface-variant">
          {t("part", { number: Math.max(1, activePartIndex + 1) })}
        </span>
        <div
          className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto py-0.5"
          aria-label={t("questions")}
        >
          {statuses.map((status) => (
            <button
              key={status.questionId}
              type="button"
              onClick={() => onJump(status.partIndex, status.questionId)}
              aria-current={status.current ? "true" : undefined}
              aria-label={`${t("question", { number: status.numberLabel })}, ${
                status.answered ? t("answered") : t("unanswered")
              }${status.flagged ? `, ${t("flagged")}` : ""}`}
              className={cn(
                "relative flex h-8 min-w-8 shrink-0 items-center justify-center rounded-lg border px-1.5 text-xs font-extrabold tabular-nums transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                questionChipClass(status),
              )}
            >
              {status.numberLabel}
              {status.flagged ? (
                <ProductIcon
                  name="bookmark"
                  size="xs"
                  weight="fill"
                  className="absolute -right-1 -top-1 text-warning"
                  aria-hidden="true"
                />
              ) : null}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 sm:px-5">
        <div className="flex items-center gap-2">
          {/* Disabled buttons drop pointer events; the wrapper keeps the lock hint. */}
          <span title={previousHint} className="inline-flex">
            <ExamButton
              onClick={() => onSelectPart(activePartIndex - 1)}
              disabled={previousDisabled}
              aria-label={previousHint ?? t("previousPart")}
              title={previousHint}
              className="size-10 px-0 sm:w-auto sm:px-4"
            >
              <ProductIcon name="chevronLeft" size="sm" weight="bold" />
              <span className="hidden sm:inline">{t("previous")}</span>
            </ExamButton>
          </span>
          <ExamButton
            onClick={() => onSelectPart(activePartIndex + 1)}
            disabled={
              busy || activePartIndex < 0 || activePartIndex >= partsLength - 1
            }
            aria-label={t("nextPart")}
            className="size-10 px-0 sm:w-auto sm:px-4"
          >
            <span className="hidden sm:inline">{t("next")}</span>
            <ProductIcon name="chevronRight" size="sm" weight="bold" />
          </ExamButton>
        </div>
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
          <QuestionNavigator
            sectionLabel={sectionLabel}
            statuses={statuses}
            counts={counts}
            onJump={onJump}
          />
          <ExamButton
            tone="primary"
            onClick={onReview}
            disabled={busy || locked || submissionLocked}
            className="px-3 sm:px-4"
          >
            <ProductIcon name="listChecks" size="sm" weight="bold" />
            <span className="hidden md:inline">{t("reviewSubmitSection")}</span>
            <span className="md:hidden">{t("review")}</span>
          </ExamButton>
          {isLastSection ? (
            <ExamButton
              tone="secondary"
              onClick={onFinish}
              disabled={busy || submissionLocked}
              className="hidden sm:inline-flex"
            >
              {t("finishTest")}
              <ProductIcon name="arrowRight" size="sm" weight="bold" />
            </ExamButton>
          ) : null}
        </div>
      </div>
      {isLastSection ? (
        <div className="px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:hidden">
          <ExamButton
            tone="secondary"
            onClick={onFinish}
            disabled={busy || submissionLocked}
            className="w-full"
          >
            {t("finishTest")}
            <ProductIcon name="arrowRight" size="sm" weight="bold" />
          </ExamButton>
        </div>
      ) : null}
    </footer>
  );
}
