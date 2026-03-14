"use client";

import { useEffect, useRef, useState } from "react";

interface AudioVisualizerProps {
  stream: MediaStream | null;
  isRecording: boolean;
}

const BAR_COUNT = 32;

export function AudioVisualizer({ stream, isRecording }: AudioVisualizerProps) {
  const [levels, setLevels] = useState<number[]>(new Array(BAR_COUNT).fill(0));
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!stream || !isRecording) {
      setLevels(new Array(BAR_COUNT).fill(0));
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
      {levels.map((level, i) => (
        <div
          key={i}
          className="w-1.5 rounded-full bg-gradient-to-t from-blue-500 to-purple-500 transition-all duration-75"
          style={{
            height: `${Math.max(4, level * 64)}px`,
            opacity: isRecording ? 0.4 + level * 0.6 : 0.15,
          }}
        />
      ))}
    </div>
  );
}
