"use client";

/**
 * Left pane of a review part: the passage / transcript with every located
 * answer wrapped in a `<mark id="ans-{questionId}">`, plus the Listening
 * replay above the transcript. Marks are produced by slicing the raw text
 * (`source-marks.ts`) and rendered as React children, never as HTML.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { AudioClipPlayer } from "@/components/ielts/exam/AudioClipPlayer";
import type {
  ObjectiveReviewPart,
  ObjectiveSkillKey,
} from "@/lib/ielts/results/types";
import { cn } from "@/lib/utils";
import { useReviewSourceController } from "./review-source-context";
import {
  buildSourceParagraphs,
  sourceMarkId,
  type SourceMark,
} from "./source-marks";

const FLASH_MS = 1600;

export function ReviewSourcePane({
  part,
  skill,
  partNumber,
}: {
  part: ObjectiveReviewPart;
  skill: ObjectiveSkillKey;
  partNumber: number;
}) {
  const t = useTranslations("ielts.results.review");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const markRefs = useRef(new Map<string, HTMLElement>());
  const { target } = useReviewSourceController();
  // The jump whose flash has already expired; the current target flashes
  // until its token is recorded here by the timeout below.
  const [expiredToken, setExpiredToken] = useState(0);
  const flashId = target && target.token !== expiredToken ? target.questionId : null;

  const marks = useMemo<SourceMark[]>(
    () =>
      part.items.flatMap((item) =>
        item.sourceRange
          ? [{ questionId: item.questionId, ...item.sourceRange }]
          : [],
      ),
    [part.items],
  );
  const paragraphs = useMemo(
    () => (part.sourceText ? buildSourceParagraphs(part.sourceText, marks) : []),
    [part.sourceText, marks],
  );
  const markers = useMemo(
    () =>
      part.items.flatMap((item) =>
        item.audioTimestamp !== null
          ? [{ seconds: item.audioTimestamp, label: item.numberLabel }]
          : [],
      ),
    [part.items],
  );

  useEffect(() => {
    if (!target) return;
    markRefs.current
      .get(target.questionId)
      ?.scrollIntoView({ block: "center", behavior: "smooth" });
    if (target.seconds !== null) {
      // The clip player owns its own state; a DOM seek keeps it in sync via
      // its `timeupdate` listener without needing an imperative handle.
      const audio = containerRef.current?.querySelector("audio");
      if (audio) {
        audio.currentTime = target.seconds;
        void audio.play().catch(() => {});
      }
    }
    const timer = window.setTimeout(() => setExpiredToken(target.token), FLASH_MS);
    return () => window.clearTimeout(timer);
  }, [target]);

  const kindLabel = skill === "listening" ? t("transcript") : t("passage");
  const partLabel =
    skill === "listening"
      ? t("partLabel", { number: partNumber })
      : t("passageLabel", { number: partNumber });

  return (
    <div ref={containerRef} className="flex flex-col gap-4 p-4 sm:p-5">
      <header className="flex flex-col gap-1">
        <p className="type-caption font-semibold uppercase text-on-surface-variant">
          {partLabel} · {kindLabel}
        </p>
        <h3 className="type-title text-on-surface">{part.title}</h3>
      </header>

      {part.audioUrl ? (
        <AudioClipPlayer
          src={part.audioUrl}
          title={t("playPart", { number: partNumber })}
          markers={markers}
        />
      ) : null}

      {paragraphs.length > 0 ? (
        <div className="flex flex-col gap-3">
          {paragraphs.map((paragraph) => (
            <p
              key={paragraph.start}
              className="whitespace-pre-wrap type-body text-on-surface"
            >
              {paragraph.segments.map((segment, index) =>
                segment.kind === "text" ? (
                  <span key={`${paragraph.start}-${index}`}>{segment.text}</span>
                ) : (
                  <mark
                    key={`${paragraph.start}-${index}`}
                    id={segment.first ? sourceMarkId(segment.questionId) : undefined}
                    ref={
                      segment.first
                        ? (node) => {
                            if (node) markRefs.current.set(segment.questionId, node);
                            else markRefs.current.delete(segment.questionId);
                          }
                        : undefined
                    }
                    data-question-id={segment.questionId}
                    className={cn(
                      "rounded-sm bg-primary-container px-0.5 text-on-primary-container transition-shadow",
                      flashId === segment.questionId && "ring-2 ring-primary",
                    )}
                  >
                    {segment.text}
                  </mark>
                ),
              )}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}
