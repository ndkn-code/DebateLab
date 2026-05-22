"use client";

import { useId } from "react";
import type { ReactNode } from "react";
import { Minus, Plus } from "@/components/ui/icons";
import {
  clampDurationSeconds,
  formatDurationLabel,
  getDurationProgress,
  minutesToSeconds,
  secondsToMinutes,
  type DurationConfig,
} from "@/lib/practice-durations";
import { cn } from "@/lib/utils";

interface DurationControlProps {
  label: string;
  value: number;
  config: DurationConfig;
  onChange: (seconds: number) => void;
  icon?: ReactNode;
  helper?: string;
  className?: string;
  compact?: boolean;
}

export function DurationControl({
  label,
  value,
  config,
  onChange,
  icon,
  helper,
  className,
  compact = false,
}: DurationControlProps) {
  const boundedValue = clampDurationSeconds(value, config);
  const minutes = secondsToMinutes(boundedValue);
  const progress = getDurationProgress(boundedValue, config);
  const minMinutes = secondsToMinutes(config.minSeconds);
  const maxMinutes = secondsToMinutes(config.maxSeconds);
  const inputId = useId();

  function commit(nextSeconds: number) {
    onChange(clampDurationSeconds(nextSeconds, config));
  }

  return (
    <div
      className={cn(
        "rounded-lg border border-[#DEE8F8] bg-white p-3 sm:p-4",
        compact ? "space-y-3" : "space-y-4",
        className
      )}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#162033]">
          {icon ? <span className="text-[#4D86F7]">{icon}</span> : null}
          <span>{label}</span>
        </div>
        {helper ? (
          <p className="mt-1 text-xs leading-5 text-[#718096]">{helper}</p>
        ) : null}
      </div>

      <div className="grid grid-cols-2 items-center gap-2 sm:grid-cols-[40px_minmax(0,1fr)_40px]">
        <button
          type="button"
          onClick={() => commit(boundedValue - config.stepSeconds)}
          disabled={boundedValue <= config.minSeconds}
          className="flex h-9 w-full items-center justify-center rounded-md border border-[#DEE8F8] bg-[#F7FAFE] text-[#415069] transition-colors hover:bg-[#EEF4FF] disabled:cursor-not-allowed disabled:opacity-45 sm:h-10 sm:w-10"
          aria-label={`Decrease ${label}`}
        >
          <Minus className="h-4 w-4" />
        </button>

        <label className="sr-only" htmlFor={inputId}>
          {label} minutes
        </label>
        <div className="order-first col-span-2 flex h-9 min-w-0 items-center rounded-md border border-[#DEE8F8] bg-white px-3 focus-within:border-[#4D86F7] focus-within:ring-2 focus-within:ring-[#A9C6FB]/45 sm:order-none sm:col-span-1 sm:h-10">
          <input
            id={inputId}
            type="number"
            min={minMinutes}
            max={maxMinutes}
            step={config.stepSeconds / 60}
            value={minutes}
            onChange={(event) =>
              commit(minutesToSeconds(Number(event.currentTarget.value), config))
            }
            className="min-w-0 flex-1 bg-transparent text-center text-base font-semibold text-[#0B1424] outline-none"
          />
          <span className="ml-2 text-xs font-medium text-[#718096]">min</span>
        </div>

        <button
          type="button"
          onClick={() => commit(boundedValue + config.stepSeconds)}
          disabled={boundedValue >= config.maxSeconds}
          className="flex h-9 w-full items-center justify-center rounded-md border border-[#DEE8F8] bg-[#F7FAFE] text-[#415069] transition-colors hover:bg-[#EEF4FF] disabled:cursor-not-allowed disabled:opacity-45 sm:h-10 sm:w-10"
          aria-label={`Increase ${label}`}
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <div className="h-1.5 overflow-hidden rounded-full bg-[#E8F0FD]">
        <div
          className="h-full rounded-full bg-[#4D86F7] transition-[width] duration-200"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {config.presetSeconds.map((preset) => {
          const active = preset === boundedValue;
          return (
            <button
              key={preset}
              type="button"
              onClick={() => commit(preset)}
              className={cn(
                "rounded-md border px-2.5 py-1.5 text-xs font-semibold transition-colors",
                active
                  ? "border-[#4D86F7] bg-[#EEF4FF] text-[#3E78EC]"
                  : "border-[#DEE8F8] bg-[#F7FAFE] text-[#415069] hover:bg-[#EEF4FF]"
              )}
            >
              {formatDurationLabel(preset)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
