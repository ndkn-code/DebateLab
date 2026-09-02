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
    super("AI grading is temporarily paused; no new scoring job was created.");
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

/**
 * Fail before metering or persistence when the durable grading backend is off.
 * `legacy` is a safety kill switch, not a second asynchronous scorer.
 */
export function requireGcpAiGradingForSubmission(): void {
  if (!isGcpAiGradingEnabled()) throw new AiGradingPausedError();
}
