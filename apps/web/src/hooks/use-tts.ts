'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { usePostHog } from 'posthog-js/react';

export type TtsPlaybackState =
  | "idle"
  | "loading"
  | "ready"
  | "playing"
  | "paused"
  | "ended"
  | "error";

interface UseTTSOptions {
  voice?: string;
  practiceLanguage?: "en" | "vi";
  autoPlay?: boolean;
  onPlayStart?: () => void;
  onPlayEnd?: () => void;
  onError?: (error: string) => void;
}

interface UseTTSReturn {
  speak: (text: string) => Promise<boolean>;
  play: () => Promise<boolean>;
  pause: () => void;
  resume: () => Promise<boolean>;
  stop: () => void;
  replay: () => Promise<boolean>;
  playbackState: TtsPlaybackState;
  isLoading: boolean;
  isPlaying: boolean;
  isPaused: boolean;
  hasPlayed: boolean;
  canPlay: boolean;
  error: string | null;
  latencyMs: number | null;
  currentTimeSeconds: number;
  durationSeconds: number | null;
  audioDurationSeconds: number | null;
}

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

function getSafeDuration(audio: HTMLAudioElement) {
  return Number.isFinite(audio.duration) && audio.duration > 0
    ? audio.duration
    : null;
}

function waitForAudioReady(audio: HTMLAudioElement) {
  if (audio.readyState >= HTMLMediaElement.HAVE_METADATA) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve, reject) => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const cleanup = () => {
      if (timeoutId) clearTimeout(timeoutId);
      audio.removeEventListener("loadedmetadata", handleReady);
      audio.removeEventListener("canplay", handleReady);
      audio.removeEventListener("error", handleError);
    };

    const handleReady = () => {
      cleanup();
      resolve();
    };

    const handleError = () => {
      cleanup();
      reject(new Error("Audio playback failed"));
    };

    timeoutId = setTimeout(() => {
      cleanup();
      resolve();
    }, 2500);

    audio.addEventListener("loadedmetadata", handleReady);
    audio.addEventListener("canplay", handleReady);
    audio.addEventListener("error", handleError);
    audio.load();
  });
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

  const [playbackState, setPlaybackState] = useState<TtsPlaybackState>("idle");
  const [hasPlayed, setHasPlayed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [durationSeconds, setDurationSeconds] = useState<number | null>(null);
  const [currentTimeSeconds, setCurrentTimeSeconds] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const playStartTimeRef = useRef<number | null>(null);
  const hasPlayedRef = useRef(false);
  const wasReplayRef = useRef(false);
  const playbackTextLengthRef = useRef(0);
  const playbackLatencyMsRef = useRef<number | null>(null);
  const playbackAudioSizeRef = useRef(0);
  const posthog = usePostHog();

  useEffect(() => {
    hasPlayedRef.current = hasPlayed;
  }, [hasPlayed]);

  const cancelClock = useCallback(() => {
    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  const updateClock = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    setCurrentTimeSeconds(Number.isFinite(audio.currentTime) ? audio.currentTime : 0);
    setDurationSeconds(getSafeDuration(audio));

    if (!audio.paused && !audio.ended) {
      animationFrameRef.current = window.requestAnimationFrame(updateClock);
    }
  }, []);

  const startClock = useCallback(() => {
    cancelClock();
    animationFrameRef.current = window.requestAnimationFrame(updateClock);
  }, [cancelClock, updateClock]);

  const cleanupAudio = useCallback(() => {
    cancelClock();

    const audio = audioRef.current;
    if (audio) {
      audio.onloadedmetadata = null;
      audio.onplay = null;
      audio.onpause = null;
      audio.onended = null;
      audio.onerror = null;
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      audioRef.current = null;
    }

    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
  }, [cancelClock]);

  useEffect(() => cleanupAudio, [cleanupAudio]);

  const handlePlaybackStart = useCallback(() => {
    setPlaybackState("playing");
    setError(null);
    playStartTimeRef.current = Date.now();
    startClock();
    onPlayStart?.();
  }, [onPlayStart, startClock]);

  const handlePlaybackCompleted = useCallback(() => {
    cancelClock();
    setPlaybackState("ended");
    setHasPlayed(true);

    const audio = audioRef.current;
    setCurrentTimeSeconds(audio ? getSafeDuration(audio) ?? audio.currentTime : 0);
    setDurationSeconds(audio ? getSafeDuration(audio) : null);

    const listenDuration = playStartTimeRef.current
      ? Date.now() - playStartTimeRef.current
      : 0;

    posthog?.capture('tts_playback_completed', {
      voice,
      text_length: playbackTextLengthRef.current,
      listen_duration_ms: listenDuration,
      latency_ms: playbackLatencyMsRef.current,
      audio_size_bytes: playbackAudioSizeRef.current,
      was_replay: wasReplayRef.current,
    });

    wasReplayRef.current = false;
    onPlayEnd?.();
  }, [cancelClock, onPlayEnd, posthog, voice]);

  const handlePlaybackError = useCallback(
    (message = "Audio playback failed") => {
      cancelClock();
      setPlaybackState("error");
      setError(message);
      posthog?.capture('tts_playback_error', {
        voice,
        text_length: playbackTextLengthRef.current,
      });
      onError?.(message);
    },
    [cancelClock, onError, posthog, voice]
  );

  const play = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return false;

    try {
      void unlockTtsAutoplay();
      wasReplayRef.current =
        wasReplayRef.current || (hasPlayedRef.current && audio.currentTime === 0);
      await audio.play();
      return true;
    } catch {
      cancelClock();
      setPlaybackState("ready");
      setError(null);
      posthog?.capture('tts_autoplay_blocked', {
        voice,
        text_length: playbackTextLengthRef.current,
      });
      return false;
    }
  }, [cancelClock, posthog, voice]);

  const pause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || audio.paused || audio.ended) return;
    audio.pause();
    cancelClock();
    setCurrentTimeSeconds(Number.isFinite(audio.currentTime) ? audio.currentTime : 0);
    setDurationSeconds(getSafeDuration(audio));
    setPlaybackState("paused");
  }, [cancelClock]);

  const resume = useCallback(async () => play(), [play]);

  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) {
      setPlaybackState("idle");
      setCurrentTimeSeconds(0);
      return;
    }

    audio.pause();
    audio.currentTime = 0;
    cancelClock();
    setCurrentTimeSeconds(0);
    setDurationSeconds(getSafeDuration(audio));
    setPlaybackState("ready");
  }, [cancelClock]);

  const replay = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return false;

    audio.pause();
    audio.currentTime = 0;
    setCurrentTimeSeconds(0);
    setDurationSeconds(getSafeDuration(audio));
    setHasPlayed(false);
    hasPlayedRef.current = false;
    wasReplayRef.current = true;
    posthog?.capture('tts_replay', { voice });
    return play();
  }, [play, posthog, voice]);

  const speak = useCallback(async (text: string) => {
    const truncatedText = text.length > 5000 ? text.substring(0, 5000) : text;
    cleanupAudio();
    setPlaybackState("loading");
    setError(null);
    setLatencyMs(null);
    setDurationSeconds(null);
    setCurrentTimeSeconds(0);
    setHasPlayed(false);
    hasPlayedRef.current = false;
    wasReplayRef.current = false;

    const fetchStart = Date.now();

    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: truncatedText, voice, practiceLanguage }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'TTS failed' }));
        throw new Error(errData.error || `TTS request failed (${res.status})`);
      }

      const audioBlob = await res.blob();
      const headerLatency = Number(res.headers.get("X-TTS-Synthesis-Ms"));
      const latency = Number.isFinite(headerLatency)
        ? headerLatency
        : Date.now() - fetchStart;
      setLatencyMs(latency);
      playbackTextLengthRef.current = truncatedText.length;
      playbackLatencyMsRef.current = latency;
      playbackAudioSizeRef.current = audioBlob.size;

      const url = URL.createObjectURL(audioBlob);
      blobUrlRef.current = url;
      const audio = new Audio(url);
      audio.preload = "auto";
      audioRef.current = audio;

      audio.onloadedmetadata = () => {
        setDurationSeconds(getSafeDuration(audio));
      };

      audio.onplay = () => {
        handlePlaybackStart();
      };

      audio.onpause = () => {
        if (audio.ended) return;
        cancelClock();
        setCurrentTimeSeconds(Number.isFinite(audio.currentTime) ? audio.currentTime : 0);
        setDurationSeconds(getSafeDuration(audio));
        setPlaybackState("paused");
      };

      audio.onended = () => {
        handlePlaybackCompleted();
      };

      audio.onerror = () => {
        handlePlaybackError();
      };

      await waitForAudioReady(audio);
      setDurationSeconds(getSafeDuration(audio));
      setPlaybackState("ready");

      posthog?.capture('tts_generated', {
        voice,
        text_length: truncatedText.length,
        latency_ms: latency,
        audio_size_bytes: audioBlob.size,
      });

      if (!autoPlay) return true;
      return play();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'TTS failed';
      cleanupAudio();
      setPlaybackState("error");
      setError(msg);
      setDurationSeconds(null);
      setCurrentTimeSeconds(0);
      posthog?.capture('tts_silent_failure', {
        voice,
        text_length: truncatedText.length,
        error: msg,
      });
      onError?.(msg);
      return false;
    }
  }, [
    autoPlay,
    cancelClock,
    cleanupAudio,
    handlePlaybackCompleted,
    handlePlaybackError,
    handlePlaybackStart,
    onError,
    play,
    posthog,
    practiceLanguage,
    voice,
  ]);

  const canPlay =
    playbackState === "ready" ||
    playbackState === "paused" ||
    playbackState === "ended";

  return {
    speak,
    play,
    pause,
    resume,
    stop,
    replay,
    playbackState,
    isLoading: playbackState === "loading",
    isPlaying: playbackState === "playing",
    isPaused: playbackState === "paused",
    hasPlayed,
    canPlay,
    error,
    latencyMs,
    currentTimeSeconds,
    durationSeconds,
    audioDurationSeconds: durationSeconds,
  };
}
