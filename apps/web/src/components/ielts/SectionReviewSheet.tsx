"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  Bookmark,
  CheckCircle2,
  CircleAlert,
} from "@/components/ui/icons";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { MockQuestionCounts, MockQuestionStatus } from "./mock-flow-status";

const SUMMARY_CARD =
  "flex min-w-0 flex-1 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold";

function SummaryBadge({
  tone,
  icon,
  label,
  value,
}: {
  tone: "answered" | "unanswered" | "flagged";
  icon: ReactNode;
  label: string;
  value: string | number;
}) {
  const toneClass =
    tone === "answered"
      ? "border-success/30 bg-success-container text-on-success-container"
      : tone === "flagged"
        ? "border-warning/30 bg-warning-container text-on-warning-container"
        : "border-outline-variant bg-surface-container text-on-surface-variant";
  return (
    <div className={cn(SUMMARY_CARD, toneClass)}>
      {icon}
      <span className="truncate">{label}</span>
      <span className="ml-auto text-base">{value}</span>
    </div>
  );
}

function statusClass(status: MockQuestionStatus): string {
  if (status.flagged) {
    return "border-warning bg-warning-container/70 text-on-warning-container hover:bg-warning-container";
  }
  if (status.answered) {
    return "border-success/40 bg-success-container/70 text-on-success-container hover:bg-success-container";
  }
  return "border-dashed border-outline-variant bg-surface text-on-surface-variant hover:border-primary/50";
}

export function SectionReviewSheet({
  open,
  sectionLabel,
  statuses,
  counts,
  busy,
  onOpenChange,
  onJump,
  onConfirm,
}: {
  open: boolean;
  sectionLabel: string;
  statuses: MockQuestionStatus[];
  counts: MockQuestionCounts;
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onJump: (partIndex: number, questionId: string) => void;
  onConfirm: () => void;
}) {
  const reducedMotion = useReducedMotion();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="bottom-0 left-0 top-auto !z-[1000] flex max-h-[calc(100dvh-1rem)] w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-b-none rounded-t-xl border border-outline-variant bg-surface p-0 shadow-2xl sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:max-w-3xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl"
        overlayClassName="!z-[900] bg-inverse-surface/20"
        showCloseButton={false}
      >
        <DialogHeader className="border-b border-outline-variant px-4 py-4 sm:px-5">
          <DialogTitle className="text-base font-bold text-on-surface">
            Review {sectionLabel}
          </DialogTitle>
          <div className="grid gap-2 pt-2 sm:grid-cols-3">
            <SummaryBadge
              tone="answered"
              icon={<CheckCircle2 className="size-4" aria-hidden="true" />}
              label="Answered"
              value={`${counts.answered}/${counts.total}`}
            />
            <SummaryBadge
              tone="unanswered"
              icon={<CircleAlert className="size-4" aria-hidden="true" />}
              label="Unanswered"
              value={counts.unanswered}
            />
            <SummaryBadge
              tone="flagged"
              icon={<Bookmark className="size-4" aria-hidden="true" />}
              label="Flagged"
              value={counts.flagged}
            />
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          {statuses.length > 0 ? (
            <motion.div
              initial={reducedMotion ? undefined : "hidden"}
              animate="open"
              variants={{
                open: {
                  transition: { staggerChildren: reducedMotion ? 0 : 0.02 },
                },
              }}
              className="grid gap-2 sm:grid-cols-2"
            >
              {statuses.map((status) => (
                <motion.button
                  key={status.questionId}
                  type="button"
                  disabled={busy}
                  variants={
                    reducedMotion
                      ? undefined
                      : {
                          hidden: { opacity: 0, y: 6 },
                          open: { opacity: 1, y: 0 },
                        }
                  }
                  whileTap={reducedMotion ? undefined : { scale: 0.98 }}
                  onClick={() => {
                    onJump(status.partIndex, status.questionId);
                    onOpenChange(false);
                  }}
                  className={cn(
                    "flex min-h-16 items-center gap-3 rounded-lg border px-3 py-2 text-left transition disabled:cursor-not-allowed disabled:opacity-60",
                    statusClass(status),
                    status.current && "ring-2 ring-primary/40",
                  )}
                  aria-label={`Back to question ${status.number}, ${status.answered ? "answered" : "unanswered"}${status.flagged ? ", flagged" : ""}`}
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface text-sm font-bold text-on-surface">
                    {status.number}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-on-surface">
                      {status.partTitle}
                    </span>
                    <span className="mt-1 flex flex-wrap gap-1.5 text-xs font-semibold">
                      <span>{status.answered ? "Answered" : "No answer"}</span>
                      {status.flagged ? (
                        <span className="inline-flex items-center gap-1 text-warning">
                          <Bookmark className="size-3" aria-hidden="true" />
                          Flagged
                        </span>
                      ) : null}
                    </span>
                  </span>
                  <ArrowLeft className="size-4 shrink-0 text-on-surface-variant" aria-hidden="true" />
                </motion.button>
              ))}
            </motion.div>
          ) : (
            <p className="rounded-lg border border-dashed border-outline-variant bg-surface px-4 py-6 text-center text-sm text-on-surface-variant">
              This section has no questions to review.
            </p>
          )}
        </div>

        <DialogFooter className="mx-0 mb-0 rounded-none border-t border-outline-variant bg-surface px-4 py-3 sm:flex-row sm:px-5">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={busy}
            className="rounded-full bg-surface-container-high px-5 py-2 text-sm font-semibold text-on-surface transition hover:bg-surface-container disabled:opacity-50"
          >
            Keep working
          </button>
          <button
            type="button"
            onClick={() => {
              onOpenChange(false);
              onConfirm();
            }}
            disabled={busy || statuses.length === 0}
            className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-on-primary transition hover:bg-primary/90 disabled:opacity-50"
          >
            Confirm submit
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
