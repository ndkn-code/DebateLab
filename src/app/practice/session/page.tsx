"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import { AlertTriangle, Mic, Globe } from "lucide-react";
import { useSessionStore } from "@/store/session-store";
import { useCountdown } from "@/hooks/use-countdown";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { useAudioRecorder } from "@/hooks/use-audio-recorder";
import { SessionTopBar } from "@/components/practice/session-top-bar";
import { PrepPhase } from "@/components/practice/prep-phase";
import { SpeakingPhase } from "@/components/practice/speaking-phase";
import { TransitionOverlay } from "@/components/practice/transition-overlay";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { showToast } from "@/components/shared/toast";

export default function SessionPage() {
  const router = useRouter();
  const {
    selectedTopic,
    side,
    mode,
    prepTime,
    speechTime,
    aiHints,
    currentPhase,
    prepNotes,
    setPhase,
    setPrepNotes,
    setTranscript,
    setAudioBlob,
    setAudioUrl,
  } = useSessionStore();

  const [showTransition, setShowTransition] = useState(false);
  const [transitionMessage, setTransitionMessage] = useState("");
  const [transitionSub, setTransitionSub] = useState("");
  const [isPaused, setIsPaused] = useState(false);
  const [browserWarning, setBrowserWarning] = useState<string | null>(null);
  const [showShortDialog, setShowShortDialog] = useState(false);
  const [shortWordCount, setShortWordCount] = useState(0);
  const hasStartedRef = useRef(false);
  const hasEndedRef = useRef(false);

  const prepTimer = useCountdown(prepTime);
  const speechTimer = useCountdown(speechTime);
  const speech = useSpeechRecognition();
  const audio = useAudioRecorder();

  // Redirect if no topic
  useEffect(() => {
    if (!selectedTopic) {
      router.replace("/practice");
    }
  }, [selectedTopic, router]);

  // Browser compatibility check
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!speech.isSupported) {
      setBrowserWarning(
        "Please use Google Chrome for the best experience. Speech recognition may not work in this browser."
      );
    }
  }, [speech.isSupported]);

  // Beforeunload warning during active session
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (currentPhase === "prep" || currentPhase === "speaking") {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [currentPhase]);

  // Start prep timer
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

  // Speech timer finished → end
  useEffect(() => {
    if (speechTimer.isFinished && currentPhase === "speaking" && !hasEndedRef.current) {
      hasEndedRef.current = true;
      handleTimerEnd();
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
        showToast("Reconnecting microphone...", "warning");
        break;
      case "not-allowed":
        showToast("Microphone access denied. Check browser settings.", "error");
        break;
      case "audio-capture":
        showToast("Microphone not found. Please connect a microphone.", "error");
        break;
      case "network":
        showToast("Speech recognition requires an internet connection.", "error");
        break;
    }
  }, [speech.error]);

  // Toast for silence
  useEffect(() => {
    if (speech.silenceWarning && currentPhase === "speaking") {
      showToast("We can't hear you. Please check your microphone.", "warning");
    }
  }, [speech.silenceWarning, currentPhase]);

  // Toast for audio errors
  useEffect(() => {
    if (audio.error) {
      showToast(audio.error, "error");
    }
  }, [audio.error]);

  const transitionToSpeaking = useCallback(() => {
    setTransitionMessage("Get Ready!");
    setTransitionSub("Speaking phase begins now...");
    setShowTransition(true);

    setTimeout(() => {
      setPhase("speaking");
      setShowTransition(false);
      speechTimer.start();
      // Start speech recognition FIRST, then audio recorder
      // This avoids mic access conflicts — SpeechRecognition uses its own mic access
      speech.startListening();
      // Small delay before starting MediaRecorder to avoid concurrent getUserMedia conflicts
      setTimeout(() => {
        audio.startRecording();
      }, 200);
    }, 1500);
  }, [setPhase, speechTimer, speech, audio]);

  const handleSkipPrep = useCallback(() => {
    prepTimer.pause();
    transitionToSpeaking();
  }, [prepTimer, transitionToSpeaking]);

  const handlePause = useCallback(() => {
    speechTimer.pause();
    speech.stopListening();
    setIsPaused(true);
  }, [speechTimer, speech]);

  const handleResume = useCallback(() => {
    speechTimer.resume();
    speech.startListening();
    setIsPaused(false);
  }, [speechTimer, speech]);

  const navigateToFeedback = useCallback(() => {
    setTimeout(() => {
      if (audio.audioBlob) setAudioBlob(audio.audioBlob);
      if (audio.audioUrl) setAudioUrl(audio.audioUrl);

      setTransitionMessage("Analyzing...");
      setTransitionSub("Processing your speech...");
      setShowTransition(true);
      setPhase("analyzing");

      setTimeout(() => {
        router.push("/practice/feedback");
      }, 1500);
    }, 300);
  }, [audio, setAudioBlob, setAudioUrl, setPhase, router]);

  const handleEndSession = useCallback(() => {
    speechTimer.pause();
    speech.stopListening();
    audio.stopRecording();

    const finalTranscript = speech.transcript;
    setTranscript(finalTranscript);

    const wordCount = finalTranscript
      .split(/\s+/)
      .filter((w) => w.length > 0).length;

    if (wordCount < 20) {
      setShortWordCount(wordCount);
      setShowShortDialog(true);
      return;
    }

    navigateToFeedback();
  }, [speechTimer, speech, audio, setTranscript, navigateToFeedback]);

  const handleTimerEnd = useCallback(() => {
    speech.stopListening();
    audio.stopRecording();

    const finalTranscript = speech.transcript;
    setTranscript(finalTranscript);

    const wordCount = finalTranscript
      .split(/\s+/)
      .filter((w) => w.length > 0).length;

    if (wordCount < 20) {
      setShortWordCount(wordCount);
      setShowShortDialog(true);
      return;
    }

    setTransitionMessage("Time's Up!");
    setTransitionSub("Analyzing your speech...");
    setShowTransition(true);
    setPhase("analyzing");

    setTimeout(() => {
      if (audio.audioBlob) setAudioBlob(audio.audioBlob);
      if (audio.audioUrl) setAudioUrl(audio.audioUrl);
      router.push("/practice/feedback");
    }, 1500);
  }, [speech, audio, setTranscript, setAudioBlob, setAudioUrl, setPhase, router]);

  const handleShortSubmitAnyway = useCallback(() => {
    setShowShortDialog(false);
    navigateToFeedback();
  }, [navigateToFeedback]);

  const handleShortGoBack = useCallback(() => {
    setShowShortDialog(false);
    router.push("/practice");
  }, [router]);

  if (!selectedTopic) return null;

  const resolvedSide =
    side === "random"
      ? "proposition"
      : (side as "proposition" | "opposition");

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950">
      {/* Browser warning */}
      {browserWarning && (
        <div
          className="flex items-center justify-center gap-2 bg-amber-500/10 px-4 py-2 text-center text-sm text-amber-400"
          role="alert"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {browserWarning}
        </div>
      )}

      {/* Mic permission denied instructions */}
      {speech.error === "not-allowed" && (
        <div className="border-b border-red-500/20 bg-red-500/5 px-4 py-3" role="alert">
          <div className="mx-auto max-w-2xl text-center">
            <div className="mb-2 flex items-center justify-center gap-2">
              <Mic className="h-4 w-4 text-red-400" aria-hidden="true" />
              <span className="text-sm font-medium text-red-400">
                Microphone Access Required
              </span>
            </div>
            <ol className="text-xs leading-relaxed text-zinc-400">
              <li>1. Click the lock/site settings icon in your browser address bar</li>
              <li>2. Find &quot;Microphone&quot; and set it to &quot;Allow&quot;</li>
              <li>3. Reload this page</li>
            </ol>
          </div>
        </div>
      )}

      {/* Network error banner */}
      {speech.error === "network" && (
        <div className="border-b border-amber-500/20 bg-amber-500/5 px-4 py-2 text-center" role="alert">
          <span className="text-xs text-amber-400">
            Speech recognition requires an internet connection. Please check your network and reload.
          </span>
        </div>
      )}

      {/* Audio capture error banner */}
      {speech.error === "audio-capture" && (
        <div className="border-b border-red-500/20 bg-red-500/5 px-4 py-2 text-center" role="alert">
          <span className="text-xs text-red-400">
            No microphone detected. Please connect a microphone and reload.
          </span>
        </div>
      )}

      {/* English only note */}
      {currentPhase === "speaking" && (
        <div className="flex items-center justify-center gap-1.5 bg-zinc-900/50 px-4 py-1 text-[11px] text-zinc-500">
          <Globe className="h-3 w-3" aria-hidden="true" />
          English only — Speech recognition is set to en-US
        </div>
      )}

      <SessionTopBar
        topicTitle={selectedTopic.title}
        side={resolvedSide}
        mode={mode}
        phase={currentPhase}
      />

      {currentPhase === "prep" && (
        <PrepPhase
          topic={selectedTopic}
          side={resolvedSide}
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
          timeLeft={speechTimer.timeLeft}
          totalTime={speechTime}
          progress={speechTimer.progress}
          isRunning={speechTimer.isRunning}
          isRecording={audio.isRecording}
          transcript={speech.transcript}
          interimTranscript={speech.interimTranscript}
          prepNotes={prepNotes}
          audioStream={audio.audioStream}
          speechError={speech.error}
          onPause={handlePause}
          onResume={handleResume}
          onEnd={handleEndSession}
          isPaused={isPaused}
          hasReceivedSpeech={speech.hasReceivedSpeech}
        />
      )}

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
