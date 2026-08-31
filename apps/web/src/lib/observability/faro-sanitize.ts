const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const BEARER_TOKEN = /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi;
const JWT = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;
const URL_WITH_QUERY = /\bhttps?:\/\/[^\s?#]+(?:\?[^\s#]*)?(?:#[^\s]*)?/gi;
const EMBEDDED_SENSITIVE_VALUE =
  /\b(?:prompt|transcript|essay|audio|user[_ -]?content|request[_ -]?body|response[_ -]?body)\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^,;\n}]*)/gi;
const MAX_STRING_LENGTH = 2_000;
const MAX_DEPTH = 8;
const FARO_TRANSPORT_ITEM_TYPES = [
  "exception",
  "event",
  "log",
  "measurement",
  "trace",
] as const;

export function stripUrlQuery(value: string) {
  try {
    const url = new URL(value, "https://thinkfy.invalid");
    const normalized = `${url.pathname}${url.hash}`;
    return url.origin === "https://thinkfy.invalid"
      ? normalized
      : `${url.origin}${normalized}`;
  } catch {
    return value.split("?", 1)[0] ?? value;
  }
}

export function sanitizeTelemetryString(value: string) {
  return value
    .replace(EMAIL, "[redacted-email]")
    .replace(BEARER_TOKEN, "Bearer [redacted]")
    .replace(JWT, "[redacted-token]")
    .replace(EMBEDDED_SENSITIVE_VALUE, (match) => {
      const separator = match.search(/[:=]/);
      return `${match.slice(0, separator + 1)} [redacted]`;
    })
    .replace(URL_WITH_QUERY, (url) => stripUrlQuery(url))
    .slice(0, MAX_STRING_LENGTH);
}

function isSensitiveKey(key: string) {
  const normalized = key.replace(/[^a-z0-9]/gi, "").toLowerCase();
  return [
    "authorization",
    "cookie",
    "email",
    "token",
    "secret",
    "password",
    "prompt",
    "payload",
    "transcript",
    "essay",
    "audio",
    "requestbody",
    "responsebody",
    "messagecontent",
    "usercontent",
  ].some((sensitive) => normalized.includes(sensitive));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isFaroTransportItem(value: unknown): value is Record<string, unknown> {
  return (
    isRecord(value) &&
    typeof value.type === "string" &&
    FARO_TRANSPORT_ITEM_TYPES.includes(
      value.type as (typeof FARO_TRANSPORT_ITEM_TYPES)[number]
    ) &&
    isRecord(value.payload) &&
    isRecord(value.meta)
  );
}

function sanitizeValue(
  value: unknown,
  key: string,
  depth: number
): unknown {
  if (isSensitiveKey(key)) return "[redacted]";
  if (depth > MAX_DEPTH) return "[truncated]";

  if (typeof value === "string") {
    return key.toLowerCase().includes("url") || key === "route"
      ? stripUrlQuery(sanitizeTelemetryString(value))
      : sanitizeTelemetryString(value);
  }

  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => sanitizeValue(item, key, depth + 1));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([childKey, childValue]) => [
        childKey,
        sanitizeValue(
          childValue,
          childKey,
          depth + 1
        ),
      ])
    );
  }

  return value;
}

export function sanitizeTelemetryItem<T>(item: T): T {
  if (isFaroTransportItem(item)) {
    return Object.fromEntries(
      Object.entries(item).map(([key, value]) => [
        key,
        key === "payload"
          ? sanitizeValue(value, "__faro_transport_envelope__", 1)
          : sanitizeValue(value, key, 1),
      ])
    ) as T;
  }

  return sanitizeValue(item, "root", 0) as T;
}
