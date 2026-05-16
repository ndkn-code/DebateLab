"use client";

import { useState, useRef, useCallback, useEffect } from "react";

const PRACTICE_DEBUG_ID_STORAGE_KEY = "practiceSpeechDebugId";

function createDebugId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `speech-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function logSpeechDebug(
  debugId: string,
  event: string,
  metadata: Record<string, unknown> = {}
) {
  console.info("[speech-debug]", { debugId, event, ...metadata });
}

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

interface DeepgramTokenResponse {
  key?: string;
  authScheme?: "token" | "bearer";
  error?: string;
  code?: string;
  requestId?: string;
}

type DeepgramTokenError = Error & {
  code?: string;
  status?: number;
  requestId?: string;
};

function createDeepgramTokenError(
  message: string,
  metadata: Pick<DeepgramTokenError, "code" | "status" | "requestId"> = {}
) {
  const error = new Error(message) as DeepgramTokenError;
  error.code = metadata.code;
  error.status = metadata.status;
  error.requestId = metadata.requestId;
  return error;
}

function getTokenFailureSpeechError(error: DeepgramTokenError) {
  switch (error.code) {
    case "unauthorized":
      return "token-unauthorized";
    case "rate_limited":
      return "token-rate-limited";
    case "deepgram_missing_api_key":
    case "deepgram_grant_forbidden":
    case "deepgram_grant_missing_access_token":
      return "token-service-misconfigured";
    case "deepgram_grant_failed":
    case "deepgram_token_unexpected":
      return "token-service";
    default:
      if (error.status === 401) return "token-unauthorized";
      if (error.status === 429) return "token-rate-limited";
      return "token-service";
  }
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
  const debugIdRef = useRef<string>(createDebugId());
  const hasReceivedInterimRef = useRef(false);
  const hasReceivedFinalRef = useRef(false);

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
      const debugId = debugIdRef.current;
      logSpeechDebug(debugId, "deepgram_token_fetch_started");

      // Fetch API key from our server endpoint
      let apiKey: string;
      let authScheme: "token" | "bearer" = "bearer";
      try {
        const res = await fetch("/api/deepgram-token", {
          cache: "no-store",
          headers: {
            "X-Debug-Id": debugId,
          },
        });
        const data = (await res.json().catch(() => null)) as
          | DeepgramTokenResponse
          | null;
        logSpeechDebug(debugId, "deepgram_token_fetch_finished", {
          status: res.status,
          ok: res.ok,
          endpointCode: data?.code,
          tokenRequestId: data?.requestId,
        });
        if (!res.ok) {
          throw createDeepgramTokenError(
            data?.error || `Failed to get token (${res.status})`,
            {
              code: data?.code,
              status: res.status,
              requestId: data?.requestId,
            }
          );
        }
        if (!data?.key) {
          throw createDeepgramTokenError(data?.error || "No key returned", {
            code: data?.code ?? "deepgram_token_missing_key",
            status: res.status,
            requestId: data?.requestId,
          });
        }
        apiKey = data.key;
        authScheme = data.authScheme === "token" ? "token" : "bearer";
      } catch (err) {
        const tokenError = err as DeepgramTokenError;
        logSpeechDebug(debugId, "deepgram_token_fetch_failed", {
          message: tokenError.message ?? String(err),
          code: tokenError.code,
          status: tokenError.status,
          tokenRequestId: tokenError.requestId,
        });
        setError(getTokenFailureSpeechError(tokenError));
        return;
      }

      let audioContext: AudioContext;
      try {
        audioContext = new AudioContext({ sampleRate: 16000 });
        audioContextRef.current = audioContext;
      } catch (err) {
        logSpeechDebug(debugId, "audio_context_failed", {
          message: err instanceof Error ? err.message : String(err),
        });
        setError("Failed to set up audio capture");
        return;
      }

      const actualSampleRate = audioContext.sampleRate;
      logSpeechDebug(debugId, "audio_context_ready", {
        actualSampleRate,
        requestedSampleRate: 16000,
      });

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
      wsUrl.searchParams.set("sample_rate", String(actualSampleRate));
      wsUrl.searchParams.set("channels", "1");

      const ws = new WebSocket(wsUrl.toString(), [authScheme, apiKey]);
      wsRef.current = ws;
      logSpeechDebug(debugId, "deepgram_socket_created", {
        sampleRate: actualSampleRate,
        authScheme,
      });

      ws.onopen = () => {
        reconnectCountRef.current = 0;
        setError(null);
        logSpeechDebug(debugId, "deepgram_socket_opened", {
          sampleRate: actualSampleRate,
        });

        // Set up audio processing to capture PCM data and send to Deepgram
        try {
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

        } catch (err) {
          logSpeechDebug(debugId, "audio_processing_failed", {
            message: err instanceof Error ? err.message : String(err),
          });
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
              if (!hasReceivedFinalRef.current) {
                hasReceivedFinalRef.current = true;
                logSpeechDebug(debugId, "deepgram_first_final_result", {
                  transcriptLength: text.length,
                  confidence: alt.confidence,
                  speechFinal: data.speech_final,
                });
              }
              // Append finalized text to transcript
              transcriptRef.current += (transcriptRef.current ? " " : "") + text;
              setTranscript(transcriptRef.current);
              setInterimTranscript("");
            } else {
              if (!hasReceivedInterimRef.current) {
                hasReceivedInterimRef.current = true;
                logSpeechDebug(debugId, "deepgram_first_interim_result", {
                  transcriptLength: text.length,
                  confidence: alt.confidence,
                });
              }
              // Show interim text
              setInterimTranscript(text);
            }
          }
        } catch {
          // ignore parse errors
        }
      };

      ws.onerror = () => {
        logSpeechDebug(debugId, "deepgram_socket_error", {
          readyState: ws.readyState,
        });
        setError("network");
      };

      ws.onclose = (event) => {
        logSpeechDebug(debugId, "deepgram_socket_closed", {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean,
          shouldReconnect: shouldBeListeningRef.current,
          hasReceivedInterim: hasReceivedInterimRef.current,
          hasReceivedFinal: hasReceivedFinalRef.current,
          transcriptLength: transcriptRef.current.length,
        });
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

      const debugId = createDebugId();
      debugIdRef.current = debugId;
      window.sessionStorage.setItem(PRACTICE_DEBUG_ID_STORAGE_KEY, debugId);
      logSpeechDebug(debugId, "speech_start_requested", {
        trackCount: micStream.getAudioTracks().length,
        trackState: micStream.getAudioTracks()[0]?.readyState ?? "missing",
      });

      setError(null);
      reconnectCountRef.current = 0;
      hasReceivedSpeechRef.current = false;
      hasReceivedInterimRef.current = false;
      hasReceivedFinalRef.current = false;
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
    logSpeechDebug(debugIdRef.current, "speech_stop_requested", {
      hasReceivedSpeech: hasReceivedSpeechRef.current,
      hasReceivedInterim: hasReceivedInterimRef.current,
      hasReceivedFinal: hasReceivedFinalRef.current,
      transcriptLength: transcriptRef.current.length,
    });
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
