type RpcError = {
  message?: string;
  code?: string;
};

type RpcClient = {
  rpc: (
    fn: string,
    args?: Record<string, unknown>
  ) => PromiseLike<{ data: unknown; error: RpcError | null }>;
};

type LocalRecord = {
  count: number;
  resetTime: number;
};

export type RateLimitResult = {
  success: boolean;
  remaining: number;
  retryAfterSeconds: number;
  resetAt?: string;
};

const localRateLimitMap = new Map<string, LocalRecord>();

function localRateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  const record = localRateLimitMap.get(key);
  const retryAfterSeconds = Math.ceil(windowMs / 1000);

  if (!record || now > record.resetTime) {
    localRateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
    return {
      success: true,
      remaining: Math.max(0, limit - 1),
      retryAfterSeconds,
      resetAt: new Date(now + windowMs).toISOString(),
    };
  }

  if (record.count >= limit) {
    return {
      success: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((record.resetTime - now) / 1000)),
      resetAt: new Date(record.resetTime).toISOString(),
    };
  }

  record.count += 1;

  return {
    success: true,
    remaining: Math.max(0, limit - record.count),
    retryAfterSeconds: Math.max(1, Math.ceil((record.resetTime - now) / 1000)),
    resetAt: new Date(record.resetTime).toISOString(),
  };
}

function isRateLimitPayload(value: unknown): value is {
  allowed?: unknown;
  remaining?: unknown;
  retryAfterSeconds?: unknown;
  resetAt?: unknown;
} {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normalizeRpcResult(value: unknown, windowSeconds: number): RateLimitResult {
  if (!isRateLimitPayload(value)) {
    return {
      success: false,
      remaining: 0,
      retryAfterSeconds: windowSeconds,
    };
  }

  return {
    success: value.allowed === true,
    remaining:
      typeof value.remaining === "number" && Number.isFinite(value.remaining)
        ? Math.max(0, Math.floor(value.remaining))
        : 0,
    retryAfterSeconds:
      typeof value.retryAfterSeconds === "number" &&
      Number.isFinite(value.retryAfterSeconds)
        ? Math.max(1, Math.ceil(value.retryAfterSeconds))
        : windowSeconds,
    resetAt: typeof value.resetAt === "string" ? value.resetAt : undefined,
  };
}

export async function consumeRateLimit(
  supabase: RpcClient,
  params: {
    scope: string;
    limit: number;
    windowSeconds: number;
  }
): Promise<RateLimitResult> {
  const limit = Math.max(1, Math.floor(params.limit));
  const windowSeconds = Math.max(1, Math.floor(params.windowSeconds));

  const { data, error } = await supabase.rpc("consume_rate_limit", {
    p_scope: params.scope,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });

  if (!error) {
    return normalizeRpcResult(data, windowSeconds);
  }

  if (process.env.NODE_ENV !== "production") {
    if (process.env.NODE_ENV === "development") {
      console.warn("Falling back to local rate limit:", error.message);
    }
    return localRateLimit(
      `dev:${params.scope}`,
      limit,
      windowSeconds * 1000
    );
  }

  return {
    success: false,
    remaining: 0,
    retryAfterSeconds: windowSeconds,
  };
}

export function legacyLocalRateLimit(
  key: string,
  limit: number,
  windowMs: number
): { success: boolean; remaining: number } {
  const result = localRateLimit(key, limit, windowMs);
  return { success: result.success, remaining: result.remaining };
}

setInterval(() => {
  const now = Date.now();
  for (const [key, record] of localRateLimitMap) {
    if (now > record.resetTime) localRateLimitMap.delete(key);
  }
}, 5 * 60 * 1000).unref?.();
