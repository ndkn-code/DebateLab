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
  detectMaterialMime,
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
import {
  createVercelSandboxAdapter,
  type MaterialSandboxAdapter,
} from "./sandbox";
import { buildDraftMaterialDocument } from "./manifest";
import {
  requireClassManager,
  requireClubOwner,
} from "@/lib/api/class-manager-access";

type RequestClient = SupabaseClient;

export async function requireMaterialManager(
  client: RequestClient,
  materialId: string,
) {
  const material = await createAdminClient()
    .from("lms_materials")
    .select("id, club_id, scope_class_id")
    .eq("id", materialId)
    .maybeSingle();
  if (material.error) throw new Error(material.error.message);
  if (!material.data) throw new Error("Material not found.");
  if (material.data.scope_class_id) {
    const context = await requireClassManager(
      client as never,
      material.data.scope_class_id,
    );
    if (context.clubId !== material.data.club_id)
      throw new Error("Material class does not belong to its organisation.");
    return { ...material.data, actorId: context.userId };
  }
  return {
    ...material.data,
    actorId: await requireClubOwner(client as never, material.data.club_id),
  };
}

function storageObjectMetadata(value: unknown) {
  const row = value as {
    metadata?: Record<string, unknown> | null;
    owner?: string | null;
    owner_id?: string | null;
  } | null;
  const metadata = row?.metadata ?? {};
  return {
    owner: row?.owner ?? row?.owner_id ?? null,
    sizeBytes: Number(metadata.size ?? metadata.size_bytes ?? NaN),
    mimeType: String(metadata.mimetype ?? metadata.contentType ?? "").trim(),
  };
}

export async function createMaterialIngest(
  client: RequestClient,
  input: MaterialIngestInput,
  actorId: string,
) {
  const materialId = randomUUID();
  const versionId = randomUUID();
  const idempotencyKey = `lms-material:${input.clubId}:${actorId}:${input.idempotencyKey}`;
  const admin = createAdminClient();
  const existing = await findVersionByIdempotency(admin, idempotencyKey);
  if (existing) {
    return {
      materialId: existing.material_id,
      versionId: existing.id,
      status: existing.status,
      upload: null,
      replay: true,
    };
  }
  const ingestPath = createOpaqueStoragePath({
    clubId: input.clubId,
    scopeClassId: input.scopeClassId,
    actorId,
    materialId,
    versionId,
    fileName: input.fileName,
  });
  let programType = input.programType;
  if (input.scopeClassId) {
    const classResult = await admin
      .from("classes")
      .select("club_id, program_type")
      .eq("id", input.scopeClassId)
      .maybeSingle();
    if (
      classResult.error ||
      !classResult.data ||
      classResult.data.club_id !== input.clubId
    )
      throw new Error("Material class does not belong to its organisation.");
    programType = classResult.data
      .program_type as MaterialIngestInput["programType"];
  }
  if (!programType)
    throw new Error("Organisation materials require a program type.");
  const version = await insertMaterialAndVersion(admin, {
    materialId,
    versionId,
    clubId: input.clubId,
    scopeClassId: input.scopeClassId ?? null,
    programType,
    actorId,
    title: input.title,
    description: input.description ?? null,
    rightsBasis: input.rights.basis,
    rightsSourceUrl: input.rights.sourceUrl ?? null,
    rightsHolder: input.rights.rightsHolder ?? null,
    licenseUrl: input.rights.licenseUrl ?? null,
    rightsNotes: input.rights.notes ?? null,
    idempotencyKey,
    ingestStoragePath: ingestPath,
    sourceFileName: input.fileName,
    sourceMimeType: input.mimeType,
    sourceSizeBytes: input.sizeBytes,
  });
  const { data, error } = await client.storage
    .from(MATERIAL_BUCKETS.ingest)
    .createSignedUploadUrl(ingestPath);
  if (error) throw new Error(error.message);
  return {
    materialId,
    versionId,
    status: version.status,
    replay: false,
    upload: {
      bucket: MATERIAL_BUCKETS.ingest,
      token: data.token,
      signedUrl: data.signedUrl,
      expiresInSeconds: 15 * 60,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
    },
  };
}

export async function finalizeMaterialIngest(
  client: RequestClient,
  ingestionId: string,
  expectedSha256?: string,
) {
  const admin = createAdminClient();
  const version = await getVersion(admin, ingestionId);
  if (!version) throw new Error("Material ingestion not found.");
  await requireMaterialManager(client, version.material_id);
  if (
    version.status === "ready" ||
    version.status === "queued" ||
    version.status === "converting"
  )
    return version;
  if (version.status !== "uploading" && version.status !== "failed")
    throw new Error(
      "Material ingestion cannot be finalized in its current state.",
    );
  if (!version.ingest_path) throw new Error("Material upload path is missing.");

  const objectResult = await admin
    .schema("storage")
    .from("objects")
    .select("name, owner, owner_id, metadata")
    .eq("bucket_id", MATERIAL_BUCKETS.ingest)
    .eq("name", version.ingest_path)
    .maybeSingle();
  if (objectResult.error) throw new Error(objectResult.error.message);
  const object = storageObjectMetadata(objectResult.data);
  if (!object.sizeBytes || object.sizeBytes !== version.size_bytes)
    throw new Error("Uploaded material size does not match the declared size.");
  if (object.mimeType !== version.source_mime_type)
    throw new Error(
      "Uploaded material MIME type does not match the declared type.",
    );
  if (
    expectedSha256 &&
    version.sha256 &&
    expectedSha256.toLowerCase() !== version.sha256.toLowerCase()
  )
    throw new Error("Material checksum does not match.");

  const originalPath = version.ingest_path;
  const download = await admin.storage
    .from(MATERIAL_BUCKETS.ingest)
    .download(originalPath);
  if (download.error) throw new Error(download.error.message);
  const uploadedBytes = new Uint8Array(await download.data.arrayBuffer());
  const actualSha256 = hashMaterialBytes(uploadedBytes);
  const detectedMimeType = detectMaterialMime(
    uploadedBytes,
    version.source_mime_type ?? "",
  );
  if (!detectedMimeType || detectedMimeType !== version.source_mime_type)
    throw new Error(
      "Uploaded material content does not match the declared MIME type.",
    );
  if (
    expectedSha256 &&
    actualSha256.toLowerCase() !== expectedSha256.toLowerCase()
  )
    throw new Error("Material checksum does not match.");
  const copy = await admin.storage
    .from(MATERIAL_BUCKETS.originals)
    .upload(originalPath, download.data, {
      contentType: detectedMimeType,
      upsert: false,
    });
  if (
    copy.error &&
    !copy.error.message.toLowerCase().includes("already exists")
  )
    throw new Error(copy.error.message);
  const queued = await markVersionQueued(
    admin,
    version.id,
    actualSha256,
    detectedMimeType,
  );
  if (!queued) return (await getVersion(admin, version.id)) ?? version;
  await admin
    .from("lms_material_versions")
    .update({
      original_bucket: MATERIAL_BUCKETS.originals,
      original_path: originalPath,
      ingest_bucket: null,
      ingest_path: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", version.id);
  await admin.storage
    .from(MATERIAL_BUCKETS.ingest)
    .remove([version.ingest_path]);
  return {
    ...queued,
    original_bucket: MATERIAL_BUCKETS.originals,
    original_path: originalPath,
    ingest_bucket: null,
    ingest_path: null,
  };
}

export async function processMaterialVersion(
  versionId: string,
  adapter: MaterialSandboxAdapter = createVercelSandboxAdapter(),
) {
  const admin = createAdminClient();
  const current = await getVersion(admin, versionId);
  if (!current || current.status === "ready" || current.status === "rejected")
    return "skipped" as const;
  const claimed = await claimVersionLease(admin, current);
  if (!claimed) return "lease_active" as const;
  const leaseToken = claimed.lease_token;
  if (!leaseToken || !claimed.original_path)
    throw new Error("Material lease or original path is missing.");
  try {
    const signed = await admin.storage
      .from(MATERIAL_BUCKETS.originals)
      .createSignedUrl(claimed.original_path, MATERIAL_PREVIEW_TTL_SECONDS);
    if (signed.error) throw new Error(signed.error.message);
    const result = await adapter.convert({
      sourceUrl: signed.data.signedUrl,
      mimeType: claimed.detected_mime_type ?? "application/octet-stream",
      fileName: claimed.source_file_name,
      materialId: claimed.material_id,
      versionId: claimed.id,
    });
    const bytes = new TextEncoder().encode(result.text);
    const previewPath = createPreviewStoragePath(
      claimed.material_id,
      claimed.id,
    );
    const upload = await admin.storage
      .from(MATERIAL_BUCKETS.previews)
      .upload(previewPath, bytes, { contentType: "text/plain", upsert: true });
    if (upload.error) throw new Error(upload.error.message);
    const rendition = await insertRendition(admin, {
      materialId: claimed.material_id,
      versionId: claimed.id,
      storagePath: previewPath,
      mimeType: "text/plain",
      sizeBytes: bytes.byteLength,
      sha256: hashMaterialBytes(bytes),
    });
    const draftDocument = buildDraftMaterialDocument({
      title: result.title ?? claimed.source_file_name,
      versionId: claimed.id,
      renditionId: rendition.id,
      text: result.text,
    });
    // Persist only as a draft. Publishing remains a separate, authorized LMS
    // content action owned by the material root contract.
    const draftUpdate = await admin
      .from("lms_material_versions")
      .update({
        native_document: draftDocument,
        updated_at: new Date().toISOString(),
      })
      .eq("id", claimed.id)
      .eq("lease_token", leaseToken);
    if (draftUpdate.error) throw new Error(draftUpdate.error.message);
    const completed = await completeVersion(admin, claimed.id, leaseToken);
    if (!completed) return "lease_lost" as const;
    return "completed" as const;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Material conversion failed.";
    const terminal = claimed.processing_attempts >= MATERIAL_MAX_ATTEMPTS;
    await failVersion(
      admin,
      claimed.id,
      leaseToken,
      "CONVERSION_FAILED",
      message,
      terminal,
    );
    if (terminal) return "failed" as const;
    throw error;
  }
}

/** Service-role half of the preview boundary. The caller must first pass the
 * public.can_access_lms_material_preview RPC using the user's session client. */
export async function buildAuthorizedMaterialPreviewDescriptor(input: {
  materialId: string;
  placementId: string;
  versionId: string;
  renditionId: string;
}) {
  const admin = createAdminClient();
  const version = await getVersion(admin, input.versionId);
  if (!version || version.material_id !== input.materialId) return null;
  const rendition = await getRenditionById(
    admin,
    input.renditionId,
    input.versionId,
  );
  if (
    !rendition ||
    typeof rendition.storage_path !== "string" ||
    rendition.bucket_id !== MATERIAL_BUCKETS.previews
  )
    return null;
  const signed = await admin.storage
    .from(MATERIAL_BUCKETS.previews)
    .createSignedUrl(rendition.storage_path, 120);
  if (signed.error) throw new Error(signed.error.message);
  return {
    materialId: input.materialId,
    placementId: input.placementId,
    versionId: input.versionId,
    renditionId: input.renditionId,
    mimeType: String(rendition.mime_type ?? "text/plain"),
    expiresAt: new Date(Date.now() + 120_000).toISOString(),
    signedUrl: signed.data.signedUrl,
  };
}
