"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { stopMediaRecorderAndBuildBlob } from "@/lib/audio/media-recorder-stop";

/**
 * Audio recorder hook that accepts an external MediaStream (shared with Deepgram).
 * No longer calls getUserMedia itself — expects a stream to be passed in.
 */
export function useAudioRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioBlobRef = useRef<Blob | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const stopPromiseRef = useRef<Promise<Blob | null> | null>(null);

  const startRecording = useCallback((stream: MediaStream, reset = false) => {
    setError(null);
    try {
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      const recorder = new MediaRecorder(stream, { mimeType });
      if (reset) {
        chunksRef.current = [];
        audioBlobRef.current = null;
        setAudioBlob(null);
        if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = null;
        setAudioUrl(null);
      }
      stopPromiseRef.current = null;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        audioBlobRef.current = blob;
        setAudioBlob(blob);
        if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
        const url = URL.createObjectURL(blob);
        audioUrlRef.current = url;
        setAudioUrl(url);
        stopPromiseRef.current = Promise.resolve(blob);
        // NOTE: We do NOT stop stream tracks here — the shared mic hook owns the stream lifecycle
      };

      mediaRecorderRef.current = recorder;
      recorder.start(1000); // Collect chunks every 1s
      setIsRecording(true);
    } catch {
      setError("Failed to start recording. Please check your microphone.");
    }
  }, []);

  const stopRecording = useCallback((): Promise<Blob | null> => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      return stopPromiseRef.current ?? Promise.resolve(audioBlobRef.current);
    }
    if (stopPromiseRef.current) return stopPromiseRef.current;

    stopPromiseRef.current = stopMediaRecorderAndBuildBlob(
      recorder,
      chunksRef.current,
      recorder.mimeType
    );
    setIsRecording(false);
    return stopPromiseRef.current;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== "inactive"
      ) {
        mediaRecorderRef.current.stop();
      }
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
      }
    };
  }, []);

  return {
    isRecording,
    audioBlob,
    audioUrl,
    startRecording,
    stopRecording,
    error,
  };
}
