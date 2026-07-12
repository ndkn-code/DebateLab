"use client";

/**
 * The active timed section (WS-2.1): server-authoritative timer, pause/resume,
 * part navigation (passages / listening sections), stimulus, the question list
 * (rendered via the WS-1.2 contract), and section submit. Answers are disabled
 * once the section is paused, submitted, or past its server deadline — the DB
 * enforces the same, this just keeps the UI honest.
 */
import { useEffect, useMemo, useState } from "react";
import type { Tables } from "@/types/supabase";
import type { IeltsResponseMap } from "@/lib/ielts/question-contract";
import type {
  SectionRuntimeStatus,
  SectionTimingState,
} from "@/lib/ielts/section-timing";
import type { MockStructure } from "@/lib/api/ielts/mock-repository";
import { useMockAnnotationsStore } from "@/lib/stores/mockAnnotationsStore";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ListeningAudioPlayer } from "./ListeningAudioPlayer";
import { QuestionHost } from "./QuestionHost";
import { SectionReviewSheet } from "./SectionReviewSheet";
import { PassageHighlighter } from "./PassageHighlighter";
import { MockPreTestGuide } from "./MockPreTestGuide";
import { ExamSectionFooter, ExamSectionHeader } from "./exam/ExamChrome";
import { buildSectionParts, type MockPart } from "./mock-parts";
import {
  buildMockQuestionStatuses,
  summarizeMockQuestionStatuses,
} from "./mock-flow-status";

/** Passage / listening stimulus column; renders nothing for Writing/Speaking. */
function SectionStimulus({ part }: { part: MockPart }) {
  if (part.audio.length === 0 && part.body === null) return null;
  return (
    <div className="flex flex-col gap-4">
      {part.audio.length > 0 ? <ListeningAudioPlayer tracks={part.audio} /> : null}
      {part.body !== null ? (
        <PassageHighlighter passageKey={part.id} title={part.title} body={part.body} />
      ) : null}
    </div>
  );
}

/**
 * One navigable part: Reading/Listening pair a stimulus with the questions;
 * Writing/Speaking tasks have no stimulus, so their capture surfaces span the
 * full width.
 */
function SectionPart({
  part,
  attemptId,
  numberOffset,
  disabled,
  responses,
  onAnswer,
}: {
  part: MockPart;
  attemptId: string;
  numberOffset: number;
  disabled: boolean;
  responses: IeltsResponseMap;
  onAnswer: (questionId: string, value: unknown) => void;
}) {
  const hasStimulus = part.audio.length > 0 || part.body !== null;
  return (
    <div className={hasStimulus ? "grid gap-5 lg:grid-cols-2" : "flex flex-col gap-3"}>
      <SectionStimulus part={part} />
      <div className="flex flex-col gap-3">
        {part.questions.map((question, index) => (
          <QuestionHost
            key={question.id}
            question={question}
            number={numberOffset + index + 1}
            value={responses[question.id]}
            disabled={disabled}
            onChange={(value) => onAnswer(question.id, value)}
            context={{ attemptId }}
            allowFlag
          />
        ))}
        {part.questions.length === 0 ? (
          <p className="text-sm text-on-surface-variant">No questions in this part.</p>
        ) : null}
      </div>
    </div>
  );
}

interface Props {
  section: Tables<"ielts_attempt_sections">;
  sections: Tables<"ielts_attempt_sections">[];
  structure: MockStructure;
  responses: IeltsResponseMap;
  busy: boolean;
  testTitle: string;
  activeSectionIndex: number;
  onAnswer: (questionId: string, value: unknown) => void;
  onSwitchSection: (index: number) => void;
  onPause: () => void;
  onResume: () => void;
  onSubmitSection: () => void;
  onExpire: () => void;
  onFinish: () => void;
}

const PILL = "rounded-full px-4 py-1.5 text-sm font-semibold";

function activeQuestionForPart(
  part: MockPart | undefined,
  activeQuestionId: string | null,
): string | null {
  if (!part) return null;
  if (activeQuestionId && part.questions.some((question) => question.id === activeQuestionId)) {
    return activeQuestionId;
  }
  return part.questions[0]?.id ?? null;
}

export function MockSectionView({
  section,
  sections,
  structure,
  responses,
  busy,
  testTitle,
  activeSectionIndex,
  onAnswer,
  onSwitchSection,
  onPause,
  onResume,
  onSubmitSection,
  onExpire,
  onFinish,
}: Props) {
  const [activePart, setActivePart] = useState(0);
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  const [pendingScrollQuestionId, setPendingScrollQuestionId] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [timerStatus, setTimerStatus] = useState<SectionRuntimeStatus>("not_started");
  const flags = useMockAnnotationsStore((store) => store.flags);

  const parts = useMemo(
    () => buildSectionParts(structure, section.skill, process.env.NEXT_PUBLIC_SUPABASE_URL),
    [structure, section.skill],
  );
  const activePartIndex = parts.length === 0 ? -1 : Math.min(activePart, parts.length - 1);
  const part = activePartIndex >= 0 ? parts[activePartIndex] : undefined;
  const sectionLabel = section.label ?? section.skill;
  const currentQuestionId = activeQuestionForPart(part, activeQuestionId);

  useEffect(() => {
    if (!pendingScrollQuestionId) return undefined;
    const frame = window.requestAnimationFrame(() => {
      document
        .getElementById(`mock-q-${pendingScrollQuestionId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
      setPendingScrollQuestionId(null);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activePartIndex, pendingScrollQuestionId]);

  const timing: SectionTimingState = {
    startedAt: section.started_at,
    deadlineAt: section.deadline_at,
    submittedAt: section.submitted_at,
    pausedAt: section.paused_at,
    timeLimitSeconds: section.time_limit_seconds,
  };
  const paused = section.paused_at !== null;
  const locked = section.submitted_at !== null || timerStatus === "expired";
  const disabled = locked || paused || busy;

  // Global question number = count in prior parts + index within this part.
  const numberOffset = activePartIndex <= 0
    ? 0
    : parts
        .slice(0, activePartIndex)
        .reduce((sum, p) => sum + p.questions.length, 0);
  const questionStatuses = useMemo(
    () =>
      buildMockQuestionStatuses({
        parts,
        responses,
        flags,
        attemptId: section.attempt_id,
        activeQuestionId: currentQuestionId,
      }),
    [currentQuestionId, flags, parts, responses, section.attempt_id],
  );
  const questionCounts = useMemo(
    () => summarizeMockQuestionStatuses(questionStatuses),
    [questionStatuses],
  );

  const selectPart = (index: number) => {
    setActivePart(index);
    setActiveQuestionId(parts[index]?.questions[0]?.id ?? null);
  };

  const jumpToQuestion = (partIndex: number, questionId: string) => {
    setActivePart(partIndex);
    setActiveQuestionId(questionId);
    setPendingScrollQuestionId(questionId);
  };

  const isLastSection = activeSectionIndex === sections.length - 1;

  return (
    <section className="flex h-full min-h-0 flex-col bg-background text-on-surface">
      <ExamSectionHeader
        testTitle={testTitle}
        sectionLabel={sectionLabel}
        sections={sections}
        activeSectionIndex={activeSectionIndex}
        timing={timing}
        paused={paused}
        busy={busy}
        locked={locked}
        guideOpen={guideOpen}
        onTimerStatusChange={setTimerStatus}
        onExpire={onExpire}
        onPause={onPause}
        onResume={onResume}
        onOpenGuide={() => setGuideOpen(true)}
        onSwitchSection={onSwitchSection}
      />

      <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain scroll-smooth">
        <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-4 px-3 py-4 sm:px-5 sm:py-5">
          {parts.length > 1 ? (
            <nav className="flex gap-2 overflow-x-auto" aria-label="Section parts">
              {parts.map((candidate, index) => (
                <button
                  key={candidate.id}
                  type="button"
                  onClick={() => selectPart(index)}
                  aria-current={index === activePartIndex ? "step" : undefined}
                  className={`${PILL} shrink-0 ${
                    index === activePartIndex
                      ? "bg-secondary text-on-secondary"
                      : "bg-surface-container text-on-surface-variant"
                  }`}
                >
                  {candidate.title}
                </button>
              ))}
            </nav>
          ) : null}

          {paused ? (
            <p className="rounded-2xl bg-error-container px-4 py-3 text-sm font-medium text-error">
              Paused — the clock is frozen. Resume to keep answering.
            </p>
          ) : null}

          {part ? (
            <SectionPart
              part={part}
              attemptId={section.attempt_id}
              numberOffset={numberOffset}
              disabled={disabled}
              responses={responses}
              onAnswer={onAnswer}
            />
          ) : (
            <p className="text-sm text-on-surface-variant">This section has no content yet.</p>
          )}
        </div>
      </main>

      <ExamSectionFooter
        sectionLabel={sectionLabel}
        statuses={questionStatuses}
        counts={questionCounts}
        activePartIndex={activePartIndex}
        partsLength={parts.length}
        busy={busy}
        locked={locked}
        isLastSection={isLastSection}
        onSelectPart={selectPart}
        onJump={jumpToQuestion}
        onReview={() => setReviewOpen(true)}
        onFinish={onFinish}
      />

      <SectionReviewSheet
        open={reviewOpen}
        sectionLabel={sectionLabel}
        statuses={questionStatuses}
        counts={questionCounts}
        busy={busy || locked}
        onOpenChange={setReviewOpen}
        onJump={jumpToQuestion}
        onConfirm={onSubmitSection}
      />

      <Dialog open={guideOpen} onOpenChange={setGuideOpen}>
        <DialogContent
          className="bottom-0 left-0 top-auto !z-[1000] flex max-h-[calc(100dvh-1rem)] w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-b-none rounded-t-xl border border-outline-variant bg-surface p-0 shadow-2xl sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl"
          overlayClassName="!z-[900] bg-inverse-surface/20"
        >
          <DialogHeader className="border-b border-outline-variant px-4 py-4 pr-12 sm:px-5">
            <DialogTitle className="text-base font-bold text-on-surface">
              How this mock works
            </DialogTitle>
          </DialogHeader>
          <div className="min-h-0 overflow-y-auto px-4 py-4 sm:px-5">
            <MockPreTestGuide showHeading={false} className="shadow-none" />
          </div>
          <DialogFooter className="mx-0 mb-0 rounded-none border-t border-outline-variant bg-surface px-4 py-3 sm:px-5">
            <button
              type="button"
              onClick={() => setGuideOpen(false)}
              className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-on-primary transition hover:bg-primary/90"
            >
              Got it
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
