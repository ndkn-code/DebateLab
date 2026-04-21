"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SkipForward, Lightbulb, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CountdownTimer } from "./countdown-timer";
import type { DebateTopic, PracticeTrack } from "@/types";

const MAX_NOTES_LENGTH = 1000;

interface HintCard {
  title: string;
  body: string[];
}

function buildHintCards(
  topic: DebateTopic,
  side: "proposition" | "opposition",
  practiceTrack: PracticeTrack
): { title: string; summary: string; cards: HintCard[] } | null {
  const rawHints =
    side === "proposition"
      ? topic.suggestedPoints?.proposition
      : topic.suggestedPoints?.opposition;

  if (!rawHints || rawHints.length === 0) return null;

  if (practiceTrack === "speaking") {
    return {
      title: "Speaking Hints",
      summary:
        "Use these as simple talking points. Focus on one clear message, one concrete example, and one clean ending.",
      cards: rawHints.slice(0, 3).map((hint, index) => ({
        title: `Idea ${index + 1}`,
        body: [
          hint,
          "Explain it in clear English with one concrete example or mini-scenario.",
          "Finish by restating why this point matters to your listener.",
        ],
      })),
    };
  }

  const otherSide = side === "proposition" ? "opposition" : "proposition";

  return {
    title: "Case Blueprint",
    summary:
      side === "proposition"
        ? "Win this debate by proving the motion creates bigger benefits than the best harms the opposition can defend."
        : "Win this debate by proving the motion fails to solve the problem or creates larger harms than the proposition can justify.",
    cards: rawHints.slice(0, 3).map((hint, index) => ({
      title: `Argument ${index + 1}`,
      body: [
        `Name: ${hint}`,
        "Mechanism: explain why this claim actually happens in the real world.",
        `Comparison: show why this matters more than the best ${otherSide} response.`,
        "Impact: tell the judge who is affected, why it matters, and how it links back to the motion.",
      ],
    })),
  };
}

interface PrepPhaseProps {
  topic: DebateTopic;
  side: "proposition" | "opposition";
  practiceTrack: PracticeTrack;
  aiHintsEnabled: boolean;
  timeLeft: number;
  totalTime: number;
  progress: number;
  isRunning: boolean;
  prepNotes: string;
  onNotesChange: (notes: string) => void;
  onSkip: () => void;
}

export function PrepPhase({
  topic,
  side,
  practiceTrack,
  aiHintsEnabled,
  timeLeft,
  totalTime,
  progress,
  isRunning,
  prepNotes,
  onNotesChange,
  onSkip,
}: PrepPhaseProps) {
  const [showHints, setShowHints] = useState(false);
  const hintContent = buildHintCards(topic, side, practiceTrack);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center gap-6 px-4 py-6">
      {/* Phase Label */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <span className="rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
          Preparation Phase
        </span>
      </motion.div>

      {/* Timer */}
      <CountdownTimer
        timeLeft={timeLeft}
        totalTime={totalTime}
        progress={progress}
        isRunning={isRunning}
      />

      {/* Notepad */}
      <div className="w-full">
        <div className="mb-2 flex items-center justify-between">
          <label htmlFor="prep-notes" className="text-sm font-medium text-on-surface-variant">
            Quick Notes
          </label>
          <span className="text-xs text-outline">
            {prepNotes.length}/{MAX_NOTES_LENGTH}
          </span>
        </div>
        <textarea
          id="prep-notes"
          value={prepNotes}
          onChange={(e) => {
            if (e.target.value.length <= MAX_NOTES_LENGTH) {
              onNotesChange(e.target.value);
            }
          }}
          placeholder="Jot down your key arguments..."
          rows={4}
          aria-label="Preparation notes"
          className="w-full resize-none rounded-xl border border-outline-variant/20 bg-surface-container-lowest px-4 py-3 text-sm text-on-surface placeholder-outline-variant outline-none transition-colors focus:border-primary/50 focus:ring-1 focus:ring-primary/30"
        />
      </div>

      {/* AI Hints */}
      {aiHintsEnabled && hintContent && (
        <div className="w-full">
          <button
            onClick={() => setShowHints(!showHints)}
            className="flex w-full items-center gap-2 rounded-xl border border-outline-variant/20 bg-surface-container-lowest px-4 py-3 text-sm text-on-surface-variant transition-colors hover:border-outline-variant/30 hover:text-on-surface-variant"
          >
            <Lightbulb className="h-4 w-4 text-amber-400" />
            <span className="flex-1 text-left font-medium">
              {showHints ? `Hide ${hintContent.title}` : `Show ${hintContent.title}`}
            </span>
            <ChevronDown
              className={`h-4 w-4 transition-transform ${showHints ? "rotate-180" : ""}`}
            />
          </button>
          <AnimatePresence>
            {showHints && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
              >
                <div className="mt-2 space-y-2 rounded-xl border border-amber-500/10 bg-amber-500/5 p-4">
                  <div className="rounded-lg border border-amber-500/10 bg-surface-container-lowest/60 p-3 text-sm text-on-surface-variant">
                    {hintContent.summary}
                  </div>
                  {hintContent.cards.map((card, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.15 }}
                      className="rounded-lg border border-amber-500/10 bg-surface-container-lowest/60 p-3"
                    >
                      <p className="text-sm font-medium text-on-surface">
                        {card.title}
                      </p>
                      <div className="mt-2 space-y-2">
                        {card.body.map((line, lineIndex) => (
                          <div key={lineIndex} className="flex gap-3 text-sm">
                            <span className="shrink-0 text-amber-400/60">
                              {lineIndex + 1}.
                            </span>
                            <span className="text-on-surface-variant">{line}</span>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Skip Button */}
      <Button
        onClick={onSkip}
        variant="ghost"
        className="gap-2 text-on-surface-variant hover:text-on-surface"
      >
        Skip to Speaking
        <SkipForward className="h-4 w-4" />
      </Button>
    </div>
  );
}
