"use client";

/**
 * Left pane of the CD-IELTS split: the reading passage (highlightable) or the
 * listening recording deck. Uses the same building blocks MockSectionPart
 * used to render inline, so annotations, notes, and one-shot playback keep
 * working — only the placement changed.
 */
import type { MockPart } from "../mock-parts";
import { ListeningStimulusDeck } from "../ListeningStimulusDeck";
import { PassageHighlighter } from "../PassageHighlighter";

export interface ExamStimulusPaneProps {
  skill: string;
  part: MockPart;
  parts: MockPart[];
  activePartIndex: number;
  attemptId: string;
  playbackBlocked: boolean;
  onPlaybackActiveChange: (active: boolean) => void;
  onAudioEnded: (partIndex: number) => void;
  onOpenNotes: (noteId: string) => void;
}

/** Whether this part needs the two-pane layout at all. */
export function partHasStimulus(skill: string, part: MockPart | undefined, parts: MockPart[]) {
  if (!part) return false;
  if (part.body !== null) return true;
  return skill === "listening" && parts.some((item) => item.audio.length > 0);
}

export function ExamStimulusPane({
  skill,
  part,
  parts,
  activePartIndex,
  attemptId,
  playbackBlocked,
  onPlaybackActiveChange,
  onAudioEnded,
  onOpenNotes,
}: ExamStimulusPaneProps) {
  return (
    <div className="flex flex-col gap-4 px-3 py-4 sm:px-5 sm:py-5">
      {skill === "listening" ? (
        <ListeningStimulusDeck
          parts={parts}
          activePartIndex={activePartIndex}
          attemptId={attemptId}
          playbackBlocked={playbackBlocked}
          onPlaybackActiveChange={onPlaybackActiveChange}
          onAudioEnded={onAudioEnded}
        />
      ) : part.body !== null ? (
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
