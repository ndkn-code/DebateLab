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

export const materialIngestSchema = materialUploadInputSchema.safeExtend({
  title: safeText(200),
  description: z.string().trim().max(2_000).nullable().optional(),
  rights: materialRightsInputSchema.default({ basis: "unknown" }),
  idempotencyKey: z.string().trim().min(8).max(200),
}).strict();

export const materialFinalizeSchema = z.object({
  ingestionId: uuid,
  sha256: z.string().regex(/^[a-f0-9]{64}$/i).optional(),
}).strict();

export const materialRetrySchema = z.object({
  versionId: uuid,
  idempotencyKey: z.string().trim().min(8).max(200),
}).strict();

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

export function createMaterialIdempotencyKey(input: { clubId: string; actorId: string; key: string }) {
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
  const extension = input.fileName.match(/\.[a-z0-9]{1,12}$/i)?.[0].toLowerCase() ?? "";
  const scope = input.scopeClassId ?? "org";
  // IDs are deliberately opaque to clients; the final path is never returned by
  // an API response and is only used by service-role storage operations.
  return `${input.clubId}/${scope}/${input.actorId}/${input.materialId}/${input.versionId}${extension}`;
}

export function createPreviewStoragePath(materialId: string, versionId: string) {
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
    return new Date(input.leaseExpiresAt).getTime() <= (input.now ?? new Date()).getTime();
  }
  return input.status === "queued";
}

export function buildLeaseExpiry(now = new Date()) {
  return new Date(now.getTime() + MATERIAL_LEASE_SECONDS * 1000).toISOString();
}
