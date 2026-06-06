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
    <section className="rounded-2xl border border-outline-variant bg-white p-5 shadow-token-card sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-normal text-on-surface">
            Debate Transcript
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-on-surface-variant">
            Full-round transcript review is ready for duel speeches. Quote-level
            duel annotations can layer into this tab next.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-lg border border-outline-variant bg-background px-3 py-2 text-sm font-bold text-on-surface-variant">
          <FileText className="h-4 w-4 text-primary" />
          {orderedSpeeches.length} speeches
        </div>
      </div>

      <div className="mt-5 grid gap-4">
        {orderedSpeeches.length > 0 ? (
          orderedSpeeches.map((speech) => (
            <article
              key={speech.id}
              className="rounded-xl border border-outline-variant bg-white p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "rounded-md px-2.5 py-1 text-xs font-bold uppercase tracking-[0.08em]",
                      speech.side === "proposition"
                        ? "bg-surface-container text-on-surface-variant"
                        : "bg-primary-container text-on-surface-variant"
                    )}
                  >
                    {speech.side === "proposition" ? "Prop" : "Opp"}
                  </span>
                  <h3 className="text-base font-bold text-on-surface">
                    {getSpeechLabel(speech)}
                  </h3>
                </div>
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-on-surface-variant">
                  <Clock className="h-4 w-4" />
                  {formatDuration(speech.durationSeconds)}
                </span>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-on-surface-variant">
                {speech.transcript || "No transcript was captured for this speech."}
              </p>
            </article>
          ))
        ) : (
          <div className="rounded-xl border border-outline-variant bg-background p-5 text-sm leading-6 text-on-surface-variant">
            No duel speeches were recorded for this result.
          </div>
        )}
      </div>
    </section>
  );
}

