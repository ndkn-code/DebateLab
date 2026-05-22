"use client";

import { useEffect, useRef, useState } from "react";

interface AudioVisualizerProps {
  stream: MediaStream | null;
  isRecording: boolean;
}

const BAR_COUNT = 32;
const EMPTY_LEVELS = Array(BAR_COUNT).fill(0);

export function AudioVisualizer({ stream, isRecording }: AudioVisualizerProps) {
  const [levels, setLevels] = useState<number[]>(EMPTY_LEVELS);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!stream || !isRecording) {
      return;
    }

    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 128;
    analyser.smoothingTimeConstant = 0.8;

    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);

    audioContextRef.current = audioContext;
    analyserRef.current = analyser;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const tick = () => {
      analyser.getByteFrequencyData(dataArray);

      // Sample bars evenly from frequency data
      const step = Math.floor(dataArray.length / BAR_COUNT);
      const newLevels = Array.from({ length: BAR_COUNT }, (_, i) => {
        const value = dataArray[i * step] ?? 0;
        return value / 255;
      });

      setLevels(newLevels);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      source.disconnect();
      audioContext.close();
    };
  }, [stream, isRecording]);

  return (
    <div className="flex h-16 items-end justify-center gap-[3px]">
      {(stream && isRecording ? levels : EMPTY_LEVELS).map((level, i) => (
        <div
          key={i}
          className="w-1.5 rounded-full bg-primary transition-all duration-75"
          style={{
            height: `${Math.max(4, level * 64)}px`,
            opacity: isRecording ? 0.4 + level * 0.6 : 0.15,
          }}
        />
      ))}
    </div>
  );
}
