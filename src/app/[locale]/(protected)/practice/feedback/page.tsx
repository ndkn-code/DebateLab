"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { motion } from "framer-motion";
import { RotateCcw, Plus, History, Sparkles, Gift, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LottieAnimation } from "@/components/ui/lottie-animation";
import confettiAnimation from "../../../../../../public/lottie/confetti.json";
import { useSessionStore } from "@/store/session-store";
import { LoadingState } from "@/components/feedback/loading-state";
import { SessionResultDashboard } from "@/components/feedback/session-result-dashboard";
import { storage, supabaseStorage } from "@/lib/storage";
import { createClient } from "@/lib/supabase/client";
import { qualifyReferralAction, getReferralCodeAction } from "@/app/actions/referrals";
import type { DebateSession } from "@/types";
import type { DebateScore } from "@/types/feedback";

export default function FeedbackPage() {
  const router = useRouter();
  const t = useTranslations("sessionResult");
  const {
    selectedTopic,
    side,
    practiceTrack,
    mode,
    prepTime,
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
    setSide,
    setPracticeTrack,
    setMode,
    setPrepTime,
    setSpeechTime,
    setAiDifficulty,
    startSession: storeStartSession,
  } = useSessionStore();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setLocalFeedback] = useState<DebateScore | null>(
    storeFeedback
  );
  const [modelUsed, setModelUsed] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [referralCode, setReferralCode] = useState<string>("");
  const [linkCopied, setLinkCopied] = useState(false);
  const [savedSessionId, setSavedSessionId] = useState<string | null>(null);
  const [resultDate, setResultDate] = useState(() => new Date().toISOString());
  const [resultDuration, setResultDuration] = useState(() =>
    sessionStartTime ? Math.max(0, Math.round((Date.now() - sessionStartTime) / 1000)) : 0
  );
  const hasCalledApi = useRef(false);
  const hasSaved = useRef(false);

  const resolvedSide =
    side === "random"
      ? "proposition"
      : (side as "proposition" | "opposition");

  const isFullRound =
    practiceTrack === "debate" && mode === "full" && rounds.length > 0;

  const normalizeFeedback = useCallback(
    (data: DebateScore): DebateScore => ({
      ...data,
      practiceTrack: data.practiceTrack ?? practiceTrack,
    }),
    [practiceTrack]
  );

  const fetchFeedback = useCallback(async () => {
    if (!selectedTopic || !transcript) return;

    const actualDuration = sessionStartTime
      ? Math.round((Date.now() - sessionStartTime) / 1000)
      : 0;

    // Client-side timeout controller
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const speechType =
      practiceTrack === "speaking"
        ? "Speaking Practice"
        : isFullRound
          ? "Full Round Debate (5 rounds)"
          : mode === "full"
            ? "Opening Statement"
            : "Quick Debate Practice";

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          transcript,
          topic: selectedTopic.title,
          side: resolvedSide,
          practiceTrack,
          speechType,
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

      const normalizedFeedback = normalizeFeedback(data);
      setResultDuration(actualDuration);

      setLocalFeedback(normalizedFeedback);
      setFeedback(normalizedFeedback);
      setPhase("feedback");
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 3000);

      // Save session
      if (!hasSaved.current) {
        hasSaved.current = true;
        const sessionId = crypto.randomUUID();
        const sessionData = {
          id: sessionId,
          date: new Date().toISOString(),
          topic: selectedTopic,
          side: resolvedSide,
          practiceTrack,
          mode,
          prepTime,
          speechTime,
          transcript,
          feedback: normalizedFeedback,
          duration: actualDuration,
          prepNotes: useSessionStore.getState().prepNotes,
          aiDifficulty:
            practiceTrack === "debate" && mode === "full"
              ? aiDifficulty
              : undefined,
          rounds: isFullRound ? rounds : undefined,
        };
        setSavedSessionId(sessionId);
        setResultDate(sessionData.date);

        // Save to Supabase if authenticated, otherwise localStorage
        const supabase = createClient();
        const { data: authData } = await supabase.auth.getUser();
        if (authData.user) {
          supabaseStorage.saveSession(sessionData, authData.user.id);
          // Qualify referral if this is user's first real practice
          const wordCount = transcript.split(/\s+/).filter((w: string) => w.length > 0).length;
          qualifyReferralAction(wordCount).catch((error) => {
            console.error("Failed to qualify referral", error);
          });
        } else {
          storage.saveSession(sessionData);
        }
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
    practiceTrack,
    mode,
    prepTime,
    speechTime,
    sessionStartTime,
    setFeedback,
    setPhase,
    isFullRound,
    rounds,
    aiDifficulty,
    normalizeFeedback,
  ]);

  // Redirect if no session data
  useEffect(() => {
    if (!selectedTopic) {
      router.replace("/practice");
      return;
    }

    // If we already have feedback (e.g. from store), skip API call
    if (storeFeedback) {
      setLocalFeedback(normalizeFeedback(storeFeedback));
      if (resultDuration === 0 && sessionStartTime) {
        setResultDuration(Math.max(0, Math.round((Date.now() - sessionStartTime) / 1000)));
      }
      setLoading(false);
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 3000);
    } else if (!hasCalledApi.current) {
      hasCalledApi.current = true;
      fetchFeedback();
    }

    // Fetch referral code for share card
    getReferralCodeAction().then(setReferralCode).catch(() => {});
  }, [
    selectedTopic,
    storeFeedback,
    fetchFeedback,
    normalizeFeedback,
    resultDuration,
    router,
    sessionStartTime,
  ]);

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
    setPracticeTrack(practiceTrack);
    setSide(resolvedSide);
    setMode(mode);
    setPrepTime(prepTime);
    setSpeechTime(speechTime);
    if (practiceTrack === "debate" && mode === "full") {
      setAiDifficulty(aiDifficulty);
    }
    storeStartSession();
    router.push("/practice/session");
  };

  const handleNewTopic = () => {
    resetSession();
    router.push("/practice");
  };

  const feedbackPracticeTrack = feedback?.practiceTrack ?? practiceTrack;
  const isSpeakingTrack = feedbackPracticeTrack === "speaking";
  const selectedTopicTitle = selectedTopic?.title ?? "this topic";
  const coachPrompt = isSpeakingTrack
    ? `I just finished a speaking practice on "${selectedTopicTitle}" (${resolvedSide} side). I scored ${feedback?.totalScore ?? "N/A"}/100 (${feedback?.overallBand ?? "Unrated"}). Can you help me improve my clarity, structure, and delivery?`
    : `I just finished a debate on "${selectedTopicTitle}" (${resolvedSide} side, ${mode} mode). I scored ${feedback?.totalScore ?? "N/A"}/100 (${feedback?.overallBand ?? "Unrated"}). Can you help me analyze my stance, argument depth, weighing, and rebuttals?`;
  const resultSession = useMemo<DebateSession | null>(() => {
    if (!feedback || !selectedTopic) return null;

    return {
      id: savedSessionId ?? "current-session",
      date: resultDate,
      topic: selectedTopic,
      side: resolvedSide,
      practiceTrack,
      mode,
      prepTime,
      speechTime,
      transcript,
      feedback,
      duration: resultDuration,
      aiDifficulty:
        practiceTrack === "debate" && mode === "full"
          ? aiDifficulty
          : undefined,
      rounds: isFullRound ? rounds : undefined,
    };
  }, [
    aiDifficulty,
    feedback,
    isFullRound,
    mode,
    practiceTrack,
    prepTime,
    resolvedSide,
    resultDate,
    resultDuration,
    rounds,
    savedSessionId,
    selectedTopic,
    speechTime,
    transcript,
  ]);

  if (!selectedTopic) return null;

  return (
    <div className="min-h-screen bg-background">
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none z-50">
          <LottieAnimation
            animationData={confettiAnimation}
            loop={false}
            className="w-full h-full"
          />
        </div>
      )}
      <div className="py-2">
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
                {t("tryAgain")}
              </Button>
              <Button
                onClick={handleNewTopic}
                variant="outline"
                className="border-outline-variant/30 bg-surface-container-lowest text-on-surface-variant"
              >
                {t("backToTopics")}
              </Button>
            </div>
          </div>
        )}

        {/* Results */}
        {!loading && !error && resultSession && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="space-y-8"
          >
            <SessionResultDashboard
              session={resultSession}
              backHref="/practice"
              backLabel={t("backToPractice")}
              shareUrl={savedSessionId ? `/history/${savedSessionId}` : null}
              actionBar={
                <div className="flex flex-wrap gap-3">
                  <Button
                    onClick={handleRetrySameTopic}
                    className="min-h-[44px] rounded-2xl bg-primary px-5 text-white hover:bg-primary-dim"
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    {t("actions.practiceAgain")}
                  </Button>
                  <Button
                    onClick={handleNewTopic}
                    variant="outline"
                    className="min-h-[44px] rounded-2xl border-outline-variant/20 bg-surface px-5 text-on-surface"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    {t("actions.newTopic")}
                  </Button>
                  <Link href="/history">
                    <Button
                      variant="outline"
                      className="min-h-[44px] rounded-2xl border-outline-variant/20 bg-surface px-5 text-on-surface"
                    >
                      <History className="mr-2 h-4 w-4" />
                      {t("actions.viewHistory")}
                    </Button>
                  </Link>
                  <Link
                    href={`/chat?message=${encodeURIComponent(
                      coachPrompt
                    )}${savedSessionId ? `&context=practice-feedback&contextId=${savedSessionId}` : ""}`}
                  >
                    <Button
                      variant="outline"
                      className="min-h-[44px] rounded-2xl border-primary/25 bg-primary/5 px-5 text-primary hover:bg-primary/10"
                    >
                      <Sparkles className="mr-2 h-4 w-4" />
                      {t("actions.askCoach")}
                    </Button>
                  </Link>
                </div>
              }
              afterPanel={
                <>
                  {referralCode && feedback && (
                    <div className="mx-auto max-w-7xl rounded-[28px] border border-primary/20 bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 p-6">
                      <div className="flex flex-col items-center text-center">
                        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15">
                          <Gift className="h-6 w-6 text-primary" />
                        </div>
                        <h3 className="text-base font-bold text-on-surface">
                          {t("referral.title")}
                        </h3>
                        <p className="mt-1 text-sm text-on-surface-variant">
                          {t("referral.body", { score: feedback.totalScore })}
                        </p>
                        <button
                          onClick={async () => {
                            const link = `${window.location.origin}/join/${referralCode}`;
                            const shareText = t("referral.shareText", {
                              score: feedback.totalScore,
                              link,
                            });
                            if (navigator.share) {
                              try {
                                await navigator.share({
                                  title: t("referral.shareTitle"),
                                  text: shareText,
                                });
                              } catch {
                                // Ignore cancelled shares.
                              }
                            } else {
                              await navigator.clipboard.writeText(shareText);
                              setLinkCopied(true);
                              setTimeout(() => setLinkCopied(false), 2000);
                            }
                          }}
                          className="mt-4 flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-medium text-on-primary transition-colors hover:bg-primary/90"
                        >
                          {linkCopied ? (
                            <>
                              <Check className="h-4 w-4" />
                              {t("referral.copied")}
                            </>
                          ) : (
                            <>
                              <Copy className="h-4 w-4" />
                              {t("referral.cta")}
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  {modelUsed && (
                    <p className="text-center text-xs text-outline-variant">
                      {t("modelUsed", { model: modelUsed })}
                    </p>
                  )}
                </>
              }
            />
          </motion.div>
        )}
      </div>
    </div>
  );
}
