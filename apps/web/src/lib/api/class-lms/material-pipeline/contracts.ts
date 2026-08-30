import { createHash } from "node:crypto";
import { z } from "zod";
import {
  MATERIAL_ALLOWED_MIME_TYPES,
  materialUploadInputSchema,
  materialRightsInputSchema,
  type MaterialProcessingStatus,
} from "@/lib/api/class-lms/material-contracts";

/** Pipeline-owned values. The canonical LMS material shape lives in material-contracts.ts. */
export const MATERIAL_PIPELINE_TOPIC = "lms-material-processing" as const;
export const MATERIAL_BUCKETS = {
  ingest: "lms-material-ingest",
  originals: "lms-material-originals",
  previews: "lms-material-previews",
} as const;
export const MATERIAL_MAX_BYTES = 25 * 1024 * 1024;
export const MATERIAL_UPLOAD_TTL_SECONDS = 15 * 60;
export const MATERIAL_PREVIEW_TTL_SECONDS = 10 * 60;
export const MATERIAL_LEASE_SECONDS = 10 * 60;
export const MATERIAL_MAX_ATTEMPTS = 5;

export const MATERIAL_MIME_TYPES = MATERIAL_ALLOWED_MIME_TYPES;

const uuid = z.string().uuid();
const safeText = (max: number) => z.string().trim().min(1).max(max);

export const materialIngestSchema = materialUploadInputSchema
  .safeExtend({
    title: safeText(200),
    description: z.string().trim().max(2_000).nullable().optional(),
    rights: materialRightsInputSchema.default({ basis: "unknown" }),
    idempotencyKey: z.string().trim().min(8).max(200),
  })
  .strict();

export function detectMaterialMime(
  bytes: Uint8Array,
  declaredMime: string,
): string | null {
  const starts = (...values: number[]) =>
    values.every((value, index) => bytes[index] === value);
  if (starts(0x25, 0x50, 0x44, 0x46, 0x2d)) return "application/pdf";
  if (starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))
    return "image/png";
  if (starts(0xff, 0xd8, 0xff)) return "image/jpeg";
  if (
    starts(0x52, 0x49, 0x46, 0x46) &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  )
    return "image/webp";
  if (
    starts(0x52, 0x49, 0x46, 0x46) &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x41 &&
    bytes[10] === 0x56 &&
    bytes[11] === 0x45
  )
    return declaredMime === "audio/x-wav" ? declaredMime : "audio/wav";
  if (
    starts(0x49, 0x44, 0x33) ||
    (bytes[0] === 0xff && bytes[1] !== undefined && (bytes[1] & 0xe0) === 0xe0)
  )
    return "audio/mpeg";
  if (
    bytes[4] === 0x66 &&
    bytes[5] === 0x74 &&
    bytes[6] === 0x79 &&
    bytes[7] === 0x70
  )
    return "audio/mp4";
  if (starts(0x50, 0x4b, 0x03, 0x04)) {
    const archiveNames = Buffer.from(bytes).toString("latin1");
    if (archiveNames.includes("word/"))
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    if (archiveNames.includes("ppt/"))
      return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    return null;
  }
  if (
    starts(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1) &&
    ["application/msword", "application/vnd.ms-powerpoint"].includes(
      declaredMime,
    )
  )
    return declaredMime;
  if (declaredMime === "text/plain" && !bytes.includes(0)) {
    try {
      new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      return declaredMime;
    } catch {
      return null;
    }
  }
  return null;
}

export const materialFinalizeSchema = z
  .object({
    ingestionId: uuid,
    sha256: z
      .string()
      .regex(/^[a-f0-9]{64}$/i)
      .optional(),
  })
  .strict();

export const materialRetrySchema = z
  .object({
    versionId: uuid,
    idempotencyKey: z.string().trim().min(8).max(200),
  })
  .strict();

export type MaterialIngestInput = z.infer<typeof materialIngestSchema>;
export type MaterialFinalizeInput = z.infer<typeof materialFinalizeSchema>;
export type MaterialRetryInput = z.infer<typeof materialRetrySchema>;

export type MaterialQueueMessage = {
  materialId: string;
  versionId: string;
  idempotencyKey: string;
};

export type PipelinePreviewDescriptor = {
  materialId: string;
  versionId: string;
  renditionId: string;
  mimeType: string;
  expiresAt: string;
  signedUrl: string;
};

export type SandboxConversionRequest = {
  sourceUrl: string;
  mimeType: string;
  fileName: string;
  materialId: string;
  versionId: string;
};

export type SandboxConversionResult = {
  text: string;
  title?: string;
  mimeType?: string;
};

export function createMaterialIdempotencyKey(input: {
  clubId: string;
  actorId: string;
  key: string;
}) {
  return `lms-material:${input.clubId}:${input.actorId}:${input.key}`;
}

export function createOpaqueStoragePath(input: {
  clubId: string;
  scopeClassId?: string | null;
  actorId: string;
  materialId: string;
  versionId: string;
  fileName: string;
}) {
  return `${input.clubId}/${input.materialId}/${input.actorId}/${input.versionId}/${input.versionId}.bin`;
}

export function createPreviewStoragePath(
  materialId: string,
  versionId: string,
) {
  return `${materialId}/${versionId}/preview.txt`;
}

export function hashMaterialBytes(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function isTerminalMaterialStatus(status: MaterialProcessingStatus) {
  return status === "ready" || status === "rejected";
}

export function canClaimMaterialLease(input: {
  status: MaterialProcessingStatus;
  leaseExpiresAt: string | null | undefined;
  now?: Date;
}) {
  if (input.status === "ready" || input.status === "rejected") return false;
  if (input.status === "converting" && input.leaseExpiresAt) {
    return (
      new Date(input.leaseExpiresAt).getTime() <=
      (input.now ?? new Date()).getTime()
    );
  }
  return input.status === "queued";
}

export function buildLeaseExpiry(now = new Date()) {
  return new Date(now.getTime() + MATERIAL_LEASE_SECONDS * 1000).toISOString();
}
