import "server-only";

import { getGeminiApiKeys, runWithGeminiKeyPool } from "@/lib/gemini/key-pool";
import {
  GEMINI_LIVE_TRANSCRIPTION_MODEL,
  GEMINI_LIVE_TRANSCRIPTION_MODEL_RESOURCE,
} from "./gemini-live-contract";

const GEMINI_AUTH_TOKEN_URL =
  "https://generativelanguage.googleapis.com/v1beta/auth_tokens";
const NEW_SESSION_TTL_MS = 60_000;
// Live transcription sessions are capped at ten minutes. One extra minute
// avoids expiry during orderly stream finalization without issuing a broad token.
const TOKEN_TTL_MS = 11 * 60_000;

interface GeminiAuthTokenResponse {
  name?: unknown;
}

export interface GeminiLiveBenchmarkToken {
  accessToken: string;
  authScheme: "token";
  model: typeof GEMINI_LIVE_TRANSCRIPTION_MODEL;
  expiresAt: string;
  newSessionExpiresAt: string;
}

export class GeminiLiveTokenProvisionError extends Error {
  readonly status: number;

  constructor(status: number, code: string) {
    super(code);
    this.name = "GeminiLiveTokenProvisionError";
    this.status = status;
  }
}

function parseTokenName(body: string) {
  try {
    const parsed = JSON.parse(body) as GeminiAuthTokenResponse;
    return typeof parsed.name === "string" && parsed.name.length > 0
      ? parsed.name
      : null;
  } catch {
    return null;
  }
}

export async function provisionGeminiLiveBenchmarkToken(params: {
  seed: string;
  fetchImpl?: typeof fetch;
  now?: () => number;
}): Promise<GeminiLiveBenchmarkToken> {
  const fetchImpl = params.fetchImpl ?? fetch;
  const now = params.now?.() ?? Date.now();
  const expiresAt = new Date(now + TOKEN_TTL_MS).toISOString();
  const newSessionExpiresAt = new Date(now + NEW_SESSION_TTL_MS).toISOString();

  return runWithGeminiKeyPool({
    seed: params.seed,
    run: async (attempt) => {
      const apiKey = getGeminiApiKeys()[attempt.slot];
      if (!apiKey) {
        throw new GeminiLiveTokenProvisionError(
          500,
          "GEMINI_LIVE_KEY_SLOT_UNAVAILABLE",
        );
      }
      const response = await fetchImpl(GEMINI_AUTH_TOKEN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          uses: 1,
          expireTime: expiresAt,
          newSessionExpireTime: newSessionExpiresAt,
          liveConnectConstraints: {
            model: GEMINI_LIVE_TRANSCRIPTION_MODEL_RESOURCE,
            config: {
              responseModalities: ["TEXT"],
              inputAudioTranscription: {
                languageCodes: [],
                mode: "VERBATIM",
              },
            },
          },
        }),
        cache: "no-store",
      });
      const responseBody = await response.text();
      if (!response.ok) {
        // Do not include the provider body: it can echo credential metadata.
        throw new GeminiLiveTokenProvisionError(
          response.status,
          "GEMINI_LIVE_AUTH_TOKEN_REQUEST_FAILED",
        );
      }
      const accessToken = parseTokenName(responseBody);
      if (!accessToken) {
        throw new GeminiLiveTokenProvisionError(
          502,
          "GEMINI_LIVE_AUTH_TOKEN_MISSING",
        );
      }
      return {
        accessToken,
        authScheme: "token",
        model: GEMINI_LIVE_TRANSCRIPTION_MODEL,
        expiresAt,
        newSessionExpiresAt,
      };
    },
  });
}
