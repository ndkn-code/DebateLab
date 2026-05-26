'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { usePostHog } from 'posthog-js/react';

interface UseTTSOptions {
  voice?: string;
  practiceLanguage?: "en" | "vi";
  autoPlay?: boolean;
  onPlayStart?: () => void;
  onPlayEnd?: () => void;
  onError?: (error: string) => void;
}

interface UseTTSReturn {
  speak: (text: string) => Promise<void>;
  stop: () => void;
  replay: () => void;
  isLoading: boolean;
  isPlaying: boolean;
  hasPlayed: boolean;
  error: string | null;
  latencyMs: number | null;
  audioDurationSeconds: number | null;
}

type WebAudioStopReason = "manual" | "replace";

let sharedTtsAudioContext: AudioContext | null = null;

function getTtsAudioContext() {
  if (typeof window === "undefined") return null;

  const AudioContextCtor =
    window.AudioContext ??
    (window as Window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;

  if (!AudioContextCtor) return null;

  sharedTtsAudioContext ??= new AudioContextCtor();
  return sharedTtsAudioContext;
}

export async function unlockTtsAutoplay() {
  const context = getTtsAudioContext();
  if (!context) return false;

  try {
    if (context.state === "suspended") {
      await context.resume();
    }

    const buffer = context.createBuffer(1, 1, 22050);
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    source.start(0);

    return context.state === "running";
  } catch {
    return false;
  }
}

export function useTtsAutoplayUnlock() {
  useEffect(() => {
    const unlock = () => {
      void unlockTtsAutoplay();
    };

    window.addEventListener("pointerdown", unlock, true);
    window.addEventListener("keydown", unlock, true);
    window.addEventListener("touchend", unlock, true);

    return () => {
      window.removeEventListener("pointerdown", unlock, true);
      window.removeEventListener("keydown", unlock, true);
      window.removeEventListener("touchend", unlock, true);
    };
  }, []);
}

async function decodeTtsAudioBuffer(blob: Blob) {
  const context = getTtsAudioContext();
  if (!context) return null;

  try {
    const arrayBuffer = await blob.arrayBuffer();
    return await context.decodeAudioData(arrayBuffer.slice(0));
  } catch {
    return null;
  }
}

function stopWebAudioSource(source: AudioBufferSourceNode | null) {
  try {
    source?.stop();
  } catch {
    // The source may already have ended; stopping twice throws in some browsers.
  }
}

export function useTTS(options: UseTTSOptions = {}): UseTTSReturn {
  const {
    voice = 'aura-asteria-en',
    practiceLanguage,
    autoPlay = true,
    onPlayStart,
    onPlayEnd,
    onError,
  } = options;

  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasPlayed, setHasPlayed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [audioDurationSeconds, setAudioDurationSeconds] = useState<number | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const decodedAudioRef = useRef<AudioBuffer | null>(null);
  const webAudioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const webAudioStopReasonRef = useRef<WebAudioStopReason | null>(null);
  const playStartTimeRef = useRef<number | null>(null);
  const hasPlayedRef = useRef(false);
  const playbackTextLengthRef = useRef(0);
  const playbackLatencyMsRef = useRef<number | null>(null);
  const playbackAudioSizeRef = useRef(0);
  const posthog = usePostHog();

  // Keep ref in sync
  useEffect(() => {
    hasPlayedRef.current = hasPlayed;
  }, [hasPlayed]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (webAudioSourceRef.current) {
        webAudioStopReasonRef.current = "replace";
        stopWebAudioSource(webAudioSourceRef.current);
        webAudioSourceRef.current = null;
      }
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
      }
    };
  }, []);

  const handlePlaybackStart = useCallback(() => {
    setIsPlaying(true);
    playStartTimeRef.current = Date.now();
    onPlayStart?.();
  }, [onPlayStart]);

  const handlePlaybackCompleted = useCallback(
    (wasReplay: boolean) => {
      setIsPlaying(false);
      setHasPlayed(true);

      const listenDuration = playStartTimeRef.current
        ? Date.now() - playStartTimeRef.current
        : 0;

      posthog?.capture('tts_playback_completed', {
        voice,
        text_length: playbackTextLengthRef.current,
        listen_duration_ms: listenDuration,
        latency_ms: playbackLatencyMsRef.current,
        audio_size_bytes: playbackAudioSizeRef.current,
        was_replay: wasReplay,
      });

      onPlayEnd?.();
    },
    [onPlayEnd, posthog, voice]
  );

  const handlePlaybackSkipped = useCallback(
    (skipPoint?: number, totalDuration?: number) => {
      setIsPlaying(false);

      const listenDuration = playStartTimeRef.current
        ? Date.now() - playStartTimeRef.current
        : 0;

      posthog?.capture('tts_playback_skipped', {
        voice,
        text_length: playbackTextLengthRef.current,
        listen_duration_ms: listenDuration,
        skip_point: skipPoint,
        total_duration: totalDuration,
      });
    },
    [posthog, voice]
  );

  const playDecodedAudio = useCallback(
    async (audioBuffer: AudioBuffer) => {
      const context = getTtsAudioContext();
      if (!context) return false;

      const unlocked = await unlockTtsAutoplay();
      if (!unlocked || context.state !== "running") return false;

      if (webAudioSourceRef.current) {
        webAudioStopReasonRef.current = "replace";
        stopWebAudioSource(webAudioSourceRef.current);
        webAudioSourceRef.current = null;
      }

      const source = context.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(context.destination);

      const wasReplay = hasPlayedRef.current;
      webAudioSourceRef.current = source;
      webAudioStopReasonRef.current = null;

      source.onended = () => {
        if (webAudioSourceRef.current !== source) return;

        webAudioSourceRef.current = null;
        const stopReason = webAudioStopReasonRef.current;
        webAudioStopReasonRef.current = null;

        if (stopReason === "manual") {
          handlePlaybackSkipped(
            playStartTimeRef.current
              ? (Date.now() - playStartTimeRef.current) / 1000
              : undefined,
            audioBuffer.duration
          );
          return;
        }

        if (stopReason === "replace") {
          setIsPlaying(false);
          return;
        }

        handlePlaybackCompleted(wasReplay);
      };

      handlePlaybackStart();
      source.start(0);
      return true;
    },
    [handlePlaybackCompleted, handlePlaybackSkipped, handlePlaybackStart]
  );

  const speak = useCallback(async (text: string) => {
    setIsLoading(true);
    setError(null);
    setAudioDurationSeconds(null);
    decodedAudioRef.current = null;

    const truncatedText = text.length > 5000 ? text.substring(0, 5000) : text;

    const attemptFetch = async (): Promise<{ blob: Blob; latency: number }> => {
      const fetchStart = Date.now();
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: truncatedText, voice, practiceLanguage }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'TTS failed' }));
        throw new Error(errData.error || `TTS request failed (${res.status})`);
      }

      return { blob: await res.blob(), latency: Date.now() - fetchStart };
    };

    try {
      let result: { blob: Blob; latency: number };

      try {
        result = await attemptFetch();
      } catch {
        // Retry once
        result = await attemptFetch();
      }

      const { blob: audioBlob, latency } = result;
      setLatencyMs(latency);
      playbackTextLengthRef.current = truncatedText.length;
      playbackLatencyMsRef.current = latency;
      playbackAudioSizeRef.current = audioBlob.size;

      // Clean up previous blob URL
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);

      const url = URL.createObjectURL(audioBlob);
      blobUrlRef.current = url;
      const decodedAudio = await decodeTtsAudioBuffer(audioBlob);
      decodedAudioRef.current = decodedAudio;
      if (decodedAudio?.duration) {
        setAudioDurationSeconds(decodedAudio.duration);
      }

      const audio = new Audio(url);
      audio.preload = "auto";
      audioRef.current = audio;

      audio.onloadedmetadata = () => {
        setAudioDurationSeconds(
          Number.isFinite(audio.duration) && audio.duration > 0
            ? audio.duration
            : null
        );
      };

      audio.onplay = () => {
        handlePlaybackStart();
      };

      audio.onended = () => {
        handlePlaybackCompleted(hasPlayedRef.current);
      };

      audio.onpause = () => {
        if (!audio.ended) {
          handlePlaybackSkipped(audio.currentTime, audio.duration);
        }
      };

      audio.onerror = () => {
        setIsPlaying(false);
        setAudioDurationSeconds(null);
        setError('Audio playback failed');
        posthog?.capture('tts_playback_error', { voice, text_length: truncatedText.length });
        onError?.('Audio playback failed');
      };

      // PostHog: TTS generated
      posthog?.capture('tts_generated', {
        voice,
        text_length: truncatedText.length,
        latency_ms: latency,
        audio_size_bytes: audioBlob.size,
      });

      if (autoPlay) {
        const playedWithWebAudio = decodedAudio
          ? await playDecodedAudio(decodedAudio)
          : false;

        if (!playedWithWebAudio) {
          try {
            await audio.play();
          } catch {
          // Browser blocked autoplay — user hasn't interacted recently enough
          // Don't treat as error: just mark as "ready to play" so replay button appears
            setIsPlaying(false);
            setHasPlayed(true); // Show replay button so user can tap to play
            posthog?.capture('tts_autoplay_blocked', { voice, text_length: truncatedText.length });
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'TTS failed';
      setError(msg);
      setAudioDurationSeconds(null);
      posthog?.capture('tts_silent_failure', { voice, text_length: truncatedText.length, error: msg });
      onError?.(msg);
    } finally {
      setIsLoading(false);
    }
  }, [
    voice,
    practiceLanguage,
    autoPlay,
    posthog,
    onError,
    handlePlaybackStart,
    handlePlaybackCompleted,
    handlePlaybackSkipped,
    playDecodedAudio,
  ]);

  const stop = useCallback(() => {
    if (webAudioSourceRef.current) {
      webAudioStopReasonRef.current = "manual";
      stopWebAudioSource(webAudioSourceRef.current);
      setIsPlaying(false);
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
    }
  }, []);

  const replay = useCallback(() => {
    if (decodedAudioRef.current) {
      setHasPlayed(false);
      void playDecodedAudio(decodedAudioRef.current).then((played) => {
        if (!played) {
          setHasPlayed(true);
        }
      });

      posthog?.capture('tts_replay', { voice });
      return;
    }

    if (audioRef.current && blobUrlRef.current) {
      audioRef.current.currentTime = 0;
      setHasPlayed(false);
      audioRef.current.play().catch(() => {
        setHasPlayed(true);
      });

      posthog?.capture('tts_replay', { voice });
    }
  }, [voice, posthog, playDecodedAudio]);

  return {
    speak,
    stop,
    replay,
    isLoading,
    isPlaying,
    hasPlayed,
    error,
    latencyMs,
    audioDurationSeconds,
  };
}
