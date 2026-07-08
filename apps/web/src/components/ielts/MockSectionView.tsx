"use client";

/**
 * The active timed section (WS-2.1): server-authoritative timer, pause/resume,
 * part navigation (passages / listening sections), stimulus, the question list
 * (rendered via the WS-1.2 contract), and section submit. Answers are disabled
 * once the section is paused, submitted, or past its server deadline — the DB
 * enforces the same, this just keeps the UI honest.
 */
import { useMemo, useState } from "react";
import type { Tables } from "@/types/supabase";
import type { IeltsResponseMap } from "@/lib/ielts/question-contract";
import type {
  SectionRuntimeStatus,
  SectionTimingState,
} from "@/lib/ielts/section-timing";
import type { MockStructure } from "@/lib/api/ielts/mock-repository";
import { SectionTimer } from "./SectionTimer";
import { ListeningAudioPlayer } from "./ListeningAudioPlayer";
import { QuestionHost } from "./QuestionHost";
import { PassageHighlighter } from "./PassageHighlighter";
import { buildSectionParts, type MockPart } from "./mock-parts";

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
  structure: MockStructure;
  responses: IeltsResponseMap;
  busy: boolean;
  onAnswer: (questionId: string, value: unknown) => void;
  onPause: () => void;
  onResume: () => void;
  onSubmitSection: () => void;
  onExpire: () => void;
}

const PILL = "rounded-full px-4 py-1.5 text-sm font-semibold";

export function MockSectionView({
  section,
  structure,
  responses,
  busy,
  onAnswer,
  onPause,
  onResume,
  onSubmitSection,
  onExpire,
}: Props) {
  const [activePart, setActivePart] = useState(0);
  const [timerStatus, setTimerStatus] = useState<SectionRuntimeStatus>("not_started");

  const parts = useMemo(
    () => buildSectionParts(structure, section.skill, process.env.NEXT_PUBLIC_SUPABASE_URL),
    [structure, section.skill],
  );
  const part = parts[Math.min(activePart, Math.max(0, parts.length - 1))];

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
  const numberOffset = parts
    .slice(0, parts.indexOf(part))
    .reduce((sum, p) => sum + p.questions.length, 0);

  return (
    <section className="flex flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-on-surface">{section.label ?? section.skill}</h2>
          <SectionTimer
            timing={timing}
            onExpire={onExpire}
            onStatusChange={setTimerStatus}
          />
        </div>
        <div className="flex items-center gap-2">
          {paused ? (
            <button
              type="button"
              onClick={onResume}
              disabled={busy || locked}
              className={`${PILL} bg-primary text-on-primary disabled:opacity-50`}
            >
              Resume
            </button>
          ) : (
            <button
              type="button"
              onClick={onPause}
              disabled={busy || locked}
              className={`${PILL} bg-surface-container-high text-on-surface disabled:opacity-50`}
            >
              Pause
            </button>
          )}
          <button
            type="button"
            onClick={onSubmitSection}
            disabled={busy || locked}
            className={`${PILL} bg-primary text-on-primary disabled:opacity-50`}
          >
            Submit section
          </button>
        </div>
      </header>

      {parts.length > 1 ? (
        <nav className="flex flex-wrap gap-2">
          {parts.map((candidate, index) => (
            <button
              key={candidate.id}
              type="button"
              onClick={() => setActivePart(index)}
              className={`${PILL} ${
                index === parts.indexOf(part)
                  ? "bg-primary text-on-primary"
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
    </section>
  );
}
