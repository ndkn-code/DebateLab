import { NextRequest, NextResponse } from "next/server";
import { consumeRateLimit } from "@/lib/rate-limit";
import {
  requireRequestAuth,
  shouldConsumeUserRateLimit,
} from "@/lib/api/request-auth";

type DeepgramGrantResponse = {
  access_token?: string;
  expires_in?: number;
};

type DeepgramGrantError = {
  err_code?: string;
  err_msg?: string;
  error?: string;
  message?: string;
};

function createRequestId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `deepgram-token-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function logDeepgramToken(
  level: "info" | "warn" | "error",
  event: string,
  metadata: Record<string, unknown> = {}
) {
  const line = JSON.stringify({
    scope: "api/deepgram-token",
    event,
    ...metadata,
  });

  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.info(line);
  }
}

function parseJsonSafely<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function summarizeDeepgramError(body: string) {
  const parsed = parseJsonSafely<DeepgramGrantError>(body);
  return {
    errCode: parsed?.err_code ?? parsed?.error,
    errMessage: parsed?.err_msg ?? parsed?.message,
    bodyPreview: parsed ? undefined : body.slice(0, 180),
  };
}

export async function GET(request: NextRequest) {
  const requestId = request.headers.get("x-debug-id") ?? createRequestId();

  try {
    logDeepgramToken("info", "request_received", { requestId });

    const auth = await requireRequestAuth(request);

    if (!auth.ok) {
      logDeepgramToken("warn", "unauthorized", { requestId });
      return NextResponse.json(
        { error: "Unauthorized", code: "unauthorized", requestId },
        { status: 401 }
      );
    }

    const { supabase, user: authUser } = auth;
    logDeepgramToken("info", "auth_succeeded", {
      requestId,
      userId: authUser.id,
    });

    if (shouldConsumeUserRateLimit(auth)) {
      const rateLimit = await consumeRateLimit(supabase, {
        scope: "deepgram-token",
        limit: 5,
        windowSeconds: 60,
      });
      logDeepgramToken("info", "rate_limit_checked", {
        requestId,
        userId: authUser.id,
        success: rateLimit.success,
        retryAfterSeconds: rateLimit.retryAfterSeconds,
      });
      if (!rateLimit.success) {
        return NextResponse.json(
          {
            error: "Too many requests. Please wait a moment.",
            code: "rate_limited",
            requestId,
          },
          {
            status: 429,
            headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
          }
        );
      }
    }

    const apiKey = process.env.DEEPGRAM_API_KEY;
    if (!apiKey) {
      logDeepgramToken("error", "missing_deepgram_api_key", {
        requestId,
        userId: authUser.id,
      });
      return NextResponse.json(
        {
          error: "Speech recognition service is not configured.",
          code: "deepgram_missing_api_key",
          requestId,
        },
        { status: 500 }
      );
    }

    logDeepgramToken("info", "grant_started", {
      requestId,
      userId: authUser.id,
    });

    const response = await fetch("https://api.deepgram.com/v1/auth/grant", {
      method: "POST",
      headers: {
        Authorization: `Token ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ttl_seconds: 60 }),
      cache: "no-store",
    });

    const responseBody = await response.text();

    if (!response.ok) {
      const summary = summarizeDeepgramError(responseBody);
      const isPermissionError = response.status === 401 || response.status === 403;
      logDeepgramToken("error", "grant_failed", {
        requestId,
        userId: authUser.id,
        status: response.status,
        statusText: response.statusText,
        ...summary,
      });
      return NextResponse.json(
        {
          error: "Speech recognition service is unavailable.",
          code: isPermissionError
            ? "deepgram_grant_forbidden"
            : "deepgram_grant_failed",
          requestId,
        },
        { status: 502 }
      );
    }

    const data = parseJsonSafely<DeepgramGrantResponse>(responseBody);

    if (!data?.access_token) {
      logDeepgramToken("error", "grant_missing_access_token", {
        requestId,
        userId: authUser.id,
        status: response.status,
        bodyKeys: data ? Object.keys(data) : [],
      });
      return NextResponse.json(
        {
          error: "Speech recognition service is unavailable.",
          code: "deepgram_grant_missing_access_token",
          requestId,
        },
        { status: 502 }
      );
    }

    logDeepgramToken("info", "grant_succeeded", {
      requestId,
      userId: authUser.id,
      expiresIn: data.expires_in ?? 60,
    });

    return NextResponse.json({
      key: data.access_token,
      accessToken: data.access_token,
      expiresIn: data.expires_in ?? 60,
      authScheme: "bearer",
      requestId,
    });
  } catch (error) {
    logDeepgramToken("error", "unexpected", {
      requestId,
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      {
        error: "Speech recognition service is unavailable.",
        code: "deepgram_token_unexpected",
        requestId,
      },
      { status: 500 }
    );
  }
}
