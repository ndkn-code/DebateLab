"use client";

/**
 * The active timed section (WS-2.1): server-authoritative timer, pause/resume,
 * part navigation (passages / listening sections), stimulus, the question list
 * (rendered via the WS-1.2 contract), and section submit. Answers are disabled
 * once the section is paused, submitted, or past its server deadline — the DB
 * enforces the same, this just keeps the UI honest.
 *
 * CD-IELTS chrome: parts with a stimulus (passage / recording) render in a
 * resizable two-pane split (`ExamSplitPane`) so passage and questions scroll
 * independently; the timer announces the mode's warning thresholds through a
 * dismissable banner; Listening in exam mode locks earlier parts (audio plays
 * once); question numbers follow the official paper (a two-answer row is
 * "21–22" and the next row is 23).
 */
import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { Tables } from "@/types/supabase";
import type { IeltsResponseMap } from "@/lib/ielts/question-contract";
import type {
  SectionRuntimeStatus,
  SectionTimingState,
} from "@/lib/ielts/section-timing";
import type { MockStructure } from "@/lib/api/ielts/mock-repository";
import {
  assessmentModePolicy,
  type AssessmentMode,
} from "@/lib/ielts/assessment-mode";
import {
  assignQuestionNumbers,
  countQuestionNumbers,
} from "@/lib/ielts/question-groups";
import {
  type MockHighlightColor,
  type NoteAnchor,
  useMockAnnotationsStore,
} from "@/lib/stores/mockAnnotationsStore";
import { SectionReviewSheet } from "./SectionReviewSheet";
import { MockGuideDialog } from "./MockGuideDialog";
import { ExamNotesSheet } from "./ExamNotesSheet";
import { ExamSelectionPopup } from "./ExamSelectionPopup";
import { ExamSectionFooter, ExamSectionHeader } from "./exam/ExamChrome";
import { ExamPartNav } from "./exam/ExamPartNav";
import { ExamSplitPane } from "./exam/ExamSplitPane";
import { ExamStimulusPane, partHasStimulus } from "./exam/ExamStimulusPane";
import { ExamTimerBanner } from "./exam/ExamTimerBanner";
import { SectionPart } from "./MockSectionPart";
import { buildSectionParts, type MockPart } from "./mock-parts";
import {
  buildMockQuestionStatuses,
  summarizeMockQuestionStatuses,
} from "./mock-flow-status";

interface Props {
  section: Tables<"ielts_attempt_sections">;
  sections: Tables<"ielts_attempt_sections">[];
  structure: MockStructure;
  responses: IeltsResponseMap;
  busy: boolean;
  testTitle: string;
  assessmentMode: AssessmentMode;
  activeSectionIndex: number;
  onAnswer: (questionId: string, value: unknown) => void;
  onSwitchSection: (index: number) => void;
  onPause: () => void;
  onResume: () => void;
  onSubmitSection: () => void;
  onExpire: () => void;
  onFinish: () => void;
}

const QUESTION_PANE = "flex flex-col gap-4 px-3 py-4 sm:px-5 sm:py-5";

function activeQuestionForPart(
  part: MockPart | undefined,
  activeQuestionId: string | null,
): string | null {
  if (!part) return null;
  if (
    activeQuestionId &&
    part.questions.some((question) => question.id === activeQuestionId)
  ) {
    return activeQuestionId;
  }
  return part.questions[0]?.id ?? null;
}

function boundedPartIndex(partsLength: number, activePart: number): number {
  if (partsLength === 0) return -1;
  return Math.min(activePart, partsLength - 1);
}

export function MockSectionView({
  section,
  sections,
  structure,
  responses,
  busy,
  testTitle,
  assessmentMode,
  activeSectionIndex,
  onAnswer,
  onSwitchSection,
  onPause,
  onResume,
  onSubmitSection,
  onExpire,
  onFinish,
}: Props) {
  const t = useTranslations("ielts.player.exam");
  const [activePart, setActivePart] = useState(0);
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  const [pendingScrollQuestionId, setPendingScrollQuestionId] =
    useState<string | null>(null);
  const [pendingAnnotationAnchor, setPendingAnnotationAnchor] =
    useState<NoteAnchor | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [highlightMode, setHighlightMode] = useState(true);
  const [selectedHighlightColor, setSelectedHighlightColor] =
    useState<MockHighlightColor>("yellow");
  const [timerStatus, setTimerStatus] =
    useState<SectionRuntimeStatus>("not_started");
  const [activeWarning, setActiveWarning] = useState<number | null>(null);
  const [listeningPlaybackActive, setListeningPlaybackActive] = useState(false);
  const flags = useMockAnnotationsStore((store) => store.flags);
  const notes = useMockAnnotationsStore((store) => store.notes);
  const modePolicy = useMemo(() => assessmentModePolicy(assessmentMode), [assessmentMode]);

  const parts = useMemo(
    () => buildSectionParts(structure, section.skill, process.env.NEXT_PUBLIC_SUPABASE_URL),
    [structure, section.skill],
  );
  const numbers = useMemo(() => assignQuestionNumbers(parts), [parts]);
  const activePartIndex = boundedPartIndex(parts.length, activePart);
  const part = activePartIndex >= 0 ? parts[activePartIndex] : undefined;
  const sectionLabel = t(`skills.${section.skill}`);
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
      const target =
        pendingAnnotationAnchor.kind === "question"
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
  const hasStimulus = partHasStimulus(section.skill, part, parts);
  // Exam-mode Listening plays each recording once, so earlier parts are closed.
  const listeningLocked =
    section.skill === "listening" && !modePolicy.canReplayListeningAudio;

  // Global question number = numbers consumed by prior parts (spans included).
  const numberOffset =
    activePartIndex <= 0 ? 0 : countQuestionNumbers(parts.slice(0, activePartIndex));
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
    if (index < 0 || index >= parts.length) return;
    if (listeningLocked && index < activePartIndex) return;
    setActivePart(index);
    setActiveQuestionId(parts[index]?.questions[0]?.id ?? null);
  };

  const handleAudioEnded = (partIndex: number) => {
    if (activePartIndex !== partIndex || partIndex >= parts.length - 1) return;
    selectPart(partIndex + 1);
  };

  const jumpToQuestion = (partIndex: number, questionId: string) => {
    if (listeningLocked && partIndex < activePartIndex) return;
    setActivePart(partIndex);
    setActiveQuestionId(questionId);
    setPendingScrollQuestionId(questionId);
  };

  const isLastSection = activeSectionIndex === sections.length - 1;

  const questionPane = (
    <div className={QUESTION_PANE}>
      <ExamPartNav
        parts={parts}
        activePartIndex={activePartIndex}
        paused={paused}
        isPartLocked={(index) => listeningLocked && index !== activePartIndex}
        onSelectPart={selectPart}
      />
      {part ? (
        <SectionPart
          part={part}
          stimulus={null}
          hasStimulus={false}
          attemptId={section.attempt_id}
          assessmentMode={assessmentMode}
          numberOffset={numberOffset}
          disabled={disabled}
          responses={responses}
          onAnswer={onAnswer}
          onOpenNotes={(noteId) => openNotes(noteId)}
          numbers={numbers}
        />
      ) : (
        <p className="type-body-sm text-on-surface-variant">{t("noContent")}</p>
      )}
    </div>
  );

  return (
    <section className="flex h-dvh max-h-dvh min-h-0 flex-col bg-background text-on-surface">
      <ExamSectionHeader
        testTitle={testTitle}
        sectionLabel={sectionLabel}
        sections={sections}
        activeSectionIndex={activeSectionIndex}
        timing={timing}
        paused={paused}
        busy={busy}
        locked={locked}
        allowPause={modePolicy.canPause && section.skill !== "listening"}
        sectionNavigationLocked={
          listeningPlaybackActive ||
          (!modePolicy.canNavigateToSubmittedSection &&
            section.submitted_at === null)
        }
        guideOpen={guideOpen}
        warningSeconds={modePolicy.warningSeconds}
        onTimerStatusChange={setTimerStatus}
        onExpire={onExpire}
        onWarning={setActiveWarning}
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

      <ExamTimerBanner
        threshold={activeWarning}
        onDismiss={() => setActiveWarning(null)}
      />

      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {part && hasStimulus ? (
          <ExamSplitPane
            attemptId={section.attempt_id}
            leftLabel={part.title}
            rightLabel={t("questions")}
            left={
              <ExamStimulusPane
                skill={section.skill}
                part={part}
                parts={parts}
                activePartIndex={activePartIndex}
                attemptId={section.attempt_id}
                playbackBlocked={locked || paused}
                onPlaybackActiveChange={setListeningPlaybackActive}
                onAudioEnded={handleAudioEnded}
                onOpenNotes={(noteId) => openNotes(noteId)}
              />
            }
            right={questionPane}
          />
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain scroll-smooth">
            <div className="mx-auto w-full max-w-screen-2xl">{questionPane}</div>
          </div>
        )}
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
        previousLocked={listeningLocked}
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
              : candidate.questions.some(
                  (question) => question.id === anchor.questionId,
                ),
          );
          if (partIndex >= 0 && !(listeningLocked && partIndex < activePartIndex)) {
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
