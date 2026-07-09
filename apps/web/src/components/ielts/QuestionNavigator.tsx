"use client";

import { useMemo, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  Bookmark,
  CheckCircle2,
  CircleAlert,
  LayoutGrid,
  MapPin,
} from "@/components/ui/icons";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { MockQuestionCounts, MockQuestionStatus } from "./mock-flow-status";

const CHIP =
  "relative flex size-11 items-center justify-center rounded-lg border-2 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 sm:size-12";

function chipClass(status: MockQuestionStatus): string {
  if (status.current) return "border-primary bg-primary text-on-primary";
  if (status.flagged) {
    return "border-warning bg-warning-container text-on-warning-container hover:bg-warning-container/80";
  }
  if (status.answered) {
    return "border-success bg-success-container text-on-success-container hover:bg-success-container/80";
  }
  return "border-dashed border-outline-variant bg-surface text-on-surface-variant hover:border-primary/50 hover:text-on-surface";
}

function LegendItem({
  icon,
  label,
}: {
  icon: ReactNode;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium text-on-surface-variant">
      {icon}
      {label}
    </span>
  );
}

export function QuestionNavigator({
  sectionLabel,
  statuses,
  counts,
  onJump,
}: {
  sectionLabel: string;
  statuses: MockQuestionStatus[];
  counts: MockQuestionCounts;
  onJump: (partIndex: number, questionId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const reducedMotion = useReducedMotion();
  const gridVariants = useMemo(
    () => ({
      open: {
        transition: {
          staggerChildren: reducedMotion ? 0 : 0.025,
        },
      },
    }),
    [reducedMotion],
  );
  const chipVariants = reducedMotion
    ? undefined
    : {
        hidden: { opacity: 0, y: 6 },
        open: { opacity: 1, y: 0 },
      };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-full bg-surface-container-high px-4 py-1.5 text-sm font-semibold text-on-surface transition hover:bg-surface-container disabled:opacity-50"
        aria-label={`Open question navigator: ${counts.answered} of ${counts.total} answered`}
      >
        <LayoutGrid className="size-4" aria-hidden="true" />
        <span>
          {counts.answered}/{counts.total}
        </span>
      </button>

      <DialogContent
        className="!z-[1000] max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-3xl overflow-hidden rounded-xl border border-outline-variant bg-surface p-0 shadow-2xl sm:max-w-2xl md:max-w-3xl"
        overlayClassName="!z-[900] bg-inverse-surface/20"
      >
        <DialogHeader className="border-b border-outline-variant px-4 py-4 sm:px-5">
          <DialogTitle className="text-base font-bold text-on-surface">
            {sectionLabel}
          </DialogTitle>
          <div className="flex flex-wrap gap-x-4 gap-y-2 pt-1">
            <LegendItem
              icon={<MapPin className="size-3.5 text-primary" aria-hidden="true" />}
              label="Current"
            />
            <LegendItem
              icon={<CheckCircle2 className="size-3.5 text-success" aria-hidden="true" />}
              label="Answered"
            />
            <LegendItem
              icon={<CircleAlert className="size-3.5 text-on-surface-variant" aria-hidden="true" />}
              label="Unanswered"
            />
            <LegendItem
              icon={<Bookmark className="size-3.5 text-warning" aria-hidden="true" />}
              label="Flagged"
            />
          </div>
        </DialogHeader>

        <div className="min-h-0 overflow-y-auto px-4 py-4 sm:px-5">
          <motion.div
            variants={gridVariants}
            initial={reducedMotion ? undefined : "hidden"}
            animate="open"
            className="grid grid-cols-5 gap-2 sm:grid-cols-8 md:grid-cols-10"
          >
            {statuses.map((status) => (
              <motion.button
                key={status.questionId}
                type="button"
                variants={chipVariants}
                whileTap={reducedMotion ? undefined : { scale: 0.94 }}
                onClick={() => {
                  onJump(status.partIndex, status.questionId);
                  setOpen(false);
                }}
                className={cn(CHIP, chipClass(status))}
                aria-current={status.current ? "true" : undefined}
                aria-label={`Question ${status.number}, ${status.answered ? "answered" : "unanswered"}${status.flagged ? ", flagged" : ""}, ${status.partTitle}`}
              >
                {status.number}
                {status.current ? (
                  <MapPin
                    className="absolute -right-1.5 -top-1.5 size-4 rounded-full bg-surface text-primary"
                    aria-hidden="true"
                  />
                ) : null}
                {status.flagged ? (
                  <Bookmark
                    className="absolute -left-1.5 -top-1.5 size-4 rounded-full bg-surface text-warning"
                    aria-hidden="true"
                  />
                ) : null}
              </motion.button>
            ))}
          </motion.div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
