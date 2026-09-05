"use client";

import { useState, useCallback, useEffect } from "react";
import { AudioRecorderController } from "@/lib/audio/audio-recorder-controller";

/**
 * Audio recorder hook that accepts an externally owned MediaStream.
 */
export function useAudioRecorder(initialBlob: Blob | null = null) {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(initialBlob);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [controller] = useState(
    () =>
      new AudioRecorderController(
        {
          onBlob: (blob) => {
            setAudioBlob(blob);
          },
          onError: (message) => setError(message),
          onRecordingChange: (recording) => setIsRecording(recording),
        },
        undefined,
        initialBlob,
      ),
  );

  useEffect(() => {
    if (!audioBlob) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- URL state mirrors an external object URL.
      setAudioUrl(null);
      return;
    }
    const url = URL.createObjectURL(audioBlob);
    setAudioUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [audioBlob]);

  const startRecording = useCallback(
    (stream: MediaStream, reset = false): boolean => {
      return controller.start(stream, reset);
    },
    [controller],
  );

  const stopRecording = useCallback((): Promise<Blob | null> => {
    return controller.stop();
  }, [controller]);

  // Cleanup on unmount
  useEffect(() => {
    controller.activate();
    return () => {
      controller.dispose();
    };
  }, [controller]);

  return {
    isRecording,
    audioBlob,
    audioUrl,
    startRecording,
    stopRecording,
    error,
  };
}
