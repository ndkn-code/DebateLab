"use client";

import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  ArrowRight,
  Clock,
  Mic2,
  Lightbulb,
  Zap,
  Layers,
  Shuffle,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/store/session-store";
import type { DebateTopic } from "@/types";

interface SessionConfigProps {
  topic: DebateTopic;
  onClose: () => void;
}

function OptionButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "min-h-[44px] rounded-lg border px-3 py-2 text-sm font-medium transition-all",
        active
          ? "border-blue-500/50 bg-blue-500/10 text-blue-300"
          : "border-zinc-700 bg-zinc-800/50 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300"
      )}
    >
      {children}
    </button>
  );
}

export function SessionConfig({ topic, onClose }: SessionConfigProps) {
  const router = useRouter();
  const {
    side,
    mode,
    prepTime,
    speechTime,
    aiHints,
    setSide,
    setMode,
    setPrepTime,
    setSpeechTime,
    setAiHints,
    setTopic,
    startSession,
  } = useSessionStore();

  const handleBegin = () => {
    setTopic(topic);
    startSession();
    router.push("/practice/session");
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-2xl border-t border-zinc-800 bg-zinc-900/95 backdrop-blur-xl lg:absolute lg:inset-auto lg:right-0 lg:top-0 lg:h-full lg:w-[400px] lg:rounded-l-2xl lg:rounded-t-none lg:border-l lg:border-t-0"
      >
        <div className="p-6">
          {/* Header */}
          <div className="mb-6 flex items-start justify-between">
            <div className="flex-1 pr-4">
              <h3 className="text-lg font-bold text-white">
                Session Configuration
              </h3>
              <p className="mt-1 text-sm text-zinc-400 line-clamp-2">
                {topic.title}
              </p>
            </div>
            <button
              onClick={onClose}
              aria-label="Close session configuration"
              className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Mode */}
          <div className="mb-6">
            <label className="mb-2 flex items-center gap-2 text-sm font-medium text-zinc-300">
              <Layers className="h-4 w-4 text-blue-400" />
              Mode
            </label>
            <div className="grid grid-cols-2 gap-2">
              <OptionButton
                active={mode === "quick"}
                onClick={() => setMode("quick")}
              >
                <Zap className="mr-1.5 inline h-3.5 w-3.5" />
                Quick Practice
              </OptionButton>
              <OptionButton
                active={mode === "full"}
                onClick={() => setMode("full")}
              >
                <Layers className="mr-1.5 inline h-3.5 w-3.5" />
                Full Round
              </OptionButton>
            </div>
            <p className="mt-1.5 text-xs text-zinc-500">
              {mode === "quick"
                ? "One round of prep + speech"
                : "Opening + Closing statements"}
            </p>
          </div>

          {/* Side */}
          <div className="mb-6">
            <label className="mb-2 flex items-center gap-2 text-sm font-medium text-zinc-300">
              <Shuffle className="h-4 w-4 text-blue-400" />
              Your Side
            </label>
            <div className="grid grid-cols-3 gap-2">
              <OptionButton
                active={side === "random"}
                onClick={() => setSide("random")}
              >
                <Shuffle className="mr-1 inline h-3.5 w-3.5" />
                Random
              </OptionButton>
              <OptionButton
                active={side === "proposition"}
                onClick={() => setSide("proposition")}
              >
                <ThumbsUp className="mr-1 inline h-3.5 w-3.5" />
                For
              </OptionButton>
              <OptionButton
                active={side === "opposition"}
                onClick={() => setSide("opposition")}
              >
                <ThumbsDown className="mr-1 inline h-3.5 w-3.5" />
                Against
              </OptionButton>
            </div>
          </div>

          {/* Prep Time */}
          <div className="mb-6">
            <label className="mb-2 flex items-center gap-2 text-sm font-medium text-zinc-300">
              <Clock className="h-4 w-4 text-blue-400" />
              Prep Time
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[60, 120, 180].map((t) => (
                <OptionButton
                  key={t}
                  active={prepTime === t}
                  onClick={() => setPrepTime(t)}
                >
                  {t / 60} min
                </OptionButton>
              ))}
            </div>
          </div>

          {/* Speech Time */}
          <div className="mb-6">
            <label className="mb-2 flex items-center gap-2 text-sm font-medium text-zinc-300">
              <Mic2 className="h-4 w-4 text-blue-400" />
              Speech Time
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[120, 180, 240].map((t) => (
                <OptionButton
                  key={t}
                  active={speechTime === t}
                  onClick={() => setSpeechTime(t)}
                >
                  {t / 60} min
                </OptionButton>
              ))}
            </div>
          </div>

          {/* AI Hints */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm font-medium text-zinc-300">
                <Lightbulb className="h-4 w-4 text-blue-400" />
                AI Hints during prep
              </label>
              <button
                role="switch"
                aria-checked={aiHints}
                aria-label="Toggle AI hints during preparation"
                onClick={() => setAiHints(!aiHints)}
                className={cn(
                  "relative h-6 w-11 rounded-full transition-colors",
                  aiHints ? "bg-blue-500" : "bg-zinc-700"
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform",
                    aiHints && "translate-x-5"
                  )}
                />
              </button>
            </div>
            <p className="mt-1.5 text-xs text-zinc-500">
              Shows brainstorm hints during preparation time
            </p>
          </div>

          {/* Begin Button */}
          <Button
            onClick={handleBegin}
            className="w-full gap-2 bg-gradient-to-r from-blue-500 to-purple-600 py-6 text-base font-semibold text-white hover:from-blue-600 hover:to-purple-700"
          >
            Begin Session
            <ArrowRight className="h-5 w-5" />
          </Button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
