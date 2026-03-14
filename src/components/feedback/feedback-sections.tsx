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
import type { DebateScore } from "@/types/feedback";

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
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-3 p-4"
      >
        <Icon className={cn("h-5 w-5", accentColor)} />
        <span className="flex-1 text-left text-sm font-semibold text-zinc-200">
          {title}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-zinc-500 transition-transform",
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
                  <span className="text-zinc-300">{item}</span>
                </motion.li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
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

  return (
    <div className="space-y-4">
      <FeedbackList
        title="Strengths"
        icon={CheckCircle2}
        accentColor="text-emerald-400"
        items={feedback.strengths}
      />

      <FeedbackList
        title="Areas to Improve"
        icon={AlertCircle}
        accentColor="text-amber-400"
        items={feedback.improvements}
      />

      <FeedbackList
        title="Suggested Stronger Arguments"
        icon={Lightbulb}
        accentColor="text-blue-400"
        items={feedback.sampleArguments}
        defaultOpen={false}
      />

      {/* Full Transcript */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50">
        <button
          onClick={() => setShowTranscript(!showTranscript)}
          className="flex w-full items-center gap-3 p-4"
        >
          <FileText className="h-5 w-5 text-zinc-400" />
          <span className="flex-1 text-left text-sm font-semibold text-zinc-200">
            Full Transcript
          </span>
          <ChevronDown
            className={cn(
              "h-4 w-4 text-zinc-500 transition-transform",
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
                <p className="whitespace-pre-wrap rounded-lg border border-zinc-800 bg-zinc-950/50 p-4 font-serif text-sm leading-relaxed text-zinc-300">
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
