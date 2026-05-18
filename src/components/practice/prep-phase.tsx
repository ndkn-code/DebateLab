"use client";

import {
  Clock3,
  FileText,
  Lightbulb,
  ListChecks,
  MessageCircle,
  Search,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
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

const EN_TOPIC_STOP_WORDS = new Set([
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

const VI_TOPIC_STOP_WORDS = new Set([
  "ban",
  "cac",
  "cho",
  "cua",
  "gay",
  "hon",
  "khi",
  "la",
  "loi",
  "mot",
  "nen",
  "nhieu",
  "thi",
  "tren",
  "trong",
  "voi",
  "và",
  "các",
  "cho",
  "của",
  "gây",
  "hơn",
  "khi",
  "là",
  "lợi",
  "một",
  "nên",
  "nhiều",
  "thì",
  "trên",
  "trong",
  "với",
]);

const STARTER_BLOCK_COPY = {
  en: {
    keyTerms: "Key terms:",
    fallbackTerms: ["Key term", "Impact", "Scope"],
    mainArguments: "Main arguments:",
    argumentFallback: [
      "Main claim:",
      "Why it matters:",
      "Best example:",
      "Closing line:",
    ],
    counterpoints: "Counterpoints to answer:",
    counterpointFallback: [
      "What the other side will say:",
      "Why that claim is too broad:",
      "Example that weakens it:",
    ],
    evidence: [
      "Evidence to add:",
      "- Example:",
      "- Statistic or trend:",
      "- Real-world group affected:",
      "- Source or context:",
    ],
  },
  vi: {
    keyTerms: "Từ khóa:",
    fallbackTerms: ["Khái niệm", "Tác động", "Phạm vi"],
    mainArguments: "Luận điểm chính:",
    argumentFallback: [
      "Luận điểm trung tâm:",
      "Vì sao quan trọng:",
      "Ví dụ mạnh nhất:",
      "Câu chốt:",
    ],
    counterpoints: "Phản biện cần trả lời:",
    counterpointFallback: [
      "Đối phương sẽ nói:",
      "Vì sao lập luận đó quá rộng:",
      "Ví dụ làm yếu lập luận:",
    ],
    evidence: [
      "Dẫn chứng cần thêm:",
      "- Ví dụ:",
      "- Số liệu hoặc xu hướng:",
      "- Nhóm chịu ảnh hưởng:",
      "- Nguồn hoặc bối cảnh:",
    ],
  },
} as const;

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

function extractTopicTerms(title: string, locale: "en" | "vi") {
  const stopWords =
    locale === "vi" ? VI_TOPIC_STOP_WORDS : EN_TOPIC_STOP_WORDS;
  const minLength = locale === "vi" ? 2 : 3;
  const words = title
    .split(/\s+/)
    .map((word) => word.replace(/[^\p{L}\p{M}-]/gu, "").toLowerCase())
    .filter((word) => word.length > minLength && !stopWords.has(word));

  return Array.from(new Set(words)).slice(0, 4);
}

function buildStarterBlock(
  kind: "terms" | "arguments" | "counterpoints" | "evidence",
  topic: DebateTopic,
  side: "proposition" | "opposition",
  locale: "en" | "vi"
) {
  const copy = STARTER_BLOCK_COPY[locale];
  const ownPoints = getSuggestedPoints(topic, side);
  const opposingSide = side === "proposition" ? "opposition" : "proposition";
  const opposingPoints = getSuggestedPoints(topic, opposingSide);

  if (kind === "terms") {
    const terms = extractTopicTerms(topic.title, locale);
    const starterTerms = terms.length > 0 ? terms : copy.fallbackTerms;

    return [copy.keyTerms, ...starterTerms.map((term) => `- ${term}: `)].join(
      "\n"
    );
  }

  if (kind === "arguments") {
    const points =
      ownPoints.length > 0
        ? ownPoints.slice(0, 4)
        : copy.argumentFallback;

    return [copy.mainArguments, ...points.map((point) => `- ${point}`)].join(
      "\n"
    );
  }

  if (kind === "counterpoints") {
    const points =
      opposingPoints.length > 0
        ? opposingPoints.slice(0, 4)
        : copy.counterpointFallback;

    return [
      copy.counterpoints,
      ...points.map((point) => `- ${point}`),
    ].join("\n");
  }

  return copy.evidence.join("\n");
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
  const t = useTranslations("dashboard.practice");
  const locale = useLocale() === "vi" ? "vi" : "en";
  const helperActions = [
    { label: t("session.define_key_terms"), icon: Search, kind: "terms" },
    { label: t("session.list_main_arguments"), icon: ListChecks, kind: "arguments" },
    {
      label: t("session.anticipate_counterpoints"),
      icon: MessageCircle,
      kind: "counterpoints",
    },
    { label: t("session.add_evidence"), icon: FileText, kind: "evidence" },
  ] as const;

  function appendStarterBlock(kind: (typeof helperActions)[number]["kind"]) {
    const block = buildStarterBlock(kind, topic, side, locale);
    onNotesChange(
      appendPlainTextBlockToRichNotes(prepNotes, block, MAX_NOTES_LENGTH)
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-3 px-4 py-3 sm:px-5 lg:px-6">
      <div className="grid items-start gap-3 xl:grid-cols-[minmax(0,1fr)_296px]">
        <MotionInfoPanel topic={topic} side={side} />

        <PracticePanel className="overflow-hidden p-3">
          <div className="flex h-full flex-col items-center justify-center">
            <PhasePill icon={<Clock3 className="h-4 w-4" />}>
              {t("session.preparation_phase")}
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

            <div className="mt-3 w-full rounded-md border border-outline-variant/70 bg-surface-container-lowest/95 p-2.5">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary-container">
                  <Lightbulb className="h-4 w-4 text-primary" />
                </div>
                <p className="text-sm font-medium leading-5 text-on-surface-variant">
                  {t("session.prep_prompt")}
                </p>
              </div>
            </div>

            <PrimaryActionButton
              onClick={onSkip}
              className="mt-3 h-10 w-full min-w-0 rounded-lg text-sm shadow-[0_12px_24px_-18px_rgba(37,99,235,0.85)]"
            >
              {t("session.skip_to_speaking")}
            </PrimaryActionButton>
          </div>
        </PracticePanel>
      </div>

      <div className="flex min-w-0 flex-col">
        <QuickNotesEditor
          value={prepNotes}
          onChange={onNotesChange}
          minHeightClassName="min-h-[132px]"
          className="p-4"
          compact
          footer={
            <div>
              <p className="mb-2 text-sm font-medium text-on-surface-variant">
                {t("session.need_starting_point")}
              </p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {helperActions.map(({ label, icon: Icon, kind }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => appendStarterBlock(kind)}
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-outline-variant/70 bg-surface-container px-3 text-sm font-medium text-on-surface-variant transition-colors hover:border-primary-fixed hover:bg-surface hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
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
