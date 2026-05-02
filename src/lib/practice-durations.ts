export interface DurationConfig {
  minSeconds: number;
  maxSeconds: number;
  stepSeconds: number;
  defaultSeconds: number;
  presetSeconds: readonly number[];
}

export const SOLO_PREP_DURATION: DurationConfig = {
  minSeconds: 60,
  maxSeconds: 600,
  stepSeconds: 60,
  defaultSeconds: 180,
  presetSeconds: [60, 180, 300, 600],
};

export const SOLO_SPEECH_DURATION: DurationConfig = {
  minSeconds: 120,
  maxSeconds: 420,
  stepSeconds: 60,
  defaultSeconds: 180,
  presetSeconds: [120, 180, 240, 300, 420],
};

export const DUEL_PREP_DURATION: DurationConfig = {
  minSeconds: 60,
  maxSeconds: 600,
  stepSeconds: 60,
  defaultSeconds: 120,
  presetSeconds: [60, 120, 180, 300, 600],
};

export const DUEL_OPENING_DURATION: DurationConfig = {
  minSeconds: 120,
  maxSeconds: 420,
  stepSeconds: 60,
  defaultSeconds: 180,
  presetSeconds: [120, 180, 240, 300, 420],
};

export const DUEL_REBUTTAL_DURATION: DurationConfig = {
  minSeconds: 60,
  maxSeconds: 420,
  stepSeconds: 60,
  defaultSeconds: 120,
  presetSeconds: [60, 120, 180, 300, 420],
};

export function clampDurationSeconds(
  value: unknown,
  config: DurationConfig,
  fallback = config.defaultSeconds
) {
  const numericValue =
    typeof value === "number" && Number.isFinite(value) ? value : fallback;
  const stepped =
    Math.round(numericValue / config.stepSeconds) * config.stepSeconds;

  return Math.min(config.maxSeconds, Math.max(config.minSeconds, stepped));
}

export function minutesToSeconds(minutes: unknown, config: DurationConfig) {
  const numericMinutes =
    typeof minutes === "number" && Number.isFinite(minutes)
      ? minutes
      : config.defaultSeconds / 60;

  return clampDurationSeconds(numericMinutes * 60, config);
}

export function secondsToMinutes(seconds: number) {
  return Math.round(seconds / 60);
}

export function formatDurationLabel(seconds: number) {
  const minutes = seconds / 60;
  return Number.isInteger(minutes)
    ? `${minutes} min`
    : `${minutes.toFixed(1)} min`;
}

export function getDurationProgress(seconds: number, config: DurationConfig) {
  const bounded = clampDurationSeconds(seconds, config);
  const span = config.maxSeconds - config.minSeconds;
  if (span <= 0) return 100;
  return ((bounded - config.minSeconds) / span) * 100;
}
