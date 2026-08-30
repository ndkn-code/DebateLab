import "server-only";

import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  MATERIAL_BUCKETS,
  MATERIAL_MAX_ATTEMPTS,
  MATERIAL_PREVIEW_TTL_SECONDS,
  createOpaqueStoragePath,
  createPreviewStoragePath,
  hashMaterialBytes,
  type MaterialIngestInput,
} from "./contracts";
import {
  completeVersion,
  failVersion,
  getVersion,
  insertMaterialAndVersion,
  insertRendition,
  getRenditionById,
  markVersionQueued,
  claimVersionLease,
  findVersionByIdempotency,
} from "./repository";
import { createVercelSandboxAdapter, type MaterialSandboxAdapter } from "./sandbox";
import { buildDraftMaterialDocument } from "./manifest";

type RequestClient = SupabaseClient;

function storageObjectMetadata(value: unknown) {
  const row = value as { metadata?: Record<string, unknown> | null; owner?: string | null; owner_id?: string | null } | null;
  const metadata = row?.metadata ?? {};
  return {
    owner: row?.owner ?? row?.owner_id ?? null,
    sizeBytes: Number(metadata.size ?? metadata.size_bytes ?? NaN),
    mimeType: String(metadata.mimetype ?? metadata.contentType ?? "").trim(),
  };
}

export async function createMaterialIngest(client: RequestClient, input: MaterialIngestInput, actorId: string) {
  const materialId = randomUUID();
  const versionId = randomUUID();
  const idempotencyKey = `lms-material:${input.clubId}:${actorId}:${input.idempotencyKey}`;
  const existing = await findVersionByIdempotency(client, idempotencyKey);
  if (existing) {
    return { materialId: existing.material_id, versionId: existing.id, status: existing.status, upload: null, replay: true };
  }
  const ingestPath = createOpaqueStoragePath({
    clubId: input.clubId, scopeClassId: input.scopeClassId, actorId,
    materialId, versionId, fileName: input.fileName,
  });
  const version = await insertMaterialAndVersion(client, {
    materialId, versionId, clubId: input.clubId, scopeClassId: input.scopeClassId ?? null,
    actorId, title: input.title, description: input.description ?? null,
    rightsBasis: input.rights.basis, rightsSourceUrl: input.rights.sourceUrl ?? null, rightsHolder: input.rights.rightsHolder ?? null, licenseUrl: input.rights.licenseUrl ?? null, rightsNotes: input.rights.notes ?? null,
    idempotencyKey, ingestStoragePath: ingestPath, sourceFileName: input.fileName,
    sourceMimeType: input.mimeType, sourceSizeBytes: input.sizeBytes,
  });
  const { data, error } = await client.storage.from(MATERIAL_BUCKETS.ingest).createSignedUploadUrl(ingestPath);
  if (error) throw new Error(error.message);
  return {
    materialId, versionId, status: version.status, replay: false,
    upload: { bucket: MATERIAL_BUCKETS.ingest, token: data.token, signedUrl: data.signedUrl, expiresInSeconds: 15 * 60, mimeType: input.mimeType, sizeBytes: input.sizeBytes },
  };
}

export async function finalizeMaterialIngest(client: RequestClient, ingestionId: string, expectedSha256?: string) {
  const version = await getVersion(client, ingestionId);
  if (!version) throw new Error("Material ingestion not found.");
  if (version.status === "ready" || version.status === "queued" || version.status === "converting") return version;
  if (version.status !== "uploading" && version.status !== "failed") throw new Error("Material ingestion cannot be finalized in its current state.");
  if (!version.ingest_path) throw new Error("Material upload path is missing.");

  const admin = createAdminClient();
  const objectResult = await admin.schema("storage").from("objects").select("name, owner, owner_id, metadata").eq("bucket_id", MATERIAL_BUCKETS.ingest).eq("name", version.ingest_path).maybeSingle();
  if (objectResult.error) throw new Error(objectResult.error.message);
  const object = storageObjectMetadata(objectResult.data);
  if (!object.sizeBytes || object.sizeBytes !== version.byte_size) throw new Error("Uploaded material size does not match the declared size.");
  if (object.mimeType !== version.detected_mime) throw new Error("Uploaded material MIME type does not match the declared type.");
  if (expectedSha256 && version.checksum_sha256 && expectedSha256.toLowerCase() !== version.checksum_sha256.toLowerCase()) throw new Error("Material checksum does not match.");

  const originalPath = version.ingest_path;
  const download = await admin.storage.from(MATERIAL_BUCKETS.ingest).download(originalPath);
  if (download.error) throw new Error(download.error.message);
  const uploadedBytes = new Uint8Array(await download.data.arrayBuffer());
  const actualSha256 = hashMaterialBytes(uploadedBytes);
  if (expectedSha256 && actualSha256.toLowerCase() !== expectedSha256.toLowerCase()) throw new Error("Material checksum does not match.");
  const copy = await admin.storage.from(MATERIAL_BUCKETS.originals).upload(originalPath, download.data, {
    contentType: version.detected_mime ?? "application/octet-stream",
    upsert: false,
  });
  if (copy.error && !copy.error.message.toLowerCase().includes("already exists")) throw new Error(copy.error.message);
  const queued = await markVersionQueued(client, version.id, actualSha256);
  if (!queued) return (await getVersion(client, version.id)) ?? version;
  await client.from("lms_material_versions").update({ original_bucket: MATERIAL_BUCKETS.originals, original_path: originalPath, ingest_bucket: null, ingest_path: null, updated_at: new Date().toISOString() }).eq("id", version.id);
  await admin.storage.from(MATERIAL_BUCKETS.ingest).remove([version.ingest_path]);
  return { ...queued, original_bucket: MATERIAL_BUCKETS.originals, original_path: originalPath, ingest_bucket: null, ingest_path: null };
}

export async function processMaterialVersion(versionId: string, adapter: MaterialSandboxAdapter = createVercelSandboxAdapter()) {
  const admin = createAdminClient();
  const current = await getVersion(admin, versionId);
  if (!current || current.status === "ready" || current.status === "rejected") return "skipped" as const;
  const claimed = await claimVersionLease(admin, current);
  if (!claimed) return "lease_active" as const;
  const leaseToken = claimed.lease_token;
  if (!leaseToken || !claimed.original_path) throw new Error("Material lease or original path is missing.");
  try {
    const signed = await admin.storage.from(MATERIAL_BUCKETS.originals).createSignedUrl(claimed.original_path, MATERIAL_PREVIEW_TTL_SECONDS);
    if (signed.error) throw new Error(signed.error.message);
    const result = await adapter.convert({ sourceUrl: signed.data.signedUrl, mimeType: claimed.detected_mime ?? "application/octet-stream", fileName: claimed.source_file_name, materialId: claimed.material_id, versionId: claimed.id });
    const bytes = new TextEncoder().encode(result.text);
    const previewPath = createPreviewStoragePath(claimed.material_id, claimed.id);
    const upload = await admin.storage.from(MATERIAL_BUCKETS.previews).upload(previewPath, bytes, { contentType: "text/plain", upsert: true });
    if (upload.error) throw new Error(upload.error.message);
    const rendition = await insertRendition(admin, { materialId: claimed.material_id, versionId: claimed.id, storagePath: previewPath, mimeType: "text/plain", sizeBytes: bytes.byteLength, sha256: hashMaterialBytes(bytes) });
    const draftDocument = buildDraftMaterialDocument({ title: result.title ?? claimed.source_file_name, versionId: claimed.id, renditionId: rendition.id, text: result.text });
    // Persist only as a draft. Publishing remains a separate, authorized LMS
    // content action owned by the material root contract.
    const draftUpdate = await admin.from("lms_material_versions").update({ draft_document: draftDocument, draft_document_status: "teacher_review", updated_at: new Date().toISOString() }).eq("id", claimed.id).eq("lease_token", leaseToken);
    if (draftUpdate.error) throw new Error(draftUpdate.error.message);
    const completed = await completeVersion(admin, claimed.id, leaseToken);
    if (!completed) return "lease_lost" as const;
    return "completed" as const;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Material conversion failed.";
    const terminal = claimed.processing_attempts >= MATERIAL_MAX_ATTEMPTS;
    await failVersion(admin, claimed.id, leaseToken, "CONVERSION_FAILED", message, terminal);
    if (terminal) return "failed" as const;
    throw error;
  }
}

/** Service-role half of the preview boundary. The caller must first pass the
 * public.can_access_lms_material_preview RPC using the user's session client. */
export async function buildAuthorizedMaterialPreviewDescriptor(input: { placementId: string; versionId: string; renditionId: string }) {
  const admin = createAdminClient();
  const rendition = await getRenditionById(admin, input.renditionId, input.versionId);
  if (!rendition || typeof rendition.path !== "string") return null;
  const signed = await admin.storage.from(MATERIAL_BUCKETS.previews).createSignedUrl(rendition.path, 120);
  if (signed.error) throw new Error(signed.error.message);
  return {
    placementId: input.placementId,
    versionId: input.versionId,
    renditionId: input.renditionId,
    mimeType: String(rendition.mime_type ?? "text/plain"),
    expiresAt: new Date(Date.now() + 120_000).toISOString(),
    signedUrl: signed.data.signedUrl,
  };
}
