"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, RotateCcw, Plus, History, MessageSquare } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useSessionStore } from "@/store/session-store";
import { LoadingState } from "@/components/feedback/loading-state";
import { ScoreHero } from "@/components/feedback/score-hero";
import { CategoryCards } from "@/components/feedback/category-cards";
import { FeedbackSections } from "@/components/feedback/feedback-sections";
import { DebateTimeline } from "@/components/feedback/debate-timeline";
import { storage } from "@/lib/storage";
import type { DebateScore } from "@/types/feedback";

export default function FeedbackPage() {
  const router = useRouter();
  const {
    selectedTopic,
    side,
    mode,
    speechTime,
    transcript,
    feedback: storeFeedback,
    sessionStartTime,
    rounds,
    aiDifficulty,
    setFeedback,
    setPhase,
    resetSession,
    setTopic,
    startSession: storeStartSession,
  } = useSessionStore();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setLocalFeedback] = useState<DebateScore | null>(
    storeFeedback
  );
  const [modelUsed, setModelUsed] = useState<string | null>(null);
  const hasCalledApi = useRef(false);
  const hasSaved = useRef(false);

  const resolvedSide =
    side === "random"
      ? "proposition"
      : (side as "proposition" | "opposition");

  const isFullRound = mode === "full" && rounds.length > 0;

  const fetchFeedback = useCallback(async () => {
    if (!selectedTopic || !transcript) return;

    const actualDuration = sessionStartTime
      ? Math.round((Date.now() - sessionStartTime) / 1000)
      : 0;

    // Client-side timeout controller
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          transcript,
          topic: selectedTopic.title,
          side: resolvedSide,
          speechType: isFullRound
            ? "Full Round Debate (5 rounds)"
            : mode === "full"
              ? "Opening Statement"
              : "Quick Practice",
          timeLimit: speechTime / 60,
          actualDuration,
          isFullRound,
          rounds: isFullRound ? rounds : undefined,
        }),
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        let errorMessage = `Server error (${res.status})`;
        try {
          const data = (await res.json()) as { error?: string };
          if (data.error) errorMessage = data.error;
        } catch {
          // Response wasn't JSON
        }
        throw new Error(errorMessage);
      }

      const responseText = await res.text();
      console.log("API response:", responseText.substring(0, 200));

      let data: DebateScore & { _model?: string };
      try {
        data = JSON.parse(responseText) as DebateScore & { _model?: string };
      } catch {
        console.error("Failed to parse response as JSON:", responseText.substring(0, 500));
        throw new Error("Received invalid response from server. Please try again.");
      }

      if (data._model) {
        setModelUsed(data._model);
        delete data._model;
      }

      setLocalFeedback(data);
      setFeedback(data);
      setPhase("feedback");

      // Save to localStorage
      if (!hasSaved.current) {
        hasSaved.current = true;
        storage.saveSession({
          id: crypto.randomUUID(),
          date: new Date().toISOString(),
          topic: selectedTopic,
          side: resolvedSide,
          mode,
          prepTime: useSessionStore.getState().prepTime,
          speechTime,
          transcript,
          feedback: data,
          duration: actualDuration,
          prepNotes: useSessionStore.getState().prepNotes,
          aiDifficulty: isFullRound ? aiDifficulty : undefined,
          rounds: isFullRound ? rounds : undefined,
        });
      }
    } catch (err) {
      clearTimeout(timeoutId);

      if (err instanceof DOMException && err.name === "AbortError") {
        setError("Analysis timed out after 30 seconds. Please try again.");
      } else {
        setError(
          err instanceof Error ? err.message : "Failed to analyze speech"
        );
      }
    } finally {
      setLoading(false);
    }
  }, [
    selectedTopic,
    transcript,
    resolvedSide,
    mode,
    speechTime,
    sessionStartTime,
    setFeedback,
    setPhase,
    isFullRound,
    rounds,
    aiDifficulty,
  ]);

  // Redirect if no session data
  useEffect(() => {
    if (!selectedTopic) {
      router.replace("/practice");
      return;
    }

    // If we already have feedback (e.g. from store), skip API call
    if (storeFeedback) {
      setLocalFeedback(storeFeedback);
      setLoading(false);
      return;
    }

    // Call API once
    if (!hasCalledApi.current) {
      hasCalledApi.current = true;
      fetchFeedback();
    }
  }, [selectedTopic, storeFeedback, fetchFeedback, router]);

  const handleRetry = useCallback(() => {
    setError(null);
    setLoading(true);
    hasCalledApi.current = false;
    hasSaved.current = false;
    fetchFeedback();
  }, [fetchFeedback]);

  const handleRetrySameTopic = () => {
    const topic = selectedTopic;
    if (!topic) return;
    resetSession();
    setTopic(topic);
    storeStartSession();
    router.push("/practice/session");
  };

  const handleNewTopic = () => {
    resetSession();
    router.push("/practice");
  };

  if (!selectedTopic) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-outline-variant/10 glass-nav backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-4xl items-center gap-4 px-4 sm:px-6">
          <Link
            href="/practice"
            className="flex items-center gap-2 text-on-surface-variant transition-colors hover:text-on-surface"
          >
            <ArrowLeft className="h-4 w-4" />
            <MessageSquare className="h-5 w-5 text-primary" />
            <span className="font-semibold text-on-surface">DebateLab</span>
          </Link>
          <span className="ml-auto hidden truncate text-xs text-on-surface-variant sm:block">
            {selectedTopic.title}
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        {/* Loading */}
        {loading && !error && <LoadingState />}

        {/* Error */}
        {error && (
          <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-6 py-4 text-center">
              <p className="text-sm text-red-400">{error}</p>
            </div>
            <div className="flex gap-3">
              <Button
                onClick={handleRetry}
                className="gap-2 bg-primary text-white"
              >
                <RotateCcw className="h-4 w-4" />
                Try Again
              </Button>
              <Button
                onClick={handleNewTopic}
                variant="outline"
                className="border-outline-variant/30 bg-surface-container-lowest text-on-surface-variant"
              >
                Back to Topics
              </Button>
            </div>
          </div>
        )}

        {/* Results */}
        {!loading && !error && feedback && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="space-y-8"
          >
            {/* Full Round badge */}
            {isFullRound && (
              <div className="flex items-center justify-center gap-2">
                <span className="rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
                  Full Round Debate
                </span>
                <span className="rounded-full bg-surface-container-high px-3 py-1 text-xs capitalize text-on-surface-variant">
                  {aiDifficulty} AI
                </span>
              </div>
            )}

            {/* Score Hero */}
            <ScoreHero feedback={feedback} />

            {/* Category Cards */}
            <div>
              <h2 className="mb-4 text-lg font-semibold text-on-surface">
                Category Breakdown
              </h2>
              <CategoryCards feedback={feedback} />
            </div>

            {/* Debate Timeline (Full Round only) */}
            {isFullRound && rounds.length > 0 && (
              <DebateTimeline rounds={rounds} />
            )}

            {/* Feedback Sections */}
            <FeedbackSections feedback={feedback} transcript={transcript} />

            {/* Model indicator */}
            {modelUsed && (
              <p className="text-center text-xs text-outline-variant">
                Analyzed with {modelUsed}
              </p>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col gap-3 border-t border-outline-variant/10 pt-8 sm:flex-row sm:justify-center">
              <Button
                onClick={handleRetrySameTopic}
                className="gap-2 bg-primary text-white hover:bg-primary-dim"
              >
                <RotateCcw className="h-4 w-4" />
                Try Same Topic
              </Button>
              <Button
                onClick={handleNewTopic}
                variant="outline"
                className="gap-2 border-outline-variant/30 bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
              >
                <Plus className="h-4 w-4" />
                New Topic
              </Button>
              <Link href="/history">
                <Button
                  variant="outline"
                  className="w-full gap-2 border-outline-variant/30 bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface sm:w-auto"
                >
                  <History className="h-4 w-4" />
                  View History
                </Button>
              </Link>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
