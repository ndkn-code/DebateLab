import type { Tables } from "@/types/supabase";
import type {
  SectionRuntimeStatus,
  SectionTimingState,
} from "@/lib/ielts/section-timing";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { ProductIcon } from "@/components/ui/product-icon";
import { cn } from "@/lib/utils";
import type {
  MockQuestionCounts,
  MockQuestionStatus,
} from "../mock-flow-status";
import { QuestionNavigator } from "../QuestionNavigator";
import { SectionTimer } from "../SectionTimer";
import { ExamButton } from "./ExamButton";

function ExamToolbar() {
  return (
    <div
      data-exam-toolbar="reserved"
      className="hidden min-h-10 min-w-10 items-center gap-2 rounded-xl border border-dashed border-outline-variant bg-surface-container-low px-3 text-on-surface-variant lg:flex"
      aria-label="Exam annotation tools"
    >
      <ProductIcon name="highlighter" size="sm" aria-hidden="true" />
      <span className="sr-only">Reserved for highlight and note tools</span>
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
  guideOpen,
  onTimerStatusChange,
  onExpire,
  onPause,
  onResume,
  onOpenGuide,
  onSwitchSection,
}: {
  testTitle: string;
  sectionLabel: string;
  sections: Tables<"ielts_attempt_sections">[];
  activeSectionIndex: number;
  timing: SectionTimingState;
  paused: boolean;
  busy: boolean;
  locked: boolean;
  guideOpen: boolean;
  onTimerStatusChange: (status: SectionRuntimeStatus) => void;
  onExpire: () => void;
  onPause: () => void;
  onResume: () => void;
  onOpenGuide: () => void;
  onSwitchSection: (index: number) => void;
}) {
  return (
    <header className="z-20 shrink-0 border-b border-outline-variant bg-surface/95 shadow-sm backdrop-blur">
      <div className="flex min-h-16 items-center gap-3 px-3 py-2 sm:px-5">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-extrabold text-on-surface sm:text-base">
            {testTitle}
          </h1>
          <p className="truncate text-xs font-bold text-on-surface-variant sm:text-sm">
            {sectionLabel} · Section {activeSectionIndex + 1} of {sections.length}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <SectionTimer
            timing={timing}
            onExpire={onExpire}
            onStatusChange={onTimerStatusChange}
          />
          <ExamButton
            onClick={paused ? onResume : onPause}
            disabled={busy || locked}
            className="size-10 px-0 sm:w-auto sm:px-4"
            aria-label={paused ? "Resume section" : "Pause section"}
          >
            <ProductIcon name={paused ? "play" : "pause"} size="sm" weight="bold" />
            <span className="hidden sm:inline">{paused ? "Resume" : "Pause"}</span>
          </ExamButton>
          <ExamToolbar />
          <button
            type="button"
            onClick={onOpenGuide}
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-outline-variant bg-surface-container-lowest text-on-surface transition hover:bg-surface-container-low"
            aria-haspopup="dialog"
            aria-expanded={guideOpen}
            aria-label="How this mock works"
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
        aria-label="Test sections"
      >
        {sections.map((candidate, index) => (
          <button
            key={candidate.id}
            type="button"
            onClick={() => onSwitchSection(index)}
            disabled={busy}
            aria-current={index === activeSectionIndex ? "step" : undefined}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition disabled:opacity-50",
              index === activeSectionIndex
                ? "bg-primary text-on-primary"
                : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high",
            )}
          >
            {candidate.label ?? candidate.skill}
            {candidate.submitted_at !== null ? (
              <ProductIcon name="checkCircle" size="xs" weight="fill" aria-hidden="true" />
            ) : null}
          </button>
        ))}
      </nav>
    </header>
  );
}

function questionChipClass(status: MockQuestionStatus) {
  if (status.current) return "border-primary bg-primary text-on-primary";
  if (status.flagged) return "border-warning bg-warning-container text-on-warning-container";
  if (status.answered) return "border-success/40 bg-success-container text-on-success-container";
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
  isLastSection: boolean;
  onSelectPart: (index: number) => void;
  onJump: (partIndex: number, questionId: string) => void;
  onReview: () => void;
  onFinish: () => void;
}) {
  return (
    <footer className="z-20 shrink-0 border-t border-outline-variant bg-surface/95 shadow-[0_-4px_16px_rgb(0_0_0/0.06)] backdrop-blur">
      <div className="flex min-w-0 items-center gap-2 border-b border-outline-variant px-3 py-2 sm:px-5">
        <span className="shrink-0 text-xs font-extrabold text-on-surface-variant">
          Part {Math.max(1, activePartIndex + 1)}
        </span>
        <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto py-0.5" aria-label="Questions">
          {statuses.map((status) => (
            <button
              key={status.questionId}
              type="button"
              onClick={() => onJump(status.partIndex, status.questionId)}
              aria-current={status.current ? "true" : undefined}
              aria-label={`Question ${status.number}, ${status.answered ? "answered" : "unanswered"}${status.flagged ? ", flagged" : ""}`}
              className={cn(
                "relative flex size-8 shrink-0 items-center justify-center rounded-lg border text-xs font-extrabold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                questionChipClass(status),
              )}
            >
              {status.number}
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
      <div className="flex items-center justify-between gap-2 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 sm:px-5">
        <div className="flex items-center gap-2">
          <ExamButton
            onClick={() => onSelectPart(activePartIndex - 1)}
            disabled={busy || activePartIndex <= 0}
            aria-label="Previous part"
            className="size-10 px-0 sm:w-auto sm:px-4"
          >
            <ProductIcon name="chevronLeft" size="sm" weight="bold" />
            <span className="hidden sm:inline">Previous</span>
          </ExamButton>
          <ExamButton
            onClick={() => onSelectPart(activePartIndex + 1)}
            disabled={busy || activePartIndex < 0 || activePartIndex >= partsLength - 1}
            aria-label="Next part"
            className="size-10 px-0 sm:w-auto sm:px-4"
          >
            <span className="hidden sm:inline">Next</span>
            <ProductIcon name="chevronRight" size="sm" weight="bold" />
          </ExamButton>
        </div>
        <div className="flex min-w-0 items-center justify-end gap-2">
          <QuestionNavigator
            sectionLabel={sectionLabel}
            statuses={statuses}
            counts={counts}
            onJump={onJump}
          />
          <ExamButton
            tone="primary"
            onClick={onReview}
            disabled={busy || locked}
            className="px-3 sm:px-4"
          >
            <ProductIcon name="listChecks" size="sm" weight="bold" />
            <span className="hidden md:inline">Review &amp; submit section</span>
            <span className="md:hidden">Review</span>
          </ExamButton>
          {isLastSection ? (
            <ExamButton tone="secondary" onClick={onFinish} disabled={busy} className="hidden sm:inline-flex">
              Finish test
              <ProductIcon name="arrowRight" size="sm" weight="bold" />
            </ExamButton>
          ) : null}
        </div>
      </div>
      {isLastSection ? (
        <div className="px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:hidden">
          <ExamButton tone="secondary" onClick={onFinish} disabled={busy} className="w-full">
            Finish test &amp; see band
            <ProductIcon name="arrowRight" size="sm" weight="bold" />
          </ExamButton>
        </div>
      ) : null}
    </footer>
  );
}
