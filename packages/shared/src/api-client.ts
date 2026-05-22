export type ThinkfyAppEnv = "development" | "preview" | "production";

export interface ThinkfyApiClientConfig {
  baseUrl: string;
  getAccessToken?: () => string | null | Promise<string | null>;
}

export interface ThinkfyApiRequestOptions extends RequestInit {
  accessToken?: string | null;
  timeoutMs?: number;
}

export class ThinkfyApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(message);
    this.name = "ThinkfyApiError";
  }
}

export function createApiUrl(baseUrl: string, path: string) {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const normalizedPath = path.startsWith("/") ? path.slice(1) : path;
  return new URL(normalizedPath, normalizedBase).toString();
}

export function createThinkfyApiClient(config: ThinkfyApiClientConfig) {
  async function requestJson<TResponse>(
    path: string,
    options: ThinkfyApiRequestOptions = {},
  ): Promise<TResponse> {
    const token = options.accessToken ?? (await config.getAccessToken?.());
    const headers = new Headers(options.headers);
    const timeoutMs = options.timeoutMs ?? 45_000;
    const controller =
      timeoutMs > 0 && !options.signal ? new AbortController() : null;
    const timeoutId = controller
      ? setTimeout(() => controller.abort(), timeoutMs)
      : null;
    const {
      accessToken: _accessToken,
      timeoutMs: _timeoutMs,
      ...fetchOptions
    } = options;
    headers.set("Accept", "application/json");

    if (options.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    let response: Response;
    try {
      response = await fetch(createApiUrl(config.baseUrl, path), {
        ...fetchOptions,
        headers,
        signal: options.signal ?? controller?.signal,
      });
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "name" in error &&
        error.name === "AbortError"
      ) {
        throw new ThinkfyApiError("Request timed out. Please try again.", 0, {
          code: "request_timeout",
        });
      }
      throw error;
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }

    const body = await response.json().catch(() => null);

    if (!response.ok) {
      const message =
        body && typeof body === "object" && "error" in body
          ? String(body.error)
          : `Thinkfy API request failed with ${response.status}`;
      throw new ThinkfyApiError(message, response.status, body);
    }

    return body as TResponse;
  }

  return { requestJson };
}
