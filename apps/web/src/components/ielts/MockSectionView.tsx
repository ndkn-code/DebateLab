"use client";

/**
 * The active timed section (WS-2.1): server-authoritative timer, pause/resume,
 * part navigation (passages / listening sections), stimulus, the question list
 * (rendered via the WS-1.2 contract), and section submit. Answers are disabled
 * once the section is paused, submitted, or past its server deadline — the DB
 * enforces the same, this just keeps the UI honest.
 */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { Tables } from "@/types/supabase";
import type { IeltsResponseMap } from "@/lib/ielts/question-contract";
import type {
  SectionRuntimeStatus,
  SectionTimingState,
} from "@/lib/ielts/section-timing";
import type { MockStructure } from "@/lib/api/ielts/mock-repository";
import {
  type MockHighlightColor,
  type NoteAnchor,
  useMockAnnotationsStore,
} from "@/lib/stores/mockAnnotationsStore";
import { ListeningStimulusDeck } from "./ListeningStimulusDeck";
import { QuestionHost } from "./QuestionHost";
import { SectionReviewSheet } from "./SectionReviewSheet";
import { PassageHighlighter } from "./PassageHighlighter";
import { MockGuideDialog } from "./MockGuideDialog";
import { ExamNotesSheet } from "./ExamNotesSheet";
import { ExamSelectionPopup } from "./ExamSelectionPopup";
import { ExamSectionFooter, ExamSectionHeader } from "./exam/ExamChrome";
import { buildSectionParts, type MockPart } from "./mock-parts";
import {
  buildMockQuestionStatuses,
  summarizeMockQuestionStatuses,
} from "./mock-flow-status";

/** Passage / listening stimulus column; renders nothing for Writing/Speaking. */
function SectionStimulus({
  part,
  onOpenNotes,
}: {
  part: MockPart;
  onOpenNotes: (noteId: string) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      {part.body !== null ? (
        <PassageHighlighter
          passageKey={part.id}
          title={part.title}
          body={part.body}
          onOpenNotes={onOpenNotes}
        />
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
  stimulus,
  hasStimulus,
  attemptId,
  numberOffset,
  disabled,
  responses,
  onAnswer,
  onOpenNotes,
}: {
  part: MockPart;
  stimulus: ReactNode;
  hasStimulus: boolean;
  attemptId: string;
  numberOffset: number;
  disabled: boolean;
  responses: IeltsResponseMap;
  onAnswer: (questionId: string, value: unknown) => void;
  onOpenNotes: (noteId: string) => void;
}) {
  return (
    <div className={hasStimulus ? "grid gap-5 lg:grid-cols-2" : "flex flex-col gap-3"}>
      {hasStimulus ? stimulus : null}
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
            onOpenNotes={onOpenNotes}
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

function boundedPartIndex(partsLength: number, activePart: number): number {
  if (partsLength === 0) return -1;
  return Math.min(activePart, partsLength - 1);
}

function sectionHasStimulus(
  skill: Tables<"ielts_attempt_sections">["skill"],
  part: MockPart | undefined,
  parts: MockPart[],
): boolean {
  if (!part) return false;
  if (part.body !== null) return true;
  return skill === "listening" && parts.some((item) => item.audio.length > 0);
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
  const [pendingAnnotationAnchor, setPendingAnnotationAnchor] =
    useState<NoteAnchor | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [highlightMode, setHighlightMode] = useState(true);
  const [selectedHighlightColor, setSelectedHighlightColor] =
    useState<MockHighlightColor>("yellow");
  const [timerStatus, setTimerStatus] = useState<SectionRuntimeStatus>("not_started");
  const [listeningPlaybackActive, setListeningPlaybackActive] = useState(false);
  const flags = useMockAnnotationsStore((store) => store.flags);
  const notes = useMockAnnotationsStore((store) => store.notes);

  const parts = useMemo(
    () => buildSectionParts(structure, section.skill, process.env.NEXT_PUBLIC_SUPABASE_URL),
    [structure, section.skill],
  );
  const activePartIndex = boundedPartIndex(parts.length, activePart);
  const part = activePartIndex >= 0 ? parts[activePartIndex] : undefined;
  const sectionLabel = section.label ?? section.skill;
  const currentQuestionId = activeQuestionForPart(part, activeQuestionId);
  const noteCount = useMemo(() => {
    const prefix = `${section.attempt_id}:`;
    return Object.entries(notes).reduce(
      (total, [key, values]) => total + (key.startsWith(prefix) ? values.length : 0),
      0,
    );
  }, [notes, section.attempt_id]);

  const openNotes = (noteId: string | null = null) => {
    setActiveNoteId(noteId);
    setNotesOpen(true);
  };

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

  useEffect(() => {
    if (!pendingAnnotationAnchor) return undefined;
    const frame = window.requestAnimationFrame(() => {
      const target = pendingAnnotationAnchor.kind === "question"
        ? document.getElementById(`mock-q-${pendingAnnotationAnchor.questionId}`)
        : document.querySelector<HTMLElement>(
            `[data-annotation-kind="passage"][data-annotation-key="${CSS.escape(pendingAnnotationAnchor.passageKey)}"]`,
          );
      target?.scrollIntoView({ behavior: "smooth", block: "center" });
      setPendingAnnotationAnchor(null);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activePartIndex, pendingAnnotationAnchor]);

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
  const hasStimulus = sectionHasStimulus(section.skill, part, parts);

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

  const handleAudioEnded = (partIndex: number) => {
    if (activePartIndex !== partIndex || partIndex >= parts.length - 1) return;
    selectPart(partIndex + 1);
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
        allowPause={section.skill !== "listening"}
        sectionNavigationLocked={listeningPlaybackActive}
        guideOpen={guideOpen}
        onTimerStatusChange={setTimerStatus}
        onExpire={onExpire}
        onPause={onPause}
        onResume={onResume}
        onOpenGuide={() => setGuideOpen(true)}
        onSwitchSection={onSwitchSection}
        highlightMode={highlightMode}
        selectedHighlightColor={selectedHighlightColor}
        noteCount={noteCount}
        onToggleHighlightMode={() => setHighlightMode((enabled) => !enabled)}
        onSelectHighlightColor={setSelectedHighlightColor}
        onOpenNotes={() => openNotes()}
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
              stimulus={(
                section.skill === "listening" ? (
                  <ListeningStimulusDeck
                    parts={parts}
                    activePartIndex={activePartIndex}
                    attemptId={section.attempt_id}
                    playbackBlocked={locked || paused}
                    onPlaybackActiveChange={setListeningPlaybackActive}
                    onAudioEnded={handleAudioEnded}
                  />
                ) : (
                  <SectionStimulus
                    part={part}
                    onOpenNotes={(noteId) => openNotes(noteId)}
                  />
                )
              )}
              hasStimulus={hasStimulus}
              attemptId={section.attempt_id}
              numberOffset={numberOffset}
              disabled={disabled}
              responses={responses}
              onAnswer={onAnswer}
              onOpenNotes={(noteId) => openNotes(noteId)}
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
        submissionLocked={listeningPlaybackActive}
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

      <ExamSelectionPopup
        highlightMode={highlightMode}
        selectedColor={selectedHighlightColor}
        onNoteCreated={(noteId) => openNotes(noteId)}
      />

      <ExamNotesSheet
        open={notesOpen}
        attemptId={section.attempt_id}
        activeNoteId={activeNoteId}
        parts={parts}
        onOpenChange={(open) => {
          setNotesOpen(open);
          if (!open) setActiveNoteId(null);
        }}
        onJumpToNote={(note) => {
          const anchor = note.anchor;
          const partIndex = parts.findIndex((candidate) =>
            anchor.kind === "passage"
              ? candidate.id === anchor.passageKey
              : candidate.questions.some((question) => question.id === anchor.questionId),
          );
          if (partIndex >= 0) {
            setActivePart(partIndex);
            if (anchor.kind === "question") setActiveQuestionId(anchor.questionId);
          }
          setPendingAnnotationAnchor(anchor);
        }}
      />

      <MockGuideDialog open={guideOpen} onOpenChange={setGuideOpen} />
    </section>
  );
}
