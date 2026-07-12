"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { AnimatePresence } from "framer-motion";
import { useSessionStore, FULL_ROUND_STRUCTURE } from "@/store/session-store";
import {
  DEFAULT_VOICE,
  coerceVoiceForLanguage,
} from "@/lib/tts-voices";
import { getMotionBrief } from "@/lib/motion-brief";
import { normalizeRebuttalText } from "@/lib/rebuttal/structured-response";
import { createClient } from "@/lib/supabase/client";
import { useCountdown } from "@/hooks/use-countdown";
import { useDeepgramTranscription } from "@/hooks/use-deepgram-transcription";
import { useAudioRecorder } from "@/hooks/use-audio-recorder";
import { usePracticeSessionDraft } from "@/hooks/use-practice-session-draft";
import { useTtsAutoplayUnlock } from "@/hooks/use-tts";
import { SessionTopBar } from "@/components/practice/session-top-bar";
import { MicCheck } from "@/components/practice/mic-check";
import { AudioCheck } from "@/components/practice/audio-check";
import { PrepPhase } from "@/components/practice/prep-phase";
import { SpeakingPhase } from "@/components/practice/speaking-phase";
import { AiRebuttalPhase } from "@/components/practice/ai-rebuttal-phase";
import { RoundProgress } from "@/components/practice/round-progress";
import { TransitionOverlay } from "@/components/practice/transition-overlay";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { StudentRouteSkeleton } from "@/components/shared/student-route-skeleton";
import { showToast } from "@/components/shared/toast";
import { Button } from "@/components/ui/button";
import { AlertCircle, ArrowLeft } from "@/components/ui/icons";
import { trackAnalyticsEvent } from "@/lib/hooks/useAnalyticsEventTracker";
import type { AiHighlight } from "@/types";

function MissingSessionState({ onBack }: { onBack: () => void }) {
  const t = useTranslations("dashboard.practice");

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-outline-variant/30 bg-surface-container-lowest p-6 text-center shadow-token-card">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary-container text-primary">
          <AlertCircle className="h-6 w-6" />
        </div>
        <h1 className="mt-5 type-heading-md font-extrabold text-on-surface">
          {t("session.setup_expired_title")}
        </h1>
        <p className="mt-2 text-sm leading-6 text-on-surface-variant">
          {t("session.setup_expired_body")}
        </p>
        <Button onClick={onBack} className="mt-6 h-11 w-full gap-2 rounded-2xl">
          <ArrowLeft className="h-4 w-4" />
          {t("session.return_to_practice")}
        </Button>
      </div>
    </div>
  );
}

export default function SessionPage() {
  const router = useRouter();
  const t = useTranslations("dashboard.practice");
  const {
    selectedTopic,
    side,
    practiceTrack,
    practiceLanguage,
    mode,
    prepTime,
    speechTime,
    aiHints,
    aiDifficulty,
    currentPhase,
    prepNotes,
    debateMemory,
    currentRound,
    rounds,
    setPhase,
    setPrepNotes,
    setTranscript,
    setAudioBlob,
    setAudioUrl,
    saveRoundTranscript,
    saveAiRebuttal,
    advanceToNextRound,
    getAllTranscripts,
  } = useSessionStore();

  const [showTransition, setShowTransition] = useState(false);
  const [transitionMessage, setTransitionMessage] = useState("");
  const [transitionSub, setTransitionSub] = useState("");
  const [isPaused, setIsPaused] = useState(false);
  const [isFinalizingSpeech, setIsFinalizingSpeech] = useState(false);
  const [showShortDialog, setShowShortDialog] = useState(false);
  const [shortWordCount, setShortWordCount] = useState(0);
  const [audioChecked, setAudioChecked] = useState(false);
  const [ttsVoice, setTtsVoice] = useState(DEFAULT_VOICE);
  const hasStartedRef = useRef(false);
  const hasEndedRef = useRef(false);
  const lastFinalizedTranscriptRef = useRef("");
  const hasTrackedMissingSessionRef = useRef(false);
  const roundSpeechStartRef = useRef<number>(0);
  const transitionTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const { isRestoringDraft } = usePracticeSessionDraft();

  // Mic stream ref — obtained from mic check, reused throughout session
  const micStreamRef = useRef<MediaStream | null>(null);
  const [micStream, setMicStream] = useState<MediaStream | null>(null);

  const prepTimer = useCountdown(prepTime);
  const speechTimer = useCountdown(speechTime);
  const sttContext = useMemo(
    () => ({
      practiceLanguage,
      topic: selectedTopic?.title,
      side,
      motionBrief: selectedTopic
        ? getMotionBrief(selectedTopic, practiceLanguage)
        : null,
      prepNotes,
    }),
    [practiceLanguage, prepNotes, selectedTopic, side]
  );
  const speech = useDeepgramTranscription(practiceLanguage, sttContext);
  const audio = useAudioRecorder();
  useTtsAutoplayUnlock();

  const isFullRound = practiceTrack === "debate" && mode === "full";
  const totalRounds = isFullRound ? FULL_ROUND_STRUCTURE.length : 1;
  const currentRoundInfo = isFullRound
    ? rounds.find((r) => r.roundNumber === currentRound)
    : undefined;

  const getRoundLabel = useCallback(
    (label: string) => {
      if (label === "Opening Statement") return t("session.round_opening");
      if (label === "AI Rebuttal") return t("session.round_ai_rebuttal");
      if (label === "Counter-Rebuttal") {
        return t("session.round_counter_rebuttal");
      }
      if (label === "AI Closing") return t("session.round_ai_closing");
      if (label === "Closing Statement") return t("session.round_closing");
      return label;
    },
    [t]
  );

  // Load TTS voice preference
  useEffect(() => {
    const loadVoice = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase.from('profiles').select('preferences').eq('id', user.id).single();
        const prefs = data?.preferences as Record<string, unknown> | null;
        setTtsVoice(coerceVoiceForLanguage(prefs?.tts_voice, practiceLanguage));
      } else {
        setTtsVoice(coerceVoiceForLanguage(DEFAULT_VOICE, practiceLanguage));
      }
    };
    loadVoice();
  }, [practiceLanguage]);

  useEffect(() => {
    if (
      isRestoringDraft ||
      selectedTopic ||
      hasTrackedMissingSessionRef.current
    ) {
      return;
    }
    hasTrackedMissingSessionRef.current = true;
    trackAnalyticsEvent({
      eventName: "practice_session_handoff_missing",
      featureArea: "practice",
      route: window.location.pathname,
      metadata: {
        phase: currentPhase,
      },
    });
  }, [currentPhase, isRestoringDraft, selectedTopic]);

  // Cleanup mic stream and timers on unmount
  useEffect(() => {
    return () => {
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach((t) => t.stop());
        micStreamRef.current = null;
      }
      transitionTimersRef.current.forEach(clearTimeout);
      transitionTimersRef.current = [];
    };
  }, []);

  // Beforeunload warning during active session
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (
        currentPhase === "mic-check" ||
        currentPhase === "prep" ||
        currentPhase === "speaking" ||
        currentPhase === "ai-rebuttal"
      ) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [currentPhase]);

  // Start prep timer when entering prep phase
  useEffect(() => {
    if (selectedTopic && currentPhase === "prep" && !hasStartedRef.current) {
      hasStartedRef.current = true;
      prepTimer.start();
    }
  }, [selectedTopic, currentPhase, prepTimer]);

  // Prep timer finished → speaking
  useEffect(() => {
    if (prepTimer.isFinished && currentPhase === "prep") {
      transitionToSpeaking();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prepTimer.isFinished, currentPhase]);

  // Speech timer finished → end round
  useEffect(() => {
    if (speechTimer.isFinished && currentPhase === "speaking" && !hasEndedRef.current) {
      void handleRoundSpeechEnd();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speechTimer.isFinished, currentPhase]);

  // Sync transcript to store
  useEffect(() => {
    if (speech.transcript) {
      setTranscript(speech.transcript);
    }
  }, [speech.transcript, setTranscript]);

  // Toast for speech errors
  useEffect(() => {
    if (!speech.error) return;
    switch (speech.error) {
      case "reconnecting":
        showToast("Reconnecting to transcription service...", "warning");
        break;
      case "network":
        showToast("Connection to transcription service lost.", "error");
        break;
      default:
        if (speech.error.startsWith("Failed")) {
          showToast(speech.error, "error");
        }
        break;
    }
  }, [speech.error]);

  // Toast for silence
  useEffect(() => {
    if (speech.silenceWarning && currentPhase === "speaking") {
      showToast("We can't hear you. Please check your microphone.", "warning");
    }
  }, [speech.silenceWarning, currentPhase]);

  // Toast for audio recorder errors
  useEffect(() => {
    if (audio.error) {
      showToast(audio.error, "error");
    }
  }, [audio.error]);

  /** Called when mic check completes — stores stream and moves to prep */
  const handleMicReady = useCallback(
    (stream: MediaStream) => {
      micStreamRef.current = stream;
      setMicStream(stream);
      setTransitionMessage(t("session.transition_lets_go"));
      setTransitionSub(t("session.transition_session_starting"));
      setShowTransition(true);

      const tid = setTimeout(() => {
        setPhase("prep");
        setShowTransition(false);
      }, 1200);
      transitionTimersRef.current.push(tid);
    },
    [setPhase, t]
  );

  /** Called when user presses Go Back during mic check */
  const handleMicBack = useCallback(() => {
    router.push("/practice");
  }, [router]);

  /** Re-acquire mic stream (for resume after pause, or new round) */
  const acquireMicStream = useCallback(async (): Promise<MediaStream | null> => {
    // Check if existing stream is still active
    if (micStreamRef.current) {
      const tracks = micStreamRef.current.getTracks();
      if (tracks.length > 0 && tracks[0].readyState === "live") {
        return micStreamRef.current;
      }
    }

    // Need a new stream
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      micStreamRef.current = stream;
      setMicStream(stream);
      return stream;
    } catch {
      showToast("Failed to access microphone.", "error");
      return null;
    }
  }, []);

  const transitionToSpeaking = useCallback(async () => {
    const roundLabel =
      isFullRound && currentRoundInfo
        ? t("session.transition_round_with_label", {
            round: currentRound,
            label: getRoundLabel(currentRoundInfo.label),
          })
        : t("session.transition_get_ready");

    setTransitionMessage(roundLabel);
    setTransitionSub(t("session.transition_speaking_begins"));
    setShowTransition(true);

    // Ensure mic stream is ready
    const stream = await acquireMicStream();

    const tid = setTimeout(() => {
      setPhase("speaking");
      setShowTransition(false);
      speechTimer.start();
      roundSpeechStartRef.current = Date.now();

      if (stream) {
        speech.resetTranscript();
        setTranscript("");
        speech.startListening(stream);
        audio.startRecording(stream, true);
      }
    }, 1500);
    transitionTimersRef.current.push(tid);
  }, [
    setPhase,
    setTranscript,
    speechTimer,
    speech,
    audio,
    acquireMicStream,
    isFullRound,
    currentRound,
    currentRoundInfo,
    getRoundLabel,
    t,
  ]);

  const handleSkipPrep = useCallback(() => {
    prepTimer.pause();
    transitionToSpeaking();
  }, [prepTimer, transitionToSpeaking]);

  const handlePause = useCallback(() => {
    speechTimer.pause();
    speech.pauseListening();
    void audio.stopRecording();
    setIsPaused(true);
  }, [speechTimer, speech, audio]);

  const handleResume = useCallback(async () => {
    speechTimer.resume();
    const stream = await acquireMicStream();
    if (stream) {
      speech.startListening(stream);
      audio.startRecording(stream, false);
    }
    setIsPaused(false);
  }, [speechTimer, speech, audio, acquireMicStream]);

  /** Stop mic stream tracks */
  const stopMicStream = useCallback(() => {
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
      setMicStream(null);
    }
  }, []);

  const navigateToFeedback = useCallback((recordedAudio?: Blob | null) => {
    stopMicStream();
    const finalAudio = recordedAudio ?? audio.audioBlob;
    if (finalAudio) setAudioBlob(finalAudio);
    if (audio.audioUrl) setAudioUrl(audio.audioUrl);

    setTransitionMessage(t("session.transition_analyzing"));
    setTransitionSub(t("session.transition_analyzing_subtitle"));
    setShowTransition(true);
    setPhase("analyzing");

    const tid = setTimeout(() => {
      router.push("/practice/feedback");
    }, 1500);
    transitionTimersRef.current.push(tid);
  }, [audio.audioBlob, audio.audioUrl, setAudioBlob, setAudioUrl, setPhase, router, stopMicStream, t]);

  /** After a valid speech round, decide what comes next */
  const proceedAfterSpeech = useCallback(
    (_transcript: string, _duration: number, recordedAudio?: Blob | null) => {
      void _duration;

      if (!isFullRound) {
        navigateToFeedback(recordedAudio);
        return;
      }

      if (currentRound >= totalRounds) {
        // React has not committed saveRoundTranscript yet, so inject the current
        // round explicitly instead of reading a stale rounds snapshot.
        const allTranscripts = rounds
          .map((round) => {
            if (round.type === "user-speech") {
              const roundTranscript =
                round.roundNumber === currentRound
                  ? _transcript
                  : round.transcript;
              return roundTranscript
                ? `[${round.label}]\n${roundTranscript}`
                : null;
            }
            return round.aiResponse
              ? `[AI - ${round.label}]\n${round.aiResponse}`
              : null;
          })
          .filter(Boolean)
          .join("\n\n");
        setTranscript(allTranscripts);
        navigateToFeedback(recordedAudio);
        return;
      }

      const nextRound = rounds.find((r) => r.roundNumber === currentRound + 1);
      if (nextRound?.type === "ai-rebuttal") {
        setTransitionMessage(
          t("session.transition_round_title", { round: currentRound + 1 })
        );
        setTransitionSub(
          t("session.transition_round_subtitle", {
            label: getRoundLabel(nextRound.label),
          })
        );
        setShowTransition(true);

        const tid = setTimeout(() => {
          advanceToNextRound();
          setPhase("ai-rebuttal");
          setShowTransition(false);
          hasEndedRef.current = false;
        }, 1500);
        transitionTimersRef.current.push(tid);
      }
    },
    [
      isFullRound,
      currentRound,
      totalRounds,
      rounds,
      advanceToNextRound,
      setPhase,
      setTranscript,
      getRoundLabel,
      navigateToFeedback,
      t,
    ]
  );

  const handleRoundSpeechEnd = useCallback(async () => {
    if (hasEndedRef.current) return;
    hasEndedRef.current = true;
    setIsFinalizingSpeech(true);

    try {
      const [finalizedSpeech, recordedAudio] = await Promise.all([
        speech.finalizeListening(),
        audio.stopRecording(),
      ]);
      const finalTranscript = finalizedSpeech.transcript;
      lastFinalizedTranscriptRef.current = finalTranscript;
      setTranscript(finalTranscript);

      // Don't fully stop stream between rounds in full-round mode
      if (!isFullRound || currentRound >= totalRounds) stopMicStream();

      const duration = roundSpeechStartRef.current
        ? Math.round((Date.now() - roundSpeechStartRef.current) / 1000)
        : 0;

      const wordCount = finalTranscript
        .split(/\s+/)
        .filter((w) => w.length > 0).length;

      // Save transcript for current round (Full Round)
      if (isFullRound) {
        saveRoundTranscript(currentRound, finalTranscript, duration);
      }

      if (wordCount < 20) {
        setShortWordCount(wordCount);
        setShowShortDialog(true);
        return;
      }

      proceedAfterSpeech(finalTranscript, duration, recordedAudio);
    } catch (error) {
      console.error("[PracticeSession] Failed to finalize speech", {
        error: error instanceof Error ? error.message : "unknown_error",
      });
      hasEndedRef.current = false;
      showToast("Could not finish recording. Please try again.", "error");
    } finally {
      setIsFinalizingSpeech(false);
    }
  }, [
    speech,
    audio,
    stopMicStream,
    setTranscript,
    isFullRound,
    currentRound,
    totalRounds,
    saveRoundTranscript,
    proceedAfterSpeech,
  ]);

  /** Called when AI rebuttal completes */
  const handleAiRebuttalComplete = useCallback(
    (rebuttalText: string, aiHighlights: AiHighlight[] = []) => {
      saveAiRebuttal(currentRound, rebuttalText, aiHighlights);

      if (currentRound >= totalRounds) {
        const allTranscripts = getAllTranscripts();
        setTranscript(allTranscripts);
        navigateToFeedback();
        return;
      }

      const nextRound = rounds.find(
        (r) => r.roundNumber === currentRound + 1
      );
      if (nextRound?.type === "user-speech") {
        setTransitionMessage(
          t("session.transition_round_title", { round: currentRound + 1 })
        );
        setTransitionSub(
          t("session.transition_your_turn", {
            label: getRoundLabel(nextRound.label),
          })
        );
        setShowTransition(true);

        const tid = setTimeout(async () => {
          advanceToNextRound();
          setShowTransition(false);
          hasEndedRef.current = false;

          setPhase("speaking");
          speechTimer.reset();
          speechTimer.start();
          roundSpeechStartRef.current = Date.now();

          const stream = await acquireMicStream();
          if (stream) {
            speech.resetTranscript();
            setTranscript("");
            speech.startListening(stream);
            audio.startRecording(stream, true);
          }
        }, 1500);
        transitionTimersRef.current.push(tid);
      }
    },
    [
      currentRound,
      totalRounds,
      rounds,
      saveAiRebuttal,
      advanceToNextRound,
      setPhase,
      speechTimer,
      speech,
      audio,
      acquireMicStream,
      getAllTranscripts,
      setTranscript,
      getRoundLabel,
      navigateToFeedback,
      t,
    ]
  );

  const handleAiRebuttalGenerated = useCallback(
    (rebuttalText: string, aiHighlights: AiHighlight[]) => {
      saveAiRebuttal(currentRound, rebuttalText, aiHighlights);
    },
    [currentRound, saveAiRebuttal]
  );

  /** Manual end button during speaking */
  const handleEndSession = useCallback(() => {
    speechTimer.pause();
    void handleRoundSpeechEnd();
  }, [speechTimer, handleRoundSpeechEnd]);

  const handleShortSubmitAnyway = useCallback(() => {
    setShowShortDialog(false);
    const finalTranscript = lastFinalizedTranscriptRef.current;
    const duration = roundSpeechStartRef.current
      ? Math.round((Date.now() - roundSpeechStartRef.current) / 1000)
      : 0;
    proceedAfterSpeech(finalTranscript, duration, audio.audioBlob);
  }, [audio.audioBlob, proceedAfterSpeech]);

  const handleShortGoBack = useCallback(() => {
    setShowShortDialog(false);
    stopMicStream();
    router.push("/practice");
  }, [router, stopMicStream]);

  if (isRestoringDraft) {
    return <StudentRouteSkeleton variant="practice" />;
  }

  if (!selectedTopic) {
    return <MissingSessionState onBack={() => router.replace("/practice")} />;
  }

  const resolvedSide =
    side === "random"
      ? "proposition"
      : (side as "proposition" | "opposition");
  const motionBrief = getMotionBrief(selectedTopic, practiceLanguage);

  // Build previousRounds context for AI rebuttal
  const previousRoundsForAi = rounds
    .filter(
      (r) => r.roundNumber < currentRound && (r.transcript || r.aiResponse)
    )
    .map((r) => ({
      label: r.label,
      speaker: r.type === "user-speech" ? "Student" : "AI",
      text:
        r.type === "user-speech"
          ? r.transcript || ""
          : normalizeRebuttalText(r.aiResponse || ""),
    }));

  // Get the user's latest speech for AI rebuttal context
  const latestUserTranscript = (() => {
    const prevUserRounds = rounds.filter(
      (r) =>
        r.roundNumber < currentRound &&
        r.type === "user-speech" &&
        r.transcript
    );
    return prevUserRounds.length > 0
      ? prevUserRounds[prevUserRounds.length - 1].transcript || ""
      : "";
  })();

  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-background">
      {/* Network error banner */}
      {speech.error === "network" && currentPhase === "speaking" && (
        <div
          className="border-b border-amber-500/20 bg-amber-500/5 px-4 py-2 text-center"
          role="alert"
        >
          <span className="text-xs text-amber-400">
            Lost connection to transcription service. Attempting to reconnect...
          </span>
        </div>
      )}

      <SessionTopBar
        topicTitle={selectedTopic.title}
        side={resolvedSide}
        practiceTrack={practiceTrack}
        practiceLanguage={practiceLanguage}
        mode={mode}
        phase={currentPhase}
      />

      <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        <div className="flex min-h-full flex-col">
          {/* Round Progress (Full Round only, after prep) */}
          {isFullRound &&
            rounds.length > 0 &&
            currentPhase !== "prep" &&
            currentPhase !== "mic-check" && (
              <RoundProgress rounds={rounds} currentRound={currentRound} />
            )}

          {/* Audio Check (pre-session, for full round mode with TTS) */}
          {currentPhase === "mic-check" && !audioChecked && isFullRound && (
            <AudioCheck onPassed={() => setAudioChecked(true)} />
          )}

          {/* Mic Check Phase */}
          {currentPhase === "mic-check" && (audioChecked || !isFullRound) && (
            <MicCheck onReady={handleMicReady} onBack={handleMicBack} />
          )}

          {currentPhase === "prep" && (
            <PrepPhase
              topic={selectedTopic}
              side={resolvedSide}
              practiceTrack={practiceTrack}
              aiHintsEnabled={aiHints}
              timeLeft={prepTimer.timeLeft}
              totalTime={prepTime}
              progress={prepTimer.progress}
              isRunning={prepTimer.isRunning}
              prepNotes={prepNotes}
              onNotesChange={setPrepNotes}
              onSkip={handleSkipPrep}
            />
          )}

          {currentPhase === "speaking" && (
            <SpeakingPhase
              topic={selectedTopic}
              side={resolvedSide}
              timeLeft={speechTimer.timeLeft}
              totalTime={speechTime}
              progress={speechTimer.progress}
              isRunning={speechTimer.isRunning}
              isRecording={audio.isRecording}
              transcript={speech.transcript}
              interimTranscript={speech.interimTranscript}
              prepNotes={prepNotes}
              onNotesChange={setPrepNotes}
              audioStream={micStream}
              speechError={speech.error}
              onPause={handlePause}
              onResume={handleResume}
              onEnd={handleEndSession}
              isPaused={isPaused}
              hasDetectedAudio={speech.hasDetectedAudio}
              hasReceivedSpeech={speech.hasReceivedSpeech}
              isFinalizing={isFinalizingSpeech}
              rounds={isFullRound ? rounds : undefined}
              currentRound={isFullRound ? currentRound : undefined}
            />
          )}

          {currentPhase === "ai-rebuttal" && isFullRound && currentRoundInfo && (
            <AiRebuttalPhase
              topic={selectedTopic.title}
              side={resolvedSide}
              userTranscript={latestUserTranscript}
              roundLabel={currentRoundInfo.label}
              difficulty={aiDifficulty}
              practiceTrack={practiceTrack}
              practiceLanguage={practiceLanguage}
              previousRounds={previousRoundsForAi}
              speechTimeSeconds={speechTime}
              currentRoundNumber={currentRound}
              motionBrief={motionBrief}
              debateMemory={debateMemory}
              prepNotes={prepNotes}
              onNotesChange={setPrepNotes}
              onComplete={handleAiRebuttalComplete}
              onGenerated={handleAiRebuttalGenerated}
              initialResponse={currentRoundInfo.aiResponse}
              initialHighlights={currentRoundInfo.aiHighlights}
              ttsVoice={ttsVoice}
            />
          )}
        </div>
      </main>

      <AnimatePresence>
        {showTransition && (
          <TransitionOverlay
            message={transitionMessage}
            subMessage={transitionSub}
          />
        )}
      </AnimatePresence>

      {/* Short transcript dialog */}
      <ConfirmDialog
        open={showShortDialog}
        title="Very Short Speech"
        description={`Only ${shortWordCount} words detected (minimum recommended: 20). Submit anyway for reduced feedback quality, or go back to try again.`}
        confirmLabel="Submit Anyway"
        onConfirm={handleShortSubmitAnyway}
        onCancel={handleShortGoBack}
      />
    </div>
  );
}
