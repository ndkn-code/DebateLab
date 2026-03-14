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

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const shouldBeListeningRef = useRef(false);
  const transcriptRef = useRef("");
  const lastSpeechTimeRef = useRef<number>(0);
  const silenceTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const restartCountRef = useRef(0);

  useEffect(() => {
    const supported =
      typeof window !== "undefined" &&
      ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);
    setIsSupported(supported);
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

      lastSpeechTimeRef.current = Date.now();
      setSilenceWarning(false);

      if (finalText) {
        transcriptRef.current += finalText;
        setTranscript(transcriptRef.current);
      }
      setInterimTranscript(interimText);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === "no-speech" || event.error === "aborted") {
        return;
      }
      setError(event.error);
      if (event.error === "not-allowed") {
        shouldBeListeningRef.current = false;
        setIsListening(false);
        clearSilenceTimer();
      }
    };

    recognition.onend = () => {
      if (shouldBeListeningRef.current) {
        restartCountRef.current++;
        if (restartCountRef.current > 2) {
          setError("reconnecting");
        }
        setTimeout(() => {
          if (shouldBeListeningRef.current) {
            try {
              const newRec = createRecognition();
              if (newRec) {
                recognitionRef.current = newRec;
                newRec.start();
                setTimeout(() => {
                  if (shouldBeListeningRef.current) setError(null);
                }, 500);
              }
            } catch {
              // Ignore
            }
          }
        }, 150);
      } else {
        setIsListening(false);
      }
    };

    return recognition;
  }, [clearSilenceTimer]);

  const startListening = useCallback(() => {
    setError(null);
    restartCountRef.current = 0;
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
    } catch {
      setError("Failed to start speech recognition");
    }
  }, [createRecognition, startSilenceDetection]);

  const stopListening = useCallback(() => {
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
  };
}
