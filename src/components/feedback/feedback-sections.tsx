"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  AlertCircle,
  Lightbulb,
  FileText,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { DebateArgumentBreakdown, DebateScore } from "@/types/feedback";

interface SectionProps {
  title: string;
  icon: React.ElementType;
  accentColor: string;
  items: string[];
  defaultOpen?: boolean;
}

function FeedbackList({
  title,
  icon: Icon,
  accentColor,
  items,
  defaultOpen = true,
}: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-xl border border-outline-variant/10 bg-surface-container-lowest">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-3 p-4"
      >
        <Icon className={cn("h-5 w-5", accentColor)} />
        <span className="flex-1 text-left text-sm font-semibold text-on-surface">
          {title}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-on-surface-variant transition-transform",
            open && "rotate-180"
          )}
        />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <ul className="space-y-3 px-4 pb-4">
              {items.map((item, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="flex gap-3 text-sm"
                >
                  <span className={cn("mt-0.5 shrink-0", accentColor)}>
                    {i + 1}.
                  </span>
                  <span className="text-on-surface-variant">{item}</span>
                </motion.li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DebateCaseOverview({ feedback }: { feedback: DebateScore }) {
  const overviewLines = [
    feedback.caseSummary,
    feedback.stanceFeedback,
    feedback.weighingFeedback,
    feedback.clashFeedback,
  ].filter(Boolean) as string[];

  if (overviewLines.length === 0) return null;

  return (
    <div className="rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-4">
      <h3 className="text-sm font-semibold text-on-surface">Case Overview</h3>
      <div className="mt-3 space-y-3">
        {overviewLines.map((line, index) => (
          <p key={index} className="text-sm leading-relaxed text-on-surface-variant">
            {line}
          </p>
        ))}
      </div>
    </div>
  );
}

function DebateArgumentBreakdowns({
  items,
}: {
  items: DebateArgumentBreakdown[];
}) {
  if (items.length === 0) return null;

  return (
    <div className="rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-4">
      <h3 className="text-sm font-semibold text-on-surface">Argument Breakdown</h3>
      <div className="mt-3 space-y-3">
        {items.map((item, index) => (
          <div
            key={`${item.name}-${index}`}
            className="rounded-lg border border-outline-variant/10 bg-surface-container-low p-3"
          >
            <p className="text-sm font-medium text-on-surface">{item.name}</p>
            <div className="mt-2 space-y-2 text-sm text-on-surface-variant">
              <p>{item.summary}</p>
              <p>
                <span className="font-medium text-on-surface">What worked:</span>{" "}
                {item.whatWorked}
              </p>
              <p>
                <span className="font-medium text-on-surface">Missing layer:</span>{" "}
                {item.missingLayer}
              </p>
              <p>
                <span className="font-medium text-on-surface">Stronger rebuild:</span>{" "}
                {item.betterVersion}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface FeedbackSectionsProps {
  feedback: DebateScore;
  transcript: string;
}

export function FeedbackSections({
  feedback,
  transcript,
}: FeedbackSectionsProps) {
  const [showTranscript, setShowTranscript] = useState(false);
  const practiceTrack = feedback.practiceTrack ?? "debate";
  const isDebate = practiceTrack === "debate";
  const missingLayers =
    feedback.missingLayers && feedback.missingLayers.length > 0
      ? feedback.missingLayers
      : feedback.improvements;
  const strongerRebuilds =
    feedback.strongerRebuilds && feedback.strongerRebuilds.length > 0
      ? feedback.strongerRebuilds
      : feedback.sampleArguments;

  return (
    <div className="space-y-4">
      {isDebate && <DebateCaseOverview feedback={feedback} />}

      {isDebate && feedback.argumentBreakdowns && (
        <DebateArgumentBreakdowns items={feedback.argumentBreakdowns} />
      )}

      <FeedbackList
        title={isDebate ? "Debate Strengths" : "Strengths"}
        icon={CheckCircle2}
        accentColor="text-emerald-400"
        items={feedback.strengths}
      />

      <FeedbackList
        title={isDebate ? "What Is Missing" : "Areas to Improve"}
        icon={AlertCircle}
        accentColor="text-amber-400"
        items={missingLayers}
      />

      <FeedbackList
        title={isDebate ? "Stronger Rebuilds" : "Suggested Stronger Arguments"}
        icon={Lightbulb}
        accentColor="text-blue-400"
        items={strongerRebuilds}
        defaultOpen={false}
      />

      {/* Full Transcript */}
      <div className="rounded-xl border border-outline-variant/10 bg-surface-container-lowest">
        <button
          onClick={() => setShowTranscript(!showTranscript)}
          className="flex w-full items-center gap-3 p-4"
        >
          <FileText className="h-5 w-5 text-on-surface-variant" />
          <span className="flex-1 text-left text-sm font-semibold text-on-surface">
            Full Transcript
          </span>
          <ChevronDown
            className={cn(
              "h-4 w-4 text-on-surface-variant transition-transform",
              showTranscript && "rotate-180"
            )}
          />
        </button>
        <AnimatePresence>
          {showTranscript && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-4">
                <p className="whitespace-pre-wrap rounded-lg border border-outline-variant/10 bg-surface-container-low p-4 font-serif text-sm leading-relaxed text-on-surface">
                  {transcript || "No transcript recorded."}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
