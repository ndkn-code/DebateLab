export const DELIVERY_LEASE_SECONDS = 300;
export const MAX_BODY_BYTES = 64 * 1024;
export const SUPPORTED_CHANNELS = Object.freeze(["in_app", "email", "push"]);
export const MESSAGE_CLASSES = Object.freeze([
  "transactional",
  "operational",
  "lifecycle",
  "marketing",
]);
export const DELIVERY_STATUSES = Object.freeze([
  "pending",
  "processing",
  "completed",
  "failed",
  "dead_letter",
]);

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requiredString(value, field, maxLength) {
  if (
    typeof value !== "string" ||
    value.trim().length === 0 ||
    value.length > maxLength
  ) {
    throw new Error(`Invalid ${field}.`);
  }
  return value;
}

function optionalUuid(value, field) {
  if (value === undefined || value === null) return null;
  const candidate = requiredString(value, field, 36);
  if (!UUID_PATTERN.test(candidate)) throw new Error(`Invalid ${field}.`);
  return candidate;
}

function optionalObject(value, field) {
  if (value === undefined || value === null) return {};
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Invalid ${field}.`);
  }
  return value;
}

function boundedInteger(value, fallback, minimum, maximum) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(minimum, Math.min(Math.trunc(numeric), maximum));
}

export function parseNotificationQueueMessage(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid notification queue message.");
  }
  const candidate =
    value.job && typeof value.job === "object" && !Array.isArray(value.job)
      ? value.job
      : value;
  if (value.mode === "reconcile") {
    return {
      mode: "reconcile",
      limit: boundedInteger(value.limit ?? 25, 25, 1, 25),
      leaseSeconds: boundedInteger(value.leaseSeconds ?? DELIVERY_LEASE_SECONDS, DELIVERY_LEASE_SECONDS, 30, 300),
      deliveryAttempt:
        Number.isInteger(value.deliveryAttempt) && value.deliveryAttempt > 0
          ? value.deliveryAttempt
          : null,
    };
  }
  const jobId = requiredString(candidate.id ?? candidate.jobId, "jobId", 36);
  if (!UUID_PATTERN.test(jobId)) throw new Error("Notification job ID must be a UUID.");
  const channel = candidate.channel ?? null;
  if (channel !== null && !SUPPORTED_CHANNELS.includes(channel)) {
    throw new Error("Invalid notification channel.");
  }
  return {
    jobId,
    leaseToken: optionalUuid(candidate.leaseToken, "leaseToken"),
    eventId: optionalUuid(candidate.eventId, "eventId"),
    recipientId: optionalUuid(candidate.recipientId, "recipientId"),
    channel,
    payload: optionalObject(candidate.payload, "payload"),
    deliveryAttempt:
      Number.isInteger(value.deliveryAttempt) && value.deliveryAttempt > 0
        ? value.deliveryAttempt
        : null,
    mode: "job",
  };
}

export function parsePubSubEnvelope(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid Pub/Sub envelope.");
  }
  const message = value.message;
  if (!message || typeof message !== "object" || Array.isArray(message)) {
    throw new Error("Pub/Sub message is missing.");
  }
  const encoded = requiredString(message.data, "Pub/Sub message data", 32_768);
  let decoded;
  try {
    decoded = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
  } catch {
    throw new Error("Pub/Sub message data is invalid.");
  }
  return {
    message: parseNotificationQueueMessage(decoded),
    messageId: typeof message.messageId === "string" ? message.messageId : null,
    deliveryAttempt:
      Number.isInteger(value.deliveryAttempt) && value.deliveryAttempt > 0
        ? value.deliveryAttempt
        : null,
  };
}

export function parseDeliveryJobRow(row) {
  if (!row || typeof row !== "object" || Array.isArray(row)) {
    throw new Error("Notification delivery job is missing.");
  }
  const jobId = requiredString(row.id, "job.id", 36);
  if (!UUID_PATTERN.test(jobId)) throw new Error("Notification job ID must be a UUID.");
  if (!SUPPORTED_CHANNELS.includes(row.channel)) throw new Error("Invalid notification job channel.");
  if (!DELIVERY_STATUSES.includes(row.status)) throw new Error("Invalid notification job status.");
  const eventId = requiredString(row.event_id, "job.event_id", 36);
  const recipientId = requiredString(row.recipient_id, "job.recipient_id", 36);
  if (!UUID_PATTERN.test(eventId) || !UUID_PATTERN.test(recipientId)) {
    throw new Error("Notification job references must be UUIDs.");
  }
  return {
    ...row,
    id: jobId,
    eventId,
    recipientId,
    leaseToken: optionalUuid(row.lease_token, "job.lease_token"),
    payload: optionalObject(row.payload, "job.payload"),
    attempts: Number(row.attempts ?? 0),
    maxAttempts: Number(row.max_attempts ?? 5),
  };
}
