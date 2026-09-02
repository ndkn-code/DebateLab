"use client";

/**
 * Header of the questions pane: part pills (Passage 1/2/3, Section 1–4) and
 * the paused notice. Lives above the question list so both panes of the split
 * fill the full height.
 */
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { MockPart } from "../mock-parts";

export interface ExamPartNavProps {
  parts: MockPart[];
  activePartIndex: number;
  paused: boolean;
  /** Part index → whether the pill is disabled (listening lock, etc.). */
  isPartLocked: (index: number) => boolean;
  onSelectPart: (index: number) => void;
}

export function ExamPartNav({
  parts,
  activePartIndex,
  paused,
  isPartLocked,
  onSelectPart,
}: ExamPartNavProps) {
  const t = useTranslations("ielts.player.exam");
  if (parts.length <= 1 && !paused) return null;

  return (
    <div className="flex flex-col gap-3">
      {parts.length > 1 ? (
        <nav
          className="flex gap-2 overflow-x-auto px-0.5 py-1"
          aria-label={t("sectionParts")}
        >
          {parts.map((candidate, index) => (
            <button
              key={candidate.id}
              type="button"
              onClick={() => onSelectPart(index)}
              disabled={isPartLocked(index)}
              aria-current={index === activePartIndex ? "step" : undefined}
              className={cn(
                "min-h-10 shrink-0 rounded-full px-4 py-1.5 type-label font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
                index === activePartIndex
                  ? "bg-secondary text-on-secondary"
                  : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high",
              )}
            >
              {candidate.title}
            </button>
          ))}
        </nav>
      ) : null}
      {paused ? (
        <p
          role="status"
          className="rounded-xl bg-error-container px-4 py-3 type-label font-medium text-error"
        >
          {t("pausedBody")}
        </p>
      ) : null}
    </div>
  );
}
