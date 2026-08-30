export const MATERIAL_BUCKETS = Object.freeze({
  originals: "lms-material-originals",
  previews: "lms-material-previews",
});

export const MATERIAL_MAX_ATTEMPTS = 5;
export const MATERIAL_LEASE_SECONDS = 10 * 60;
export const MATERIAL_PREVIEW_TTL_SECONDS = 10 * 60;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requiredString(value, field, maxLength) {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > maxLength
  ) {
    throw new Error(`Invalid ${field}.`);
  }
  return value;
}

export function parseMaterialQueueMessage(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid material queue message.");
  }
  const materialId = requiredString(value.materialId, "materialId", 36);
  const versionId = requiredString(value.versionId, "versionId", 36);
  const idempotencyKey = requiredString(
    value.idempotencyKey,
    "idempotencyKey",
    240,
  );
  if (!UUID_PATTERN.test(materialId) || !UUID_PATTERN.test(versionId)) {
    throw new Error("Material queue IDs must be UUIDs.");
  }
  return { materialId, versionId, idempotencyKey };
}

export function parsePubSubEnvelope(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid Pub/Sub envelope.");
  }
  const message = value.message;
  if (!message || typeof message !== "object" || Array.isArray(message)) {
    throw new Error("Pub/Sub message is missing.");
  }
  const encoded = requiredString(message.data, "Pub/Sub message data", 16_384);
  let decoded;
  try {
    decoded = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
  } catch {
    throw new Error("Pub/Sub message data is invalid.");
  }
  return {
    message: parseMaterialQueueMessage(decoded),
    messageId:
      typeof message.messageId === "string" ? message.messageId : null,
    deliveryAttempt:
      Number.isInteger(value.deliveryAttempt) && value.deliveryAttempt > 0
        ? value.deliveryAttempt
        : null,
  };
}

export function buildLeaseExpiry(now = new Date()) {
  return new Date(now.getTime() + MATERIAL_LEASE_SECONDS * 1000).toISOString();
}

export function canClaimMaterialLease(version, now = new Date()) {
  if (version.processing_status === "ready" || version.processing_status === "rejected") {
    return false;
  }
  if (version.processing_status === "converting" && version.lease_expires_at) {
    return new Date(version.lease_expires_at).getTime() <= now.getTime();
  }
  return version.processing_status === "queued";
}

export function createPreviewStoragePath(materialId, versionId) {
  return `${materialId}/${versionId}/preview.txt`;
}
