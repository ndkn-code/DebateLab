"use client";

import {
  Clock3,
  FileText,
  Lightbulb,
  ListChecks,
  MessageCircle,
  Search,
  type LucideIcon,
} from "@/components/ui/icons";
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
import {
  buildPrepStarterBlock,
  type PrepStarterKind,
} from "@/lib/practice-prep-helpers";
import type { DebateTopic, PracticeTrack } from "@/types";

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
  const helperActions: Array<{
    label: string;
    icon: LucideIcon;
    kind: PrepStarterKind;
  }> = [
    { label: t("session.lock_burden"), icon: Search, kind: "burden" },
    { label: t("session.create_clash_axes"), icon: MessageCircle, kind: "clash" },
    {
      label: t("session.deepen_mechanism"),
      icon: ListChecks,
      kind: "mechanism",
    },
    { label: t("session.weigh_impacts"), icon: FileText, kind: "weighing" },
    { label: t("session.polish_style"), icon: Lightbulb, kind: "rhetoric" },
  ];

  function appendStarterBlock(kind: PrepStarterKind) {
    const block = buildPrepStarterBlock(kind, topic, side, locale);
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
              className="mt-3 h-10 w-full min-w-0 rounded-lg text-sm shadow-token-card"
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
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
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
