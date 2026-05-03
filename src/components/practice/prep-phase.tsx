"use client";

import {
  Clock3,
  FileText,
  Lightbulb,
  ListChecks,
  MessageCircle,
  Search,
} from "lucide-react";
import {
  MAX_NOTES_LENGTH,
  appendPlainTextBlockToRichNotes,
  PhasePill,
  PracticePanel,
  PracticeTimerDial,
  PrimaryActionButton,
  QuickNotesEditor,
} from "./practice-session-ui";
import { MotionInfoPanel } from "./motion-info-panel";
import type { DebateTopic, PracticeTrack } from "@/types";

const TOPIC_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "be",
  "completely",
  "does",
  "for",
  "good",
  "harm",
  "more",
  "should",
  "than",
  "the",
  "to",
]);

function getSuggestedPoints(
  topic: DebateTopic,
  side: "proposition" | "opposition"
) {
  const points =
    side === "proposition"
      ? topic.suggestedPoints?.proposition
      : topic.suggestedPoints?.opposition;

  return points?.filter(Boolean) ?? [];
}

function extractTopicTerms(title: string) {
  const words = title
    .split(/\s+/)
    .map((word) => word.replace(/[^a-zA-Z-]/g, "").toLowerCase())
    .filter((word) => word.length > 3 && !TOPIC_STOP_WORDS.has(word));

  return Array.from(new Set(words)).slice(0, 4);
}

function buildStarterBlock(
  kind: "terms" | "arguments" | "counterpoints" | "evidence",
  topic: DebateTopic,
  side: "proposition" | "opposition"
) {
  const ownPoints = getSuggestedPoints(topic, side);
  const opposingSide = side === "proposition" ? "opposition" : "proposition";
  const opposingPoints = getSuggestedPoints(topic, opposingSide);

  if (kind === "terms") {
    const terms = extractTopicTerms(topic.title);
    const starterTerms = terms.length > 0 ? terms : ["Key term", "Impact", "Scope"];

    return [
      "Key terms:",
      ...starterTerms.map((term) => `- ${term}: `),
    ].join("\n");
  }

  if (kind === "arguments") {
    const points =
      ownPoints.length > 0
        ? ownPoints.slice(0, 4)
        : [
            "Main claim:",
            "Why it matters:",
            "Best example:",
            "Closing line:",
          ];

    return ["Main arguments:", ...points.map((point) => `- ${point}`)].join(
      "\n"
    );
  }

  if (kind === "counterpoints") {
    const points =
      opposingPoints.length > 0
        ? opposingPoints.slice(0, 4)
        : [
            "What the other side will say:",
            "Why that claim is too broad:",
            "Example that weakens it:",
          ];

    return [
      "Counterpoints to answer:",
      ...points.map((point) => `- ${point}`),
    ].join("\n");
  }

  return [
    "Evidence to add:",
    "- Example:",
    "- Statistic or trend:",
    "- Real-world group affected:",
    "- Source or context:",
  ].join("\n");
}

interface PrepPhaseProps {
  topic: DebateTopic;
  side: "proposition" | "opposition";
  practiceTrack: PracticeTrack;
  aiHintsEnabled: boolean;
  timeLeft: number;
  totalTime: number;
  progress: number;
  isRunning: boolean;
  prepNotes: string;
  onNotesChange: (notes: string) => void;
  onSkip: () => void;
}

export function PrepPhase({
  topic,
  side,
  timeLeft,
  totalTime,
  progress,
  prepNotes,
  onNotesChange,
  onSkip,
}: PrepPhaseProps) {
  const helperActions = [
    { label: "Define key terms", icon: Search, kind: "terms" },
    { label: "List main arguments", icon: ListChecks, kind: "arguments" },
    {
      label: "Anticipate counterpoints",
      icon: MessageCircle,
      kind: "counterpoints",
    },
    { label: "Add evidence", icon: FileText, kind: "evidence" },
  ] as const;

  function appendStarterBlock(kind: (typeof helperActions)[number]["kind"]) {
    const block = buildStarterBlock(kind, topic, side);
    onNotesChange(
      appendPlainTextBlockToRichNotes(prepNotes, block, MAX_NOTES_LENGTH)
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1480px] flex-1 flex-col gap-4 px-5 py-4 sm:px-6 lg:px-8">
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <MotionInfoPanel topic={topic} side={side} />

        <PracticePanel className="overflow-hidden bg-gradient-to-b from-white via-white to-primary-container/35 p-4 shadow-[0_22px_72px_-54px_rgba(22,39,91,0.55)]">
          <div className="flex h-full flex-col items-center justify-center">
            <PhasePill icon={<Clock3 className="h-4 w-4" />}>
              Preparation Phase
            </PhasePill>

            <div className="mt-3">
              <PracticeTimerDial
                timeLeft={timeLeft}
                totalTime={totalTime}
                progress={progress}
                tone="blue"
                size="sm"
              />
            </div>

            <div className="mt-3 w-full rounded-lg border border-outline-variant/70 bg-surface-container-lowest/95 p-3 shadow-[0_18px_45px_-38px_rgba(22,39,91,0.45)]">
              <div className="flex items-center gap-2.5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary-container">
                  <Lightbulb className="h-5 w-5 text-primary" />
                </div>
                <p className="text-sm font-medium leading-6 text-on-surface-variant">
                  Use this time to plan a strong opening and organize your key points.
                </p>
              </div>
            </div>

            <PrimaryActionButton
              onClick={onSkip}
              className="mt-4 h-12 w-full min-w-0 rounded-lg text-sm shadow-[0_18px_32px_-18px_rgba(37,99,235,0.85)]"
            >
              Skip to Speaking
            </PrimaryActionButton>
          </div>
        </PracticePanel>
      </div>

      <div className="flex min-w-0 flex-col">
        <QuickNotesEditor
          value={prepNotes}
          onChange={onNotesChange}
          minHeightClassName="min-h-[150px]"
          className="p-5 sm:p-6"
          compact
          footer={
            <div>
              <p className="mb-2 text-sm font-medium text-on-surface-variant">
                Need a starting point?
              </p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {helperActions.map(({ label, icon: Icon, kind }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => appendStarterBlock(kind)}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-outline-variant/70 bg-surface-container px-3 text-sm font-medium text-on-surface-variant transition-colors hover:border-primary-fixed hover:bg-surface hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  >
                    <Icon className="h-4 w-4 text-primary" />
                    <span className="truncate">{label}</span>
                  </button>
                ))}
              </div>
            </div>
          }
        />
      </div>
    </div>
  );
}
