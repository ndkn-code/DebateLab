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
        "rounded-lg border border-outline-variant bg-white p-3 dark:border-outline-variant/70 dark:bg-surface-container-lowest sm:p-4",
        compact ? "space-y-3" : "space-y-4",
        className
      )}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-sm font-semibold text-on-surface dark:text-on-surface">
          {icon ? <span className="text-primary dark:text-primary">{icon}</span> : null}
          <span>{label}</span>
        </div>
        {helper ? (
          <p className="mt-1 text-xs leading-5 text-on-surface-variant dark:text-on-surface-variant">{helper}</p>
        ) : null}
      </div>

      <div className="grid grid-cols-2 items-center gap-2 sm:grid-cols-[40px_minmax(0,1fr)_40px]">
        <button
          type="button"
          onClick={() => commit(boundedValue - config.stepSeconds)}
          disabled={boundedValue <= config.minSeconds}
          className="flex h-9 w-full items-center justify-center rounded-md border border-outline-variant bg-background text-on-surface-variant transition-colors hover:bg-primary-container disabled:cursor-not-allowed disabled:opacity-45 dark:border-outline-variant/70 dark:bg-surface-container dark:text-on-surface-variant dark:hover:bg-surface-container-high sm:h-10 sm:w-10"
          aria-label={`Decrease ${label}`}
        >
          <Minus className="h-4 w-4" />
        </button>

        <label className="sr-only" htmlFor={inputId}>
          {label} minutes
        </label>
        <div className="order-first col-span-2 flex h-9 min-w-0 items-center rounded-md border border-outline-variant bg-white px-3 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary-fixed/45 dark:border-outline-variant/70 dark:bg-surface-container-lowest sm:order-none sm:col-span-1 sm:h-10">
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
            className="min-w-0 flex-1 bg-transparent text-center text-base font-semibold text-on-surface outline-none dark:text-on-surface"
          />
          <span className="ml-2 text-xs font-medium text-on-surface-variant dark:text-on-surface-variant">min</span>
        </div>

        <button
          type="button"
          onClick={() => commit(boundedValue + config.stepSeconds)}
          disabled={boundedValue >= config.maxSeconds}
          className="flex h-9 w-full items-center justify-center rounded-md border border-outline-variant bg-background text-on-surface-variant transition-colors hover:bg-primary-container disabled:cursor-not-allowed disabled:opacity-45 dark:border-outline-variant/70 dark:bg-surface-container dark:text-on-surface-variant dark:hover:bg-surface-container-high sm:h-10 sm:w-10"
          aria-label={`Increase ${label}`}
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <div className="h-1.5 overflow-hidden rounded-full bg-surface-container dark:bg-outline-variant">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-200"
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
                  ? "border-primary bg-primary-container text-primary-dim dark:border-primary dark:bg-primary-container dark:text-primary"
                  : "border-outline-variant bg-background text-on-surface-variant hover:bg-primary-container dark:border-outline-variant/70 dark:bg-surface-container dark:text-on-surface-variant dark:hover:bg-surface-container-high"
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
