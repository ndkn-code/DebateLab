"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft, ChevronDown } from "@/components/ui/icons";
import { Link } from "@/i18n/navigation";
import { AnnotatedTranscript } from "@/components/feedback/annotated-transcript";
import {
  filterAnnotationsForRound,
  getRoundFilterId,
  getRoundSpeaker,
  getRoundText,
} from "@/lib/feedback/debate-review";
import type { DebateSession } from "@/types";
import type { TranscriptAnnotation } from "@/types/feedback";

interface SessionTranscriptPanelProps {
  session: DebateSession;
  annotations?: TranscriptAnnotation[] | null;
  backHref: string;
  backLabel: string;
  emptyLabel: string;
  suggestionLabel: string;
  unmatchedLabel: string;
  roundLabel: (roundNumber: number) => string;
}

export function SessionTranscriptPanel({
  session,
  annotations,
  backHref,
  backLabel,
  emptyLabel,
  suggestionLabel,
  unmatchedLabel,
  roundLabel,
}: SessionTranscriptPanelProps) {
  const t = useTranslations("sessionResult.annotations");
  const transcriptRounds = useMemo(
    () =>
      (session.rounds ?? []).filter((round) => getRoundText(round).trim().length > 0),
    [session.rounds]
  );
  const hasMultipleSpeechParts = transcriptRounds.length > 0;
  const [speechPart, setSpeechPart] = useState("all");

  const selectedRound =
    speechPart === "all"
      ? null
      : transcriptRounds.find((round) => getRoundFilterId(round) === speechPart) ??
        null;

  const selectedTranscript = selectedRound
    ? getRoundText(selectedRound)
    : hasMultipleSpeechParts
      ? transcriptRounds
          .map((round) => `${round.label}\n${getRoundText(round)}`)
          .join("\n\n")
      : session.transcript || "";
  const selectedAnnotations = selectedRound
    ? filterAnnotationsForRound(
        annotations,
        getRoundSpeaker(selectedRound),
        selectedRound.roundNumber
      )
    : annotations;
  const speechPartControl = hasMultipleSpeechParts ? (
    <label className="block">
      <span className="text-xs font-bold text-[#718096]">
        {t("speechPart")}
      </span>
      <div className="relative mt-1">
        <select
          value={speechPart}
          onInput={(event) => setSpeechPart(event.currentTarget.value)}
          onChange={(event) => setSpeechPart(event.target.value)}
          className="h-11 w-full appearance-none rounded-lg border border-[#DEE8F8] bg-white px-3 pr-9 text-sm font-semibold text-[#162033] outline-none focus:border-[#4D86F7]"
        >
          <option value="all">{t("allSpeechParts")}</option>
          {transcriptRounds.map((round) => (
            <option key={getRoundFilterId(round)} value={getRoundFilterId(round)}>
              {round.type === "ai-rebuttal" ? t("ai") : t("you")} · {round.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#718096]" />
      </div>
    </label>
  ) : undefined;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={backHref}
          className="inline-flex min-h-[44px] items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-[#0B185A] transition-colors hover:bg-white hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          {backLabel}
        </Link>
      </div>

      <AnnotatedTranscript
        transcript={selectedTranscript}
        annotations={selectedAnnotations}
        emptyLabel={emptyLabel}
        suggestionLabel={suggestionLabel}
        unmatchedLabel={unmatchedLabel}
        roundLabel={roundLabel}
        durationSeconds={
          selectedRound?.duration ?? (session.duration || session.speechTime)
        }
        showSpeakerControl={false}
        leadingControl={speechPartControl}
      />
    </div>
  );
}
