'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { usePostHog } from 'posthog-js/react';

interface UseTTSOptions {
  voice?: string;
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
}

export function useTTS(options: UseTTSOptions = {}): UseTTSReturn {
  const {
    voice = 'aura-asteria-en',
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

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const playStartTimeRef = useRef<number | null>(null);
  const hasPlayedRef = useRef(false);
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
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
      }
    };
  }, []);

  const speak = useCallback(async (text: string) => {
    setIsLoading(true);
    setError(null);
    const fetchStart = Date.now();

    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'TTS failed' }));
        throw new Error(errData.error || 'TTS request failed');
      }

      const audioBlob = await res.blob();
      const latency = Date.now() - fetchStart;
      setLatencyMs(latency);

      // Clean up previous blob URL
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);

      const url = URL.createObjectURL(audioBlob);
      blobUrlRef.current = url;

      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onplay = () => {
        setIsPlaying(true);
        playStartTimeRef.current = Date.now();
        onPlayStart?.();
      };

      audio.onended = () => {
        setIsPlaying(false);
        setHasPlayed(true);
        const listenDuration = playStartTimeRef.current
          ? Date.now() - playStartTimeRef.current
          : 0;

        posthog?.capture('tts_playback_completed', {
          voice,
          text_length: text.length,
          listen_duration_ms: listenDuration,
          latency_ms: latency,
          audio_size_bytes: audioBlob.size,
          was_replay: hasPlayedRef.current,
        });

        onPlayEnd?.();
      };

      audio.onpause = () => {
        if (!audio.ended) {
          setIsPlaying(false);
          const listenDuration = playStartTimeRef.current
            ? Date.now() - playStartTimeRef.current
            : 0;

          posthog?.capture('tts_playback_skipped', {
            voice,
            text_length: text.length,
            listen_duration_ms: listenDuration,
            skip_point: audio.currentTime,
            total_duration: audio.duration,
          });
        }
      };

      audio.onerror = () => {
        setIsPlaying(false);
        setError('Audio playback failed');
        posthog?.capture('tts_playback_error', { voice, text_length: text.length });
        onError?.('Audio playback failed');
      };

      // PostHog: TTS generated
      posthog?.capture('tts_generated', {
        voice,
        text_length: text.length,
        latency_ms: latency,
        audio_size_bytes: audioBlob.size,
      });

      if (autoPlay) {
        await audio.play();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'TTS failed';
      setError(msg);
      posthog?.capture('tts_generation_error', { voice, error: msg });
      onError?.(msg);
    } finally {
      setIsLoading(false);
    }
  }, [voice, autoPlay, posthog, onPlayStart, onPlayEnd, onError]);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
    }
  }, []);

  const replay = useCallback(() => {
    if (audioRef.current && blobUrlRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play();

      posthog?.capture('tts_replay', { voice });
    }
  }, [voice, posthog]);

  return { speak, stop, replay, isLoading, isPlaying, hasPlayed, error, latencyMs };
}
