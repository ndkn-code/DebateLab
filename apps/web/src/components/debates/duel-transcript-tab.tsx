"use client";

import { Clock, FileText } from "@/components/ui/icons";
import type { DebateDuelRoomView, DebateDuelSpeech } from "@/types";
import { cn } from "@/lib/utils";

interface DuelTranscriptTabProps {
  room: DebateDuelRoomView;
}

function getSpeechLabel(speech: DebateDuelSpeech) {
  if (speech.roundNumber === 1) return "Proposition Opening";
  if (speech.roundNumber === 2) return "Opposition Opening";
  if (speech.roundNumber === 3) return "Proposition Rebuttal";
  return "Opposition Rebuttal";
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remaining = Math.max(0, seconds % 60);
  return `${minutes}:${String(remaining).padStart(2, "0")}`;
}

export function DuelTranscriptTab({ room }: DuelTranscriptTabProps) {
  const orderedSpeeches = [...room.speeches].sort(
    (left, right) => left.roundNumber - right.roundNumber
  );

  return (
    <section className="rounded-2xl border border-[#DEE8F8] bg-white p-5 shadow-[0_18px_45px_rgba(16,32,72,0.035)] sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-normal text-[#0B1424]">
            Debate Transcript
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#718096]">
            Full-round transcript review is ready for duel speeches. Quote-level
            duel annotations can layer into this tab next.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-lg border border-[#DEE8F8] bg-[#F7FAFE] px-3 py-2 text-sm font-bold text-[#415069]">
          <FileText className="h-4 w-4 text-[#4D86F7]" />
          {orderedSpeeches.length} speeches
        </div>
      </div>

      <div className="mt-5 grid gap-4">
        {orderedSpeeches.length > 0 ? (
          orderedSpeeches.map((speech) => (
            <article
              key={speech.id}
              className="rounded-xl border border-[#DEE8F8] bg-white p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "rounded-md px-2.5 py-1 text-xs font-bold uppercase tracking-[0.08em]",
                      speech.side === "proposition"
                        ? "bg-[#EAF9EF] text-[#168A45]"
                        : "bg-[#EAF1FF] text-[#245FD6]"
                    )}
                  >
                    {speech.side === "proposition" ? "Prop" : "Opp"}
                  </span>
                  <h3 className="text-base font-bold text-[#0B1424]">
                    {getSpeechLabel(speech)}
                  </h3>
                </div>
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#718096]">
                  <Clock className="h-4 w-4" />
                  {formatDuration(speech.durationSeconds)}
                </span>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[#30427A]">
                {speech.transcript || "No transcript was captured for this speech."}
              </p>
            </article>
          ))
        ) : (
          <div className="rounded-xl border border-[#DEE8F8] bg-[#F7FAFE] p-5 text-sm leading-6 text-[#415069]">
            No duel speeches were recorded for this result.
          </div>
        )}
      </div>
    </section>
  );
}

