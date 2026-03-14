"use client";

import { useState, useRef, useCallback, useEffect } from "react";

/**
 * Shared microphone hook — provides a single MediaStream
 * that can be consumed by transcription, recording, and visualization.
 */
export function useMicrophone() {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const start = useCallback(async () => {
    setError(null);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      streamRef.current = mediaStream;
      setStream(mediaStream);
      setIsActive(true);
      console.log("[Microphone] Stream started");
      return mediaStream;
    } catch (err) {
      if (err instanceof DOMException) {
        if (err.name === "NotAllowedError") {
          setError("not-allowed");
        } else if (err.name === "NotFoundError") {
          setError("audio-capture");
        } else {
          setError(`Microphone error: ${err.message}`);
        }
      } else {
        setError("Failed to access microphone");
      }
      console.error("[Microphone] Failed to start:", err);
      return null;
    }
  }, []);

  const stop = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setStream(null);
      setIsActive(false);
      console.log("[Microphone] Stream stopped");
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  return {
    stream,
    isActive,
    error,
    start,
    stop,
  };
}
