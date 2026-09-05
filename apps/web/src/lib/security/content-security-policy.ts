export type ContentSecurityPolicyOptions = {
  nonce: string;
  isDevelopment?: boolean;
  grafanaFaroCollectorUrl?: string;
};

// Sonner 2.0.7 injects this immutable stylesheet at module evaluation time and
// does not expose a nonce option. A content hash keeps style elements fail-closed
// without falling back to `style-src-elem 'unsafe-inline'`.
export const SONNER_STYLE_SHA256 =
  "'sha256-CIxDM5jnsGiKqXs2v7NKCY5MzdR9gu6TtiMJrDw29AY='";

export function createCspNonce() {
  return crypto.randomUUID().replaceAll("-", "");
}

function configuredOrigin(value: string | undefined) {
  if (!value?.trim()) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export function buildContentSecurityPolicy({
  nonce,
  isDevelopment = false,
  grafanaFaroCollectorUrl,
}: ContentSecurityPolicyOptions) {
  const grafanaFaroOrigin = configuredOrigin(grafanaFaroCollectorUrl);
  const connectSrc = [
    "'self'",
    "https://*.supabase.co",
    "wss://*.supabase.co",
    "https://api.deepgram.com",
    "wss://api.deepgram.com",
    "https://generativelanguage.googleapis.com",
    "https://api.groq.com",
    "https://us.i.posthog.com",
    "https://us-assets.i.posthog.com",
    "https://vitals.vercel-insights.com",
    "https://*.vercel-insights.com",
    ...(grafanaFaroOrigin ? [grafanaFaroOrigin] : []),
    ...(isDevelopment
      ? [
          "http://127.0.0.1:54321",
          "http://localhost:54321",
          "ws://127.0.0.1:54321",
          "ws://localhost:54321",
        ]
      : []),
  ].join(" ");

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://us-assets.i.posthog.com https://us.i.posthog.com https://*.vercel-scripts.com${isDevelopment ? " 'unsafe-eval'" : ""}`,
    "script-src-attr 'none'",
    `style-src-elem 'self' 'nonce-${nonce}' ${SONNER_STYLE_SHA256}`,
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "media-src 'self' blob: data: https://api.deepgram.com https://*.supabase.co",
    `connect-src ${connectSrc}`,
    "frame-src 'self' blob: https://docs.google.com https://www.youtube.com https://www.youtube-nocookie.com https://tally.so https://*.tally.so",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    ...(!isDevelopment ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

export function createContentSecurityPolicyContext(
  incomingHeaders: HeadersInit,
  options: Omit<ContentSecurityPolicyOptions, "nonce"> = {},
) {
  const nonce = createCspNonce();
  const value = buildContentSecurityPolicy({ nonce, ...options });
  const requestHeaders = new Headers(incomingHeaders);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", value);
  return { nonce, value, requestHeaders };
}

export function setContentSecurityPolicyResponseHeader(
  responseHeaders: Headers,
  value: string,
) {
  responseHeaders.set("Content-Security-Policy", value);
}
