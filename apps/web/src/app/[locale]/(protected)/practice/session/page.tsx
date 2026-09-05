"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { AnimatePresence } from "framer-motion";
import { useSessionStore, FULL_ROUND_STRUCTURE } from "@/store/session-store";
import { DEFAULT_VOICE, coerceVoiceForLanguage } from "@/lib/tts-voices";
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
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { StudentRouteSkeleton } from "@/components/shared/student-route-skeleton";
import { showToast } from "@/components/shared/toast";
import { Button } from "@/components/ui/button";
import { AlertCircle, ArrowLeft } from "@/components/ui/icons";
import { trackAnalyticsEvent } from "@/lib/hooks/useAnalyticsEventTracker";
import { PageContainer } from "@/components/shared/product-layout";
import { buildPracticeRecoveryHref } from "@/lib/practice-session-recovery";
import {
  createMicrophoneRequest,
  getMicrophoneErrorKind,
  isLiveAudioStream,
  stopMediaStream,
  type MicrophoneRequest,
} from "@/lib/practice-microphone-request";
import { startPracticeRecording } from "@/lib/practice-recording-start";
import type { AiHighlight } from "@/types";

function MissingSessionState({ onBack }: { onBack: () => void }) {
  const t = useTranslations("dashboard.practice");

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md rounded-control border border-outline-variant bg-surface-container-lowest p-5 text-center shadow-none">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary-container text-primary">
          <AlertCircle className="h-6 w-6" />
        </div>
        <h1 className="mt-5 type-heading-md font-extrabold text-on-surface">
          {t("session.setup_expired_title")}
        </h1>
        <p className="mt-2 text-sm leading-6 text-on-surface-variant">
          {t("session.setup_expired_body")}
        </p>
        <Button
          onClick={onBack}
          className="mt-5 h-8 w-full gap-2 rounded-control"
        >
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
    clubContext,
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
  const [micRecovery, setMicRecovery] = useState<string | null>(null);
  const recoveryPanelRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (micRecovery) recoveryPanelRef.current?.scrollIntoView({ block: "nearest" });
  }, [micRecovery]);
  const micRequestRef = useRef<MicrophoneRequest | null>(null);
  const recordingGenerationRef = useRef(0);
  const recordingPendingRef = useRef(false);
  const pausePromiseRef = useRef<Promise<unknown>>(Promise.resolve());
  const recordingIntentRef = useRef<"start" | "resume" | "next-round">("start");
  const [audioChecked, setAudioChecked] = useState(false);
  const [ttsVoice, setTtsVoice] = useState(DEFAULT_VOICE);
  const hasStartedRef = useRef(false);
  const hasEndedRef = useRef(false);
  const leavingRef = useRef(false);
  const proceededRoundRef = useRef<number | null>(null);
  const lastFinalizedTranscriptRef = useRef("");
  const hasTrackedMissingSessionRef = useRef(false);
  const transitionTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const { isRestoringDraft } = usePracticeSessionDraft();

  // Mic stream ref — obtained from mic check, reused throughout session
  const micStreamRef = useRef<MediaStream | null>(null);
  const [micStream, setMicStream] = useState<MediaStream | null>(null);

  const prepTimer = useCountdown(prepTime);
  const speechTimer = useCountdown(
    useSessionStore.getState().speechTimeRemaining ?? speechTime,
  );
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
    [practiceLanguage, prepNotes, selectedTopic, side],
  );
  const speech = useDeepgramTranscription(practiceLanguage, sttContext);
  const audio = useAudioRecorder(useSessionStore.getState().audioBlob);
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
    [t],
  );

  // Load TTS voice preference
  useEffect(() => {
    const loadVoice = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from("profiles")
          .select("preferences")
          .eq("id", user.id)
          .single();
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
      recordingGenerationRef.current += 1;
      micRequestRef.current?.cancel();
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
    if (
      speechTimer.isFinished &&
      currentPhase === "speaking" &&
      !hasEndedRef.current
    ) {
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

  useEffect(() => {
    if (speech.error === "reconnecting")
      showToast(t("session.transcription_reconnecting"), "warning");
  }, [speech.error, t]);

  useEffect(() => {
    if (speech.silenceWarning && currentPhase === "speaking") {
      showToast(t("session.no_speech_detected"), "warning");
    }
  }, [speech.silenceWarning, currentPhase, t]);

  /** Called when mic check completes — stores stream and moves to prep */
  const handleMicReady = useCallback(
    (stream: MediaStream) => {
      if (!isLiveAudioStream(stream)) {
        stopMediaStream(stream);
        return;
      }
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
    [setPhase, t],
  );

  const setupHref = selectedTopic
    ? buildPracticeRecoveryHref({
        topicId: selectedTopic.topicKey ?? selectedTopic.id,
        topicTitle: selectedTopic.title,
        topicCategory: selectedTopic.category,
        topicDescription: selectedTopic.context,
        practiceTrack,
        mode,
        aiDifficulty,
        side,
        clubContext: clubContext ?? undefined,
      })
    : `/practice?track=${practiceTrack}`;

  const cancelMicRequest = useCallback(() => {
    recordingGenerationRef.current += 1;
    if (recordingPendingRef.current) {
      stopMediaStream(micStreamRef.current);
      micStreamRef.current = null;
      setMicStream(null);
    }
    recordingPendingRef.current = false;
    micRequestRef.current?.cancel();
    micRequestRef.current = null;
    setMicRecovery("cancelled");
    setShowTransition(false);
  }, []);

  const stopMicStream = useCallback(() => {
    stopMediaStream(micStreamRef.current);
    micStreamRef.current = null;
    setMicStream(null);
  }, []);

  const handleMicBack = useCallback(async () => {
    if (leavingRef.current) return;
    leavingRef.current = true;
    cancelMicRequest();
    prepTimer.pause();
    speechTimer.pause();
    useSessionStore.setState({ speechTimeRemaining: speechTimer.timeLeft });
    const pausedTranscript = speech.pauseListening();
    if (pausedTranscript) setTranscript(pausedTranscript);
    const recordedAudio = await audio.stopRecording();
    if (recordedAudio) setAudioBlob(recordedAudio);
    stopMicStream();
    transitionTimersRef.current.forEach(clearTimeout);
    transitionTimersRef.current = [];
    router.push(setupHref);
  }, [
    cancelMicRequest,
    prepTimer,
    speechTimer,
    speech,
    audio,
    stopMicStream,
    router,
    setupHref,
    setTranscript,
    setAudioBlob,
  ]);

  const acquireMicStream = useCallback(async (): Promise<MediaStream> => {
    if (isLiveAudioStream(micStreamRef.current)) return micStreamRef.current;
    stopMediaStream(micStreamRef.current);
    micRequestRef.current?.cancel();
    const request = createMicrophoneRequest((constraints) =>
      navigator.mediaDevices.getUserMedia(constraints),
    );
    micRequestRef.current = request;
    const stream = await request.promise;
    // Cancellation can happen between promise settlement and this continuation.
    if (micRequestRef.current !== request) {
      stopMediaStream(stream);
      throw new DOMException("Cancelled", "AbortError");
    }
    micRequestRef.current = null;
    micStreamRef.current = stream;
    setMicStream(stream);
    return stream;
  }, []);

  const beginRecording = useCallback(
    async (intent: "start" | "resume" | "next-round") => {
      if (recordingPendingRef.current || hasEndedRef.current || leavingRef.current) return;
      recordingPendingRef.current = true;
      recordingIntentRef.current = intent;
      const generation = ++recordingGenerationRef.current;
      setMicRecovery("pending");
      setShowTransition(false);
      prepTimer.pause();
      speechTimer.pause();
      try {
        await startPracticeRecording({
          waitForStop: () => pausePromiseRef.current,
          acquire: acquireMicStream,
          isCurrent: () => generation === recordingGenerationRef.current,
          startRecorder: (stream) =>
            audio.startRecording(stream, intent !== "resume"),
          commit: (stream) => {
            if (intent === "next-round") advanceToNextRound();
            if (intent !== "resume") {
              speech.resetTranscript();
              setTranscript("");
              useSessionStore.setState({ speechTimeRemaining: null });
              speechTimer.reset(speechTime);
            } else if (!speech.transcript) {
              // Draft restoration retains text even though browser audio cannot survive reload.
              speech.resetTranscript(useSessionStore.getState().transcript);
            }
            void speech.startListening(stream);
            setPhase("speaking");
            speechTimer.start();
            setIsPaused(false);
            setMicRecovery(null);
          },
        });
      } catch (error) {
        if (generation !== recordingGenerationRef.current) return;
        const kind = getMicrophoneErrorKind(error);
        setMicRecovery(
          error instanceof Error && error.message === "recorder-start-failed"
            ? "recording-failed"
            : kind,
        );
        setIsPaused(true);
        stopMicStream();
      } finally {
        if (generation === recordingGenerationRef.current)
          recordingPendingRef.current = false;
      }
    },
    [
      acquireMicStream,
      audio,
      advanceToNextRound,
      prepTimer,
      setPhase,
      setTranscript,
      speech,
      speechTime,
      speechTimer,
      stopMicStream,
    ],
  );

  const transitionToSpeaking = useCallback(
    () => beginRecording("start"),
    [beginRecording],
  );
  const handleSkipPrep = useCallback(() => {
    void transitionToSpeaking();
  }, [transitionToSpeaking]);

  const handlePause = useCallback(() => {
    cancelMicRequest();
    setMicRecovery(null);
    speechTimer.pause();
    useSessionStore.setState({ speechTimeRemaining: speechTimer.timeLeft });
    const pausedTranscript = speech.pauseListening();
    if (pausedTranscript) setTranscript(pausedTranscript);
    setIsPaused(true);
    const stream = micStreamRef.current;
    pausePromiseRef.current = audio.stopRecording().finally(() => {
      stopMediaStream(stream);
      if (micStreamRef.current === stream) {
        micStreamRef.current = null;
        setMicStream(null);
      }
    });
  }, [cancelMicRequest, speechTimer, speech, audio, setTranscript]);

  const handleResume = useCallback(
    () => beginRecording("resume"),
    [beginRecording],
  );

  // Device disconnect (or OS muting) pauses capture immediately; text and chunks remain.
  useEffect(() => {
    if (
      !micStream ||
      currentPhase !== "speaking" ||
      isPaused ||
      isFinalizingSpeech
    )
      return;
    const disconnected = () => {
      if (hasEndedRef.current) return;
      handlePause();
      recordingIntentRef.current = "resume";
      setMicRecovery("disconnected");
    };
    const tracks = micStream.getAudioTracks();
    tracks.forEach((track) => {
      track.addEventListener("ended", disconnected);
      track.addEventListener("mute", disconnected);
    });
    if (!isLiveAudioStream(micStream)) disconnected();
    return () =>
      tracks.forEach((track) => {
        track.removeEventListener("ended", disconnected);
        track.removeEventListener("mute", disconnected);
      });
  }, [micStream, currentPhase, isPaused, isFinalizingSpeech, handlePause]);

  useEffect(() => {
    if (
      !audio.error ||
      currentPhase !== "speaking" ||
      isPaused ||
      isFinalizingSpeech
    )
      return;
    handlePause();
    recordingIntentRef.current = "resume";
    setMicRecovery("recording-failed");
  }, [audio.error, currentPhase, isPaused, isFinalizingSpeech, handlePause]);

  useEffect(() => {
    if (
      isRestoringDraft ||
      currentPhase !== "speaking" ||
      audio.isRecording ||
      recordingPendingRef.current ||
      isPaused ||
      hasEndedRef.current
    )
      return;
    // A restored speaking draft needs a deliberate resume, never a running timer.
    recordingIntentRef.current = "resume";
    setIsPaused(true);
    setMicRecovery("cancelled");
  }, [isRestoringDraft, currentPhase, audio.isRecording, isPaused]);

  const navigateToFeedback = useCallback(
    (recordedAudio?: Blob | null) => {
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
    },
    [
      audio.audioBlob,
      audio.audioUrl,
      setAudioBlob,
      setAudioUrl,
      setPhase,
      router,
      stopMicStream,
      t,
    ],
  );

  /** After a valid speech round, decide what comes next */
  const proceedAfterSpeech = useCallback(
    (_transcript: string, _duration: number, recordedAudio?: Blob | null) => {
      void _duration;
      if (proceededRoundRef.current === currentRound) return;
      proceededRoundRef.current = currentRound;

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
          t("session.transition_round_title", { round: currentRound + 1 }),
        );
        setTransitionSub(
          t("session.transition_round_subtitle", {
            label: getRoundLabel(nextRound.label),
          }),
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
    ],
  );

  const handleRoundSpeechEnd = useCallback(async () => {
    if (hasEndedRef.current) return;
    hasEndedRef.current = true;
    cancelMicRequest();
    setMicRecovery(null);
    setIsFinalizingSpeech(true);

    try {
      const [finalizedSpeech, recordedAudio] = await Promise.all([
        speech.finalizeListening(),
        audio.stopRecording(),
      ]);
      const finalTranscript =
        finalizedSpeech.transcript || useSessionStore.getState().transcript;
      if (recordedAudio) setAudioBlob(recordedAudio);
      lastFinalizedTranscriptRef.current = finalTranscript;
      setTranscript(finalTranscript);

      // Don't fully stop stream between rounds in full-round mode
      if (!isFullRound || currentRound >= totalRounds) stopMicStream();

      const duration = Math.max(0, speechTime - speechTimer.timeLeft);

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
      setIsPaused(true);
      setMicRecovery("finalize-failed");
      showToast(t("session.finish_recording_failed"), "error");
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
    cancelMicRequest,
    setAudioBlob,
    speechTime,
    speechTimer.timeLeft,
    proceedAfterSpeech,
    t,
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

      const nextRound = rounds.find((r) => r.roundNumber === currentRound + 1);
      if (nextRound?.type === "user-speech") {
        // Keep recovery controls accessible while acquiring. Advance only after
        // recording starts; a blocking transition here would hide Back/Retry.
        hasEndedRef.current = false;
        void beginRecording("next-round");
      }
    },
    [
      currentRound,
      totalRounds,
      rounds,
      saveAiRebuttal,
      beginRecording,
      getAllTranscripts,
      setTranscript,
      navigateToFeedback,
    ],
  );

  const handleAiRebuttalGenerated = useCallback(
    (rebuttalText: string, aiHighlights: AiHighlight[]) => {
      saveAiRebuttal(currentRound, rebuttalText, aiHighlights);
    },
    [currentRound, saveAiRebuttal],
  );

  /** Manual end button during speaking */
  const handleEndSession = useCallback(() => {
    speechTimer.pause();
    void handleRoundSpeechEnd();
  }, [speechTimer, handleRoundSpeechEnd]);

  const handleShortSubmitAnyway = useCallback(() => {
    setShowShortDialog(false);
    const finalTranscript = lastFinalizedTranscriptRef.current;
    const duration = Math.max(0, speechTime - speechTimer.timeLeft);
    proceedAfterSpeech(finalTranscript, duration, audio.audioBlob);
  }, [audio.audioBlob, proceedAfterSpeech, speechTime, speechTimer.timeLeft]);

  const handleShortGoBack = useCallback(() => {
    setShowShortDialog(false);
    stopMicStream();
    router.push(setupHref);
  }, [router, setupHref, stopMicStream]);

  if (isRestoringDraft) {
    return <StudentRouteSkeleton variant="practice" />;
  }

  if (!selectedTopic) {
    return <MissingSessionState onBack={() => router.replace(setupHref)} />;
  }

  const resolvedSide =
    side === "random" ? "proposition" : (side as "proposition" | "opposition");
  const motionBrief = getMotionBrief(selectedTopic, practiceLanguage);

  // Build previousRounds context for AI rebuttal
  const previousRoundsForAi = rounds
    .filter(
      (r) => r.roundNumber < currentRound && (r.transcript || r.aiResponse),
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
        r.transcript,
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
          className="border-b border-warning bg-warning-container px-4 py-2 text-center"
          role="alert"
        >
          <span className="text-xs text-on-warning-container">
            {t("session.transcription_unavailable")}
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
          {micRecovery && (
            <PageContainer size="focused" className="py-4">
              <section
                ref={recoveryPanelRef}
                role="status"
                aria-live="polite"
                className="rounded-control border border-outline-variant bg-surface-container-lowest p-4"
              >
                <h2 className="type-title text-on-surface">
                  {t("session.mic_recovery_title")}
                </h2>
                <p className="mt-2 type-body text-on-surface-variant">
                  {{
                    pending: t("session.mic_recovery_pending"),
                    denied: t("session.mic_enable_steps"),
                    "not-found": t("session.connect_microphone"),
                    disconnected: t("session.mic_recovery_disconnected"),
                    "recording-failed": t("session.mic_recovery_recording_failed"),
                    "finalize-failed": t("session.finish_recording_failed"),
                    cancelled: t("session.mic_recovery_cancelled"),
                  }[micRecovery] ?? t("session.mic_recovery_body")}
                </p>
                {micRecovery === "denied" && (
                  <ol className="mt-2 list-inside list-decimal type-body-sm text-on-surface-variant">
                    <li>{t("session.mic_step_1")}</li>
                    <li>{t("session.mic_step_2")}</li>
                    <li>{t("session.mic_step_3")}</li>
                  </ol>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button variant="outline" onClick={handleMicBack}>
                    {t("session.go_back")}
                  </Button>
                  {micRecovery === "pending" && (
                    <Button variant="outline" onClick={cancelMicRequest}>
                      {t("session.mic_cancel_request")}
                    </Button>
                  )}
                  <Button
                    variant="primary"
                    onClick={() => {
                      if (micRecovery === "finalize-failed") {
                        void handleRoundSpeechEnd();
                      } else {
                        cancelMicRequest();
                        void beginRecording(recordingIntentRef.current);
                      }
                    }}
                  >
                    {micRecovery === "finalize-failed" ? t("session.finish_retry") : t("session.mic_retry")}
                  </Button>
                </div>
              </section>
            </PageContainer>
          )}
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
              progress={1 - speechTimer.timeLeft / speechTime}
              isRunning={speechTimer.isRunning}
              isRecording={audio.isRecording}
              transcript={
                speech.transcript || useSessionStore.getState().transcript
              }
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

          {currentPhase === "ai-rebuttal" &&
            isFullRound &&
            currentRoundInfo && (
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
      <Dialog open={showShortDialog} onOpenChange={(open) => { if (!open) handleShortGoBack(); }}>
        <DialogContent showCloseButton={false}>
          <DialogTitle>{t("session.short_speech_title")}</DialogTitle>
          <DialogDescription>{t("session.short_speech_body", { count: shortWordCount })}</DialogDescription>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={handleShortGoBack}>{t("session.go_back")}</Button>
            <Button variant="primary" onClick={handleShortSubmitAnyway}>{t("session.submit_anyway")}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
