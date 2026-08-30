import "server-only";

export type AiGradingBackend = "gcp" | "legacy";

export class AiGradingConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiGradingConfigurationError";
  }
}

export class AiGradingPausedError extends Error {
  constructor() {
    super(
      "AI grading is paused by the legacy kill switch; the saved job was not published.",
    );
    this.name = "AiGradingPausedError";
  }
}

/** Missing or unknown configuration must never silently select a provider. */
export function getAiGradingBackend(): AiGradingBackend {
  const value = process.env.AI_GRADING_BACKEND?.trim();
  if (value === "gcp" || value === "legacy") return value;
  throw new AiGradingConfigurationError(
    "AI_GRADING_BACKEND must be set explicitly to gcp or legacy.",
  );
}

export function isGcpAiGradingEnabled(): boolean {
  return getAiGradingBackend() === "gcp";
}
