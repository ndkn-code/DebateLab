export interface ChatErrorDetails {
  code?: string;
  requestId?: string;
}

const REQUEST_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ERROR_CODE_PATTERN = /^[A-Za-z0-9_.:-]{1,80}$/;

export function sanitizeChatErrorDetails(value: {
  code?: unknown;
  requestId?: unknown;
}): ChatErrorDetails {
  const details: ChatErrorDetails = {};
  if (typeof value.code === "string" && ERROR_CODE_PATTERN.test(value.code)) {
    details.code = value.code;
  }
  if (
    typeof value.requestId === "string" &&
    REQUEST_ID_PATTERN.test(value.requestId)
  ) {
    details.requestId = value.requestId;
  }
  return details;
}

export function parseChatErrorDetails(rawBody: string): ChatErrorDetails {
  try {
    const parsed = JSON.parse(rawBody) as {
      code?: unknown;
      requestId?: unknown;
    };
    return sanitizeChatErrorDetails(parsed);
  } catch {
    return {};
  }
}

export function shouldCaptureChatHttpFailure(status: number) {
  return status >= 500;
}

export function chatFailureFingerprint(details: {
  status?: number;
  code?: unknown;
}) {
  const safeCode = sanitizeChatErrorDetails({ code: details.code }).code;
  const safeStatus =
    Number.isInteger(details.status) &&
    (details.status ?? 0) >= 100 &&
    (details.status ?? 0) <= 599
      ? details.status
      : undefined;
  const discriminator = safeCode ?? safeStatus ?? "network";
  return `chat-request-failed:${discriminator}`;
}
