"use client";

import { useState, useRef, useCallback, useEffect } from "react";

function float32ToInt16(float32Array: Float32Array): ArrayBuffer {
  const int16Array = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return int16Array.buffer;
}

interface DeepgramResult {
  type: string;
  is_final: boolean;
  speech_final: boolean;
  channel: {
    alternatives: Array<{
      transcript: string;
      confidence: number;
    }>;
  };
}

export function useDeepgramTranscription() {
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [silenceWarning, setSilenceWarning] = useState(false);
  const [hasReceivedSpeech, setHasReceivedSpeech] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const shouldBeListeningRef = useRef(false);
  const transcriptRef = useRef("");
  const hasReceivedSpeechRef = useRef(false);
  const lastSpeechTimeRef = useRef<number>(0);
  const silenceTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectCountRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

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

  const closeWebSocket = useCallback(() => {
    if (wsRef.current) {
      try {
        if (wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: "CloseStream" }));
        }
        wsRef.current.close();
      } catch {
        // Ignore close errors
      }
      wsRef.current = null;
    }
  }, []);

  const closeAudioProcessing = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
  }, []);

  const connectWebSocket = useCallback(
    async (micStream: MediaStream) => {
      // Fetch API key from our server endpoint
      let apiKey: string;
      try {
        const res = await fetch("/api/deepgram-token");
        if (!res.ok) throw new Error("Failed to get token");
        const data = (await res.json()) as { key?: string; error?: string };
        if (!data.key) throw new Error(data.error || "No key returned");
        apiKey = data.key;
      } catch (err) {
        setError("Failed to initialize speech recognition");
        return;
      }

      // Build Deepgram WebSocket URL
      const wsUrl = new URL("wss://api.deepgram.com/v1/listen");
      wsUrl.searchParams.set("model", "nova-3");
      wsUrl.searchParams.set("language", "en");
      wsUrl.searchParams.set("smart_format", "true");
      wsUrl.searchParams.set("filler_words", "true");
      wsUrl.searchParams.set("utterances", "true");
      wsUrl.searchParams.set("interim_results", "true");
      wsUrl.searchParams.set("endpointing", "300");
      wsUrl.searchParams.set("encoding", "linear16");
      wsUrl.searchParams.set("sample_rate", "16000");
      wsUrl.searchParams.set("channels", "1");

      const ws = new WebSocket(wsUrl.toString(), ["token", apiKey]);
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectCountRef.current = 0;
        setError(null);

        // Set up audio processing to capture PCM data and send to Deepgram
        try {
          const audioContext = new AudioContext({ sampleRate: 16000 });
          audioContextRef.current = audioContext;

          const source = audioContext.createMediaStreamSource(micStream);
          sourceRef.current = source;

          // ScriptProcessorNode with 4096 buffer, 1 input channel, 1 output channel
          const processor = audioContext.createScriptProcessor(4096, 1, 1);
          processorRef.current = processor;

          processor.onaudioprocess = (e) => {
            if (ws.readyState === WebSocket.OPEN) {
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmData = float32ToInt16(inputData);
              ws.send(pcmData);
            }
          };

          source.connect(processor);
          processor.connect(audioContext.destination);

        } catch {
          setError("Failed to set up audio capture");
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data as string) as DeepgramResult;

          if (data.type === "Results") {
            const alt = data.channel?.alternatives?.[0];
            if (!alt) return;

            const text = alt.transcript;
            if (!text) return;

            lastSpeechTimeRef.current = Date.now();
            setSilenceWarning(false);

            if (!hasReceivedSpeechRef.current) {
              hasReceivedSpeechRef.current = true;
              setHasReceivedSpeech(true);
            }

            if (data.is_final) {
              // Append finalized text to transcript
              transcriptRef.current += (transcriptRef.current ? " " : "") + text;
              setTranscript(transcriptRef.current);
              setInterimTranscript("");
            } else {
              // Show interim text
              setInterimTranscript(text);
            }
          }
        } catch {
          // ignore parse errors
        }
      };

      ws.onerror = () => {
        setError("network");
      };

      ws.onclose = () => {
        closeAudioProcessing();

        if (shouldBeListeningRef.current) {
          reconnectCountRef.current++;
          if (reconnectCountRef.current > 3) {
            setError("reconnecting");
            return;
          }
          const delay = Math.min(reconnectCountRef.current * 500, 2000);
          reconnectTimerRef.current = setTimeout(() => {
            reconnectTimerRef.current = null;
            if (shouldBeListeningRef.current && streamRef.current) {
              connectWebSocket(streamRef.current);
            }
          }, delay);
        }
      };
    },
    [closeAudioProcessing]
  );

  const startListening = useCallback(
    async (micStream: MediaStream) => {
      if (typeof window === "undefined") return;

      setError(null);
      reconnectCountRef.current = 0;
      hasReceivedSpeechRef.current = false;
      setHasReceivedSpeech(false);

      shouldBeListeningRef.current = true;
      streamRef.current = micStream;
      setIsListening(true);
      startSilenceDetection();

      await connectWebSocket(micStream);
    },
    [connectWebSocket, startSilenceDetection]
  );

  const stopListening = useCallback(() => {
    shouldBeListeningRef.current = false;
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    clearSilenceTimer();
    closeWebSocket();
    closeAudioProcessing();
    streamRef.current = null;
    setIsListening(false);
    setInterimTranscript("");
  }, [clearSilenceTimer, closeWebSocket, closeAudioProcessing]);

  const resetTranscript = useCallback(() => {
    transcriptRef.current = "";
    setTranscript("");
    setInterimTranscript("");
    hasReceivedSpeechRef.current = false;
    setHasReceivedSpeech(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      shouldBeListeningRef.current = false;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      clearSilenceTimer();
      closeWebSocket();
      closeAudioProcessing();
    };
  }, [clearSilenceTimer, closeWebSocket, closeAudioProcessing]);

  return {
    transcript,
    interimTranscript,
    isListening,
    startListening,
    stopListening,
    resetTranscript,
    isSupported: true, // Deepgram works on all browsers with getUserMedia
    error,
    silenceWarning,
    hasReceivedSpeech,
  };
}
