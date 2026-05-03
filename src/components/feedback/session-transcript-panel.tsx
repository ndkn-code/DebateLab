"use client";

import { ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { AnnotatedTranscript } from "@/components/feedback/annotated-transcript";
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
        <div className="max-w-full rounded-xl border border-[#DEE8F8] bg-white px-4 py-2 text-sm font-semibold text-[#415069]">
          <span className="block max-w-[58ch] truncate">
            {session.topic.title}
          </span>
        </div>
      </div>

      <AnnotatedTranscript
        transcript={session.transcript || ""}
        annotations={annotations}
        emptyLabel={emptyLabel}
        suggestionLabel={suggestionLabel}
        unmatchedLabel={unmatchedLabel}
        roundLabel={roundLabel}
        durationSeconds={session.duration || session.speechTime}
      />
    </div>
  );
}
