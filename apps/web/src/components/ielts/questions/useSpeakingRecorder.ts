"use client";

/**
 * Microphone recorder for the in-mock Speaking surface (WS-5.2).
 *
 * Captures with MediaRecorder (webm/opus, or mp4 on Safari), then decodes and
 * resamples to 16 kHz mono in the browser (Web Audio) and encodes a WAV via the
 * pure {@link encodeWavPcm16}. The resulting WAV PCM 16 kHz mono is what STT and
 * Azure pronunciation assessment both require, so a real phoneme report comes
 * back end-to-end. The browser-only decode/resample lives here; the byte-level
 * WAV format is unit-tested in `lib/ielts/audio`.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  encodeWavPcm16,
  IELTS_PRONUNCIATION_SAMPLE_RATE,
} from "@/lib/ielts/audio/wav-encoder";

export type RecorderStatus =
  | "idle"
  | "recording"
  | "processing"
  | "ready"
  | "error";
export type RecorderErrorCode = "mic_denied" | "no_audio" | "encode_failed";

export interface RecorderResult {
  /** WAV PCM 16 kHz mono blob, ready to upload + assess. */
  wav: Blob;
  /** Object URL for in-page playback (revoked on reset/unmount). */
  playbackUrl: string;
  durationSeconds: number;
}

const CANDIDATE_MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
];

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return CANDIDATE_MIME_TYPES.find((type) =>
    MediaRecorder.isTypeSupported(type),
  );
}

type AudioContextCtor = typeof AudioContext;
type OfflineAudioContextCtor = typeof OfflineAudioContext;

function getAudioContextCtor(): AudioContextCtor | null {
  const scope = window as typeof window & {
    webkitAudioContext?: AudioContextCtor;
  };
  return window.AudioContext ?? scope.webkitAudioContext ?? null;
}

function getOfflineAudioContextCtor(): OfflineAudioContextCtor | null {
  const scope = window as typeof window & {
    webkitOfflineAudioContext?: OfflineAudioContextCtor;
  };
  return window.OfflineAudioContext ?? scope.webkitOfflineAudioContext ?? null;
}

function decodeAudioDataCompat(
  ctx: AudioContext,
  data: ArrayBuffer,
): Promise<AudioBuffer> {
  return new Promise((resolve, reject) => {
    const maybe = ctx.decodeAudioData(data, resolve, reject);
    if (maybe && typeof maybe.then === "function") maybe.then(resolve, reject);
  });
}

/** Decode any captured container to a 16 kHz mono Float32 PCM track. */
async function decodeToMono16k(
  blob: Blob,
): Promise<{ samples: Float32Array; durationSeconds: number }> {
  const AudioCtx = getAudioContextCtor();
  const OfflineCtx = getOfflineAudioContextCtor();
  if (!AudioCtx || !OfflineCtx) throw new Error("Web Audio unavailable");

  const arrayBuffer = await blob.arrayBuffer();
  const ctx = new AudioCtx();
  let decoded: AudioBuffer;
  try {
    decoded = await decodeAudioDataCompat(ctx, arrayBuffer);
  } finally {
    void ctx.close?.();
  }

  const frames = Math.ceil(decoded.duration * IELTS_PRONUNCIATION_SAMPLE_RATE);
  if (frames <= 0) return { samples: new Float32Array(0), durationSeconds: 0 };

  const offline = new OfflineCtx(1, frames, IELTS_PRONUNCIATION_SAMPLE_RATE);
  const source = offline.createBufferSource();
  source.buffer = decoded;
  source.connect(offline.destination);
  source.start();
  const rendered = await offline.startRendering();
  return {
    samples: rendered.getChannelData(0).slice(),
    durationSeconds: decoded.duration,
  };
}

export interface SpeakingRecorder {
  status: RecorderStatus;
  error: RecorderErrorCode | null;
  elapsedSeconds: number;
  result: RecorderResult | null;
  start: () => Promise<void>;
  stop: () => void;
  reset: () => void;
}

export function useSpeakingRecorder(): SpeakingRecorder {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [error, setError] = useState<RecorderErrorCode | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [result, setResult] = useState<RecorderResult | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const playbackUrlRef = useRef<string | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = null;
  }, []);

  const revokePlayback = useCallback(() => {
    if (playbackUrlRef.current) URL.revokeObjectURL(playbackUrlRef.current);
    playbackUrlRef.current = null;
  }, []);

  const handleStop = useCallback(
    async (mimeType: string) => {
      stopTracks();
      const blob = new Blob(chunksRef.current, { type: mimeType });
      chunksRef.current = [];
      setStatus("processing");
      try {
        const { samples, durationSeconds } = await decodeToMono16k(blob);
        if (samples.length === 0) {
          setError("no_audio");
          setStatus("error");
          return;
        }
        const wav = new Blob(
          [encodeWavPcm16(samples, IELTS_PRONUNCIATION_SAMPLE_RATE)],
          { type: "audio/wav" },
        );
        revokePlayback();
        const playbackUrl = URL.createObjectURL(wav);
        playbackUrlRef.current = playbackUrl;
        setResult({ wav, playbackUrl, durationSeconds });
        setStatus("ready");
      } catch {
        setError("encode_failed");
        setStatus("error");
      }
    },
    [revokePlayback, stopTracks],
  );

  const start = useCallback(async () => {
    setError(null);
    setResult(null);
    revokePlayback();
    setElapsedSeconds(0);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined,
      );
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        void handleStop(recorder.mimeType || mimeType || "audio/webm");
      };
      recorderRef.current = recorder;
      recorder.start();
      setStatus("recording");
      const startedAt = Date.now();
      tickRef.current = setInterval(() => {
        setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
      }, 250);
    } catch {
      stopTracks();
      setError("mic_denied");
      setStatus("error");
    }
  }, [handleStop, revokePlayback, stopTracks]);

  const stop = useCallback(() => {
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = null;
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
  }, []);

  const reset = useCallback(() => {
    revokePlayback();
    setResult(null);
    setError(null);
    setElapsedSeconds(0);
    setStatus("idle");
  }, [revokePlayback]);

  useEffect(() => {
    return () => {
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") recorder.stop();
      stopTracks();
      revokePlayback();
    };
  }, [revokePlayback, stopTracks]);

  return { status, error, elapsedSeconds, result, start, stop, reset };
}
