import "server-only";

import { sanitizeTelemetryItem, sanitizeTelemetryString, stripUrlQuery } from "./faro-sanitize";

const APP_NAME = "thinkfy-web";
const DEFAULT_RELEASE = "development";
const DEFAULT_ENVIRONMENT = "development";
export const SERVER_FARO_TIMEOUT_MS = 1_500;

const SOURCE_HASH_PATTERN = /^chat-request-failed:[A-Za-z0-9_.:-]{1,80}$/;
const SAFE_VALUE_PATTERN = /^[A-Za-z0-9_.:/-]{1,120}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type ServerFaroEnvironment = Record<string, string | undefined>;

export type ServerFaroConfig = {
  url: string;
  release: string;
  environment: string;
};

export type ServerFaroExceptionInput = {
  requestId: string;
  stage: string;
  featureArea: string;
  route: string;
  sourceHash: string;
};

export type ServerFaroFetch = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

function safeValue(value: string, fallback: string) {
  const sanitized = sanitizeTelemetryString(value).trim();
  return SAFE_VALUE_PATTERN.test(sanitized) ? sanitized : fallback;
}

export function getServerFaroConfig(
  env: ServerFaroEnvironment = process.env,
): ServerFaroConfig | null {
  const rawUrl = env.NEXT_PUBLIC_GRAFANA_FARO_COLLECTOR_URL?.trim();
  if (!rawUrl) return null;

  try {
    const url = new URL(rawUrl);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      return null;
    }

    return {
      url: url.toString(),
      release:
        safeValue(
          env.NEXT_PUBLIC_APP_RELEASE_SHA ??
            env.VERCEL_GIT_COMMIT_SHA ??
            DEFAULT_RELEASE,
          DEFAULT_RELEASE,
        ),
      environment: safeValue(
        env.NEXT_PUBLIC_APP_ENV ??
          env.NEXT_PUBLIC_VERCEL_ENV ??
          env.VERCEL_ENV ??
          env.NODE_ENV ??
          DEFAULT_ENVIRONMENT,
        DEFAULT_ENVIRONMENT,
      ),
    };
  } catch {
    return null;
  }
}

function boundedContextValue(value: string, fallback: string) {
  const sanitized = sanitizeTelemetryString(value)
    .trim()
    .split(/[?#]/, 1)[0]
    ?.slice(0, 200) ?? "";
  return sanitized.slice(0, 200) || fallback;
}

export async function emitServerFaroException(
  input: ServerFaroExceptionInput,
  env: ServerFaroEnvironment = process.env,
  fetchImpl: ServerFaroFetch = fetch,
): Promise<void> {
  const config = getServerFaroConfig(env);
  if (!config || !SOURCE_HASH_PATTERN.test(input.sourceHash)) return;

  const sessionId = crypto.randomUUID();
  const payload = sanitizeTelemetryItem({
    meta: {
      sdk: {
        name: "thinkfy-server",
        version: "1.0.0",
      },
      app: {
        name: APP_NAME,
        environment: config.environment,
        version: config.release,
        release: config.release,
        gitHash: config.release,
        bundleId: config.release,
      },
      service: { name: APP_NAME },
      session: { id: sessionId },
    },
    exceptions: [
      {
        type: "chat_request",
        value: "Chat request failed",
        timestamp: new Date().toISOString(),
        fingerprint: input.sourceHash,
        context: {
          incidentFingerprint: input.sourceHash,
          requestId: UUID_PATTERN.test(input.requestId)
            ? input.requestId
            : "unavailable",
          stage: boundedContextValue(input.stage, "unknown"),
          featureArea: boundedContextValue(input.featureArea, "ai-coach"),
          route: stripUrlQuery(
            boundedContextValue(input.route, "/api/chat"),
          ),
        },
      },
    ],
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    SERVER_FARO_TIMEOUT_MS,
  );

  try {
    const response = await fetchImpl(config.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Faro-Session-Id": sessionId,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (response.status !== 202) return;
  } catch {
    // Observability must never change the chat response or stream semantics.
  } finally {
    clearTimeout(timeoutId);
  }
}
