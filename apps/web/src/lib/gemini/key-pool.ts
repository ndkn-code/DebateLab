import { createHash } from "node:crypto";
import { GoogleGenerativeAI } from "@google/generative-ai";

const geminiClients = new Map<string, GoogleGenerativeAI>();
const geminiKeyCooldowns = new Map<number, GeminiKeyCooldown>();

const RATE_LIMIT_COOLDOWN_MS = 65_000;
const SERVICE_UNAVAILABLE_COOLDOWN_MS = 20_000;
const ACCESS_DENIED_COOLDOWN_MS = 30 * 60_000;

export type GeminiKeyErrorKind =
  | "rate_limit"
  | "service_unavailable"
  | "access_denied"
  | "other";

export interface GeminiKeyCooldown {
  slot: number;
  until: number;
  reason: GeminiKeyErrorKind;
  message: string;
  failureCount: number;
}

export interface GeminiKeyAttempt {
  slot: number;
  fallbackCount: number;
  skippedCooldownCount: number;
  skippedCooldownSlots: number[];
}

export class GeminiKeyPoolUnavailableError extends Error {
  retryAfterMs: number;
  keyCount: number;
  cooldowns: GeminiKeyCooldown[];

  constructor(params: {
    retryAfterMs: number;
    keyCount: number;
    cooldowns: GeminiKeyCooldown[];
  }) {
    super(
      `All Gemini key slots are cooling down. Retry after ${Math.ceil(
        params.retryAfterMs / 1000
      )}s.`
    );
    this.name = "GeminiKeyPoolUnavailableError";
    this.retryAfterMs = params.retryAfterMs;
    this.keyCount = params.keyCount;
    this.cooldowns = params.cooldowns;
  }
}

export function getGeminiApiKeys() {
  const pooledKeys =
    process.env.GEMINI_API_KEYS?.split(",")
      .map((key) => key.trim())
      .filter(Boolean) ?? [];
  const singleKey = process.env.GEMINI_API_KEY?.trim();
  const keys = pooledKeys.length > 0 ? pooledKeys : singleKey ? [singleKey] : [];
  return Array.from(new Set(keys));
}

export function getGeminiKeyCountForTelemetry() {
  return getGeminiApiKeys().length || 0;
}

export function getGeminiClientForApiKey(apiKey: string) {
  const key = apiKey.trim();
  const configured = getGeminiApiKeys().length > 0;
  if (!key || !configured) {
    throw new Error("GEMINI_API_KEY or GEMINI_API_KEYS is not configured");
  }
  const existing = geminiClients.get(key);
  if (existing) return existing;
  const client = new GoogleGenerativeAI(key);
  geminiClients.set(key, client);
  return client;
}

export function getGeminiClientForSlot(slot: number) {
  const keys = getGeminiApiKeys();
  const apiKey = keys[slot];
  if (!apiKey) {
    throw new Error(`Gemini key slot ${slot} is not configured`);
  }
  return getGeminiClientForApiKey(apiKey);
}

export function hashStringToNumber(value: string) {
  const digest = createHash("sha256").update(value).digest("hex").slice(0, 8);
  return Number.parseInt(digest, 16) || 0;
}

export function getGeminiKeySlot(seed: string, keyCount: number) {
  if (keyCount <= 1) return 0;
  return hashStringToNumber(seed) % keyCount;
}

function getErrorStatus(error: unknown) {
  const source = error as { status?: number; code?: number; message?: string };
  return source?.status ?? source?.code ?? null;
}

function getErrorMessage(error: unknown) {
  const source = error as { message?: string };
  return error instanceof Error ? error.message : String(source?.message ?? error);
}

export function classifyGeminiError(error: unknown): GeminiKeyErrorKind {
  const status = getErrorStatus(error);
  const message = getErrorMessage(error);
  if (
    status === 429 ||
    /429|quota|rate.?limit|resource_exhausted|too many requests/i.test(message)
  ) {
    return "rate_limit";
  }
  if (
    status === 503 ||
    /503|high demand|temporarily unavailable|service unavailable|unavailable/i.test(
      message
    )
  ) {
    return "service_unavailable";
  }
  if (
    status === 403 ||
    /403|denied access|permission denied|api key not valid|forbidden/i.test(
      message
    )
  ) {
    return "access_denied";
  }
  return "other";
}

export function isGeminiQuotaOrRateLimitError(error: unknown) {
  return classifyGeminiError(error) === "rate_limit";
}

export function shouldTryNextGeminiKey(error: unknown) {
  return classifyGeminiError(error) !== "other";
}

function getCooldownMs(kind: GeminiKeyErrorKind) {
  switch (kind) {
    case "rate_limit":
      return RATE_LIMIT_COOLDOWN_MS;
    case "service_unavailable":
      return SERVICE_UNAVAILABLE_COOLDOWN_MS;
    case "access_denied":
      return ACCESS_DENIED_COOLDOWN_MS;
    case "other":
      return 0;
  }
}

function activeCooldown(slot: number, now = Date.now()) {
  const cooldown = geminiKeyCooldowns.get(slot);
  if (!cooldown) return null;
  if (cooldown.until <= now) {
    geminiKeyCooldowns.delete(slot);
    return null;
  }
  return cooldown;
}

export function getGeminiKeyCooldowns(now = Date.now()) {
  return Array.from(geminiKeyCooldowns.values())
    .filter((cooldown) => cooldown.until > now)
    .sort((a, b) => a.slot - b.slot);
}

export function recordGeminiKeySuccess(slot: number) {
  geminiKeyCooldowns.delete(slot);
}

export function recordGeminiKeyFailure(slot: number, error: unknown) {
  const kind = classifyGeminiError(error);
  const cooldownMs = getCooldownMs(kind);
  if (cooldownMs <= 0) {
    return null;
  }

  const previous = geminiKeyCooldowns.get(slot);
  const message = getErrorMessage(error).slice(0, 500);
  const cooldown: GeminiKeyCooldown = {
    slot,
    until: Date.now() + cooldownMs,
    reason: kind,
    message,
    failureCount: (previous?.failureCount ?? 0) + 1,
  };
  geminiKeyCooldowns.set(slot, cooldown);
  return cooldown;
}

export function selectGeminiKeyAttempts(seed: string): GeminiKeyAttempt[] {
  const keys = getGeminiApiKeys();
  if (keys.length === 0) {
    throw new Error("GEMINI_API_KEY or GEMINI_API_KEYS is not configured");
  }

  const startSlot = getGeminiKeySlot(seed, keys.length);
  const orderedSlots = Array.from(
    { length: keys.length },
    (_, offset) => (startSlot + offset) % keys.length
  );
  const now = Date.now();
  const cooldowns = orderedSlots
    .map((slot) => activeCooldown(slot, now))
    .filter((item): item is GeminiKeyCooldown => Boolean(item));
  const healthySlots = orderedSlots.filter((slot) => !activeCooldown(slot, now));
  if (healthySlots.length === 0) {
    const nextRetryAt = Math.min(...cooldowns.map((cooldown) => cooldown.until));
    throw new GeminiKeyPoolUnavailableError({
      keyCount: keys.length,
      cooldowns,
      retryAfterMs: Math.max(0, nextRetryAt - now),
    });
  }

  const skippedCooldownSlots = cooldowns.map((cooldown) => cooldown.slot);
  return healthySlots.map((slot, index) => ({
    slot,
    fallbackCount: index,
    skippedCooldownCount: skippedCooldownSlots.length,
    skippedCooldownSlots,
  }));
}

export async function runWithGeminiKeyPool<T>(params: {
  seed: string;
  run: (attempt: GeminiKeyAttempt) => Promise<T>;
  onError?: (
    error: unknown,
    attempt: GeminiKeyAttempt,
    cooldown: GeminiKeyCooldown | null
  ) => void | Promise<void>;
}) {
  const attempts = selectGeminiKeyAttempts(params.seed);
  let lastError: unknown = null;

  for (let index = 0; index < attempts.length; index += 1) {
    const attempt = attempts[index];
    try {
      const result = await params.run(attempt);
      recordGeminiKeySuccess(attempt.slot);
      return result;
    } catch (error) {
      lastError = error;
      const cooldown = recordGeminiKeyFailure(attempt.slot, error);
      try {
        await params.onError?.(error, attempt, cooldown);
      } catch {
        // Provider fallback should not be blocked by telemetry write failures.
      }
      if (!shouldTryNextGeminiKey(error) || index === attempts.length - 1) {
        throw error;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export function __resetGeminiKeyPoolForTests() {
  geminiKeyCooldowns.clear();
}
