"use client";

import { useState, useRef, useCallback, useEffect } from "react";

interface SpeechRecognitionEvent {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent {
  error: string;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onaudiostart: (() => void) | null;
  onsoundstart: (() => void) | null;
  onspeechstart: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition: new () => SpeechRecognitionInstance;
  }
}

export function useSpeechRecognition() {
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [silenceWarning, setSilenceWarning] = useState(false);
  const [hasReceivedSpeech, setHasReceivedSpeech] = useState(false);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const shouldBeListeningRef = useRef(false);
  const transcriptRef = useRef("");
  const lastSpeechTimeRef = useRef<number>(0);
  const silenceTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const restartCountRef = useRef(0);
  const hasReceivedSpeechRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const supported =
      "SpeechRecognition" in window || "webkitSpeechRecognition" in window;
    setIsSupported(supported);
    console.log("[SpeechRecognition] Browser support:", supported);
  }, []);

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearInterval(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    setSilenceWarning(false);
  }, []);

  const startSilenceDetection = useCallback(() => {
    clearSilenceTimer();
    lastSpeechTimeRef.current = Date.now();
    silenceTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - lastSpeechTimeRef.current;
      if (elapsed > 15000 && shouldBeListeningRef.current) {
        setSilenceWarning(true);
      }
    }, 3000);
  }, [clearSilenceTimer]);

  const createRecognition = useCallback(() => {
    if (typeof window === "undefined") return null;
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return null;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onaudiostart = () => {
      console.log("[SpeechRecognition] Audio capture started");
    };

    recognition.onsoundstart = () => {
      console.log("[SpeechRecognition] Sound detected");
    };

    recognition.onspeechstart = () => {
      console.log("[SpeechRecognition] Speech detected");
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalText = "";
      let interimText = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalText += result[0].transcript;
        } else {
          interimText += result[0].transcript;
        }
      }

      console.log("[SpeechRecognition] Result:", {
        final: finalText.substring(0, 50),
        interim: interimText.substring(0, 50),
      });

      lastSpeechTimeRef.current = Date.now();
      setSilenceWarning(false);
      restartCountRef.current = 0;

      if (!hasReceivedSpeechRef.current) {
        hasReceivedSpeechRef.current = true;
        setHasReceivedSpeech(true);
      }

      if (finalText) {
        transcriptRef.current += finalText;
        setTranscript(transcriptRef.current);
      }
      setInterimTranscript(interimText);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.warn("[SpeechRecognition] Error:", event.error);

      switch (event.error) {
        case "no-speech":
          // Auto-restart — don't show error, the onend handler will restart
          return;
        case "aborted":
          // Auto-restart via onend
          return;
        case "audio-capture":
          setError("audio-capture");
          shouldBeListeningRef.current = false;
          setIsListening(false);
          clearSilenceTimer();
          return;
        case "not-allowed":
          setError("not-allowed");
          shouldBeListeningRef.current = false;
          setIsListening(false);
          clearSilenceTimer();
          return;
        case "network":
          setError("network");
          // Don't stop — will retry via onend
          return;
        default:
          setError(event.error);
          return;
      }
    };

    recognition.onend = () => {
      console.log("[SpeechRecognition] Session ended, shouldRestart:", shouldBeListeningRef.current);

      if (shouldBeListeningRef.current) {
        restartCountRef.current++;
        if (restartCountRef.current > 5) {
          console.warn("[SpeechRecognition] Too many restarts, showing reconnecting");
          setError("reconnecting");
        }
        const delay = Math.min(restartCountRef.current * 100, 1000);
        setTimeout(() => {
          if (shouldBeListeningRef.current) {
            try {
              const newRec = createRecognition();
              if (newRec) {
                recognitionRef.current = newRec;
                newRec.start();
                console.log("[SpeechRecognition] Restarted successfully");
                setTimeout(() => {
                  if (shouldBeListeningRef.current && restartCountRef.current <= 5) {
                    setError(null);
                  }
                }, 500);
              }
            } catch (e) {
              console.error("[SpeechRecognition] Restart failed:", e);
            }
          }
        }, delay);
      } else {
        setIsListening(false);
      }
    };

    return recognition;
  }, [clearSilenceTimer]);

  const startListening = useCallback(() => {
    if (typeof window === "undefined") return;

    console.log("[SpeechRecognition] Starting...");
    setError(null);
    restartCountRef.current = 0;
    hasReceivedSpeechRef.current = false;
    setHasReceivedSpeech(false);

    const recognition = createRecognition();
    if (!recognition) {
      setError("Speech recognition not supported");
      return;
    }

    recognitionRef.current = recognition;
    shouldBeListeningRef.current = true;

    try {
      recognition.start();
      setIsListening(true);
      startSilenceDetection();
      console.log("[SpeechRecognition] Started successfully");
    } catch (e) {
      console.error("[SpeechRecognition] Failed to start:", e);
      setError("Failed to start speech recognition");
    }
  }, [createRecognition, startSilenceDetection]);

  const stopListening = useCallback(() => {
    console.log("[SpeechRecognition] Stopping...");
    shouldBeListeningRef.current = false;
    clearSilenceTimer();
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Already stopped
      }
      recognitionRef.current = null;
    }
    setIsListening(false);
    setInterimTranscript("");
  }, [clearSilenceTimer]);

  const resetTranscript = useCallback(() => {
    transcriptRef.current = "";
    setTranscript("");
    setInterimTranscript("");
    hasReceivedSpeechRef.current = false;
    setHasReceivedSpeech(false);
  }, []);

  useEffect(() => {
    return () => {
      shouldBeListeningRef.current = false;
      clearSilenceTimer();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // Ignore
        }
      }
    };
  }, [clearSilenceTimer]);

  return {
    transcript,
    interimTranscript,
    isListening,
    startListening,
    stopListening,
    resetTranscript,
    isSupported,
    error,
    silenceWarning,
    hasReceivedSpeech,
  };
}
