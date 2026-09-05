import "server-only";

import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildLeaseExpiry,
  canClaimMaterialLease,
  MATERIAL_LEASE_SECONDS,
} from "./contracts";
import type { MaterialProcessingStatus } from "@/lib/api/class-lms/material-contracts";

export const MATERIAL_TABLES = {
  materials: "lms_materials",
  versions: "lms_material_versions",
  renditions: "lms_material_renditions",
} as const;

export type PipelineClient = SupabaseClient;

export type MaterialVersionRow = {
  id: string;
  material_id: string;
  purpose?: "material" | "question_import";
  status: MaterialProcessingStatus;
  idempotency_key: string;
  ingest_bucket: string | null;
  ingest_path: string | null;
  original_bucket: string | null;
  original_path: string | null;
  source_file_name: string;
  source_mime_type: string | null;
  detected_mime_type: string | null;
  size_bytes: number;
  sha256: string | null;
  processing_attempts: number;
  lease_token: string | null;
  lease_expires_at: string | null;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

export function mapVersionRow(
  row: Record<string, unknown>,
): MaterialVersionRow {
  return {
    id: String(row.id),
    material_id: String(row.material_id),
    purpose: row.purpose === "question_import" ? "question_import" : "material",
    status: (row.processing_status ?? row.status) as MaterialProcessingStatus,
    idempotency_key: String(row.idempotency_key),
    ingest_bucket: (row.ingest_bucket as string | null) ?? null,
    ingest_path: (row.ingest_path as string | null) ?? null,
    original_bucket: (row.original_bucket as string | null) ?? null,
    original_path: (row.original_path as string | null) ?? null,
    source_file_name: String(row.source_file_name),
    source_mime_type: (row.source_mime_type as string | null) ?? null,
    detected_mime_type: (row.detected_mime_type as string | null) ?? null,
    size_bytes: Number(row.size_bytes),
    sha256: (row.sha256 as string | null) ?? null,
    processing_attempts: Number(row.processing_attempts ?? 0),
    lease_token: (row.lease_token as string | null) ?? null,
    lease_expires_at: (row.lease_expires_at as string | null) ?? null,
    error_code: (row.error_code as string | null) ?? null,
    error_message: (row.error_message as string | null) ?? null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export async function insertMaterialAndVersion(
  client: PipelineClient,
  input: {
    materialId: string;
    versionId: string;
    clubId: string;
    scopeClassId: string | null;
    programType: "ielts" | "debate" | "public_speaking";
    actorId: string;
    title: string;
    description: string | null;
    rightsBasis: string;
    rightsSourceUrl: string | null;
    rightsHolder: string | null;
    licenseUrl: string | null;
    rightsNotes: string | null;
    idempotencyKey: string;
    ingestStoragePath: string;
    sourceFileName: string;
    sourceMimeType: string;
    sourceSizeBytes: number;
    purpose?: "material" | "question_import";
  },
) {
  const now = new Date().toISOString();
  const material = await client
    .from(MATERIAL_TABLES.materials)
    .insert({
      id: input.materialId,
      club_id: input.clubId,
      scope_class_id: input.scopeClassId,
      program_type: input.programType,
      title: input.title,
      description: input.description,
      material_kind: input.sourceMimeType.startsWith("audio/")
        ? "audio"
        : "file",
      rights_basis: input.rightsBasis,
      rights_provenance: input.rightsSourceUrl ?? input.rightsNotes,
      rights_holder: input.rightsHolder,
      rights_license: input.licenseUrl,
      rights_review_note: input.rightsNotes,
      status: "draft",
      created_by: input.actorId,
      created_at: now,
      updated_at: now,
    })
    .select("id")
    .single();
  if (material.error) throw new Error(material.error.message);
  const version = await client
    .from(MATERIAL_TABLES.versions)
    .insert({
      id: input.versionId,
      material_id: input.materialId,
      version_number: 1,
      processing_status: "uploading",
      idempotency_key: input.idempotencyKey,
      ingest_bucket: "lms-material-ingest",
      ingest_path: input.ingestStoragePath,
      source_file_name: input.sourceFileName,
      source_mime_type: input.sourceMimeType,
      size_bytes: input.sourceSizeBytes,
      purpose: input.purpose ?? "material",
      processing_attempts: 0,
      created_by: input.actorId,
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single();
  if (version.error) {
    await client
      .from(MATERIAL_TABLES.materials)
      .delete()
      .eq("id", input.materialId);
    throw new Error(version.error.message);
  }
  return mapVersionRow(version.data as Record<string, unknown>);
}

export async function findVersionByIdempotency(
  client: PipelineClient,
  idempotencyKey: string,
) {
  const result = await client
    .from(MATERIAL_TABLES.versions)
    .select("*")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  if (result.error) throw new Error(result.error.message);
  return result.data
    ? mapVersionRow(result.data as Record<string, unknown>)
    : null;
}

export async function getVersion(client: PipelineClient, versionId: string) {
  const result = await client
    .from(MATERIAL_TABLES.versions)
    .select("*")
    .eq("id", versionId)
    .maybeSingle();
  if (result.error) throw new Error(result.error.message);
  return result.data
    ? mapVersionRow(result.data as Record<string, unknown>)
    : null;
}

export async function markVersionQueued(
  client: PipelineClient,
  versionId: string,
  sourceSha256: string,
  detectedMimeType: string,
  storage?: { originalBucket: string; originalPath: string },
) {
  const result = await client
    .from(MATERIAL_TABLES.versions)
    .update({
      processing_status: "queued",
      sha256: sourceSha256 || null,
      detected_mime_type: detectedMimeType,
      ...(storage ? { original_bucket: storage.originalBucket, original_path: storage.originalPath,
        ingest_bucket: null, ingest_path: null } : {}),
      error_code: null,
      error_message: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", versionId)
    .in("processing_status", ["uploading", "failed"])
    .select("*")
    .maybeSingle();
  if (result.error) throw new Error(result.error.message);
  return result.data
    ? mapVersionRow(result.data as Record<string, unknown>)
    : null;
}

export async function claimVersionLease(
  client: PipelineClient,
  version: MaterialVersionRow,
  token = randomUUID(),
) {
  if (
    !canClaimMaterialLease({
      status: version.status,
      leaseExpiresAt: version.lease_expires_at,
    })
  )
    return null;
  const now = new Date();
  const result = await client
    .from(MATERIAL_TABLES.versions)
    .update({
      processing_status: "converting",
      lease_token: token,
      lease_expires_at: buildLeaseExpiry(now),
      processing_attempts: version.processing_attempts + 1,
      updated_at: now.toISOString(),
    })
    .eq("id", version.id)
    .in("processing_status", ["queued", "converting"])
    .or(`lease_expires_at.is.null,lease_expires_at.lte.${now.toISOString()}`)
    .select("*")
    .maybeSingle();
  if (result.error) throw new Error(result.error.message);
  return result.data
    ? mapVersionRow(result.data as Record<string, unknown>)
    : null;
}

export async function completeVersion(
  client: PipelineClient,
  versionId: string,
  leaseToken: string,
) {
  const result = await client
    .from(MATERIAL_TABLES.versions)
    .update({
      processing_status: "ready",
      lease_token: null,
      lease_expires_at: null,
      error_code: null,
      error_message: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", versionId)
    .eq("lease_token", leaseToken)
    .eq("processing_status", "converting")
    .select("*")
    .maybeSingle();
  if (result.error) throw new Error(result.error.message);
  return result.data
    ? mapVersionRow(result.data as Record<string, unknown>)
    : null;
}

export async function failVersion(
  client: PipelineClient,
  versionId: string,
  leaseToken: string,
  errorCode: string,
  errorMessage: string,
  terminal: boolean,
) {
  const status = terminal ? "failed" : "queued";
  const result = await client
    .from(MATERIAL_TABLES.versions)
    .update({
      processing_status: status,
      lease_token: null,
      lease_expires_at: null,
      error_code: errorCode.slice(0, 120),
      error_message: errorMessage.slice(0, 2_000),
      updated_at: new Date().toISOString(),
    })
    .eq("id", versionId)
    .eq("lease_token", leaseToken)
    .eq("processing_status", "converting")
    .select("*")
    .maybeSingle();
  if (result.error) throw new Error(result.error.message);
  return result.data
    ? mapVersionRow(result.data as Record<string, unknown>)
    : null;
}

export async function insertRendition(
  client: PipelineClient,
  input: {
    materialId: string;
    versionId: string;
    storagePath: string;
    mimeType: string;
    sizeBytes: number;
    sha256: string;
  },
) {
  const result = await client
    .from(MATERIAL_TABLES.renditions)
    .upsert(
      {
        id: randomUUID(),
        version_id: input.versionId,
        rendition_kind: "pdf_preview",
        bucket_id: "lms-material-previews",
        storage_path: input.storagePath,
        mime_type: input.mimeType,
        size_bytes: input.sizeBytes,
        sha256: input.sha256,
        processing_status: "ready",
        created_at: new Date().toISOString(),
      },
      { onConflict: "version_id,rendition_kind,storage_path" },
    )
    .select("id, version_id, mime_type, size_bytes")
    .single();
  if (result.error) throw new Error(result.error.message);
  return result.data as {
    id: string;
    version_id: string;
    mime_type: string;
    size_bytes: number;
  };
}

export async function getRenditionById(
  client: PipelineClient,
  renditionId: string,
  versionId: string,
) {
  const result = await client
    .from(MATERIAL_TABLES.renditions)
    .select(
      "id, version_id, bucket_id, storage_path, mime_type, size_bytes, processing_status, rendition_kind, page_number",
    )
    .eq("id", renditionId)
    .eq("version_id", versionId)
    .eq("rendition_kind", "pdf_preview")
    .eq("processing_status", "ready")
    .maybeSingle();
  if (result.error) throw new Error(result.error.message);
  return result.data as Record<string, unknown> | null;
}

export async function listStaleVersions(
  client: PipelineClient,
  before: string,
  limit: number,
) {
  const result = await client
    .from(MATERIAL_TABLES.versions)
    .select(
      "id, material_id, ingest_bucket, ingest_path, original_bucket, original_path, processing_status, updated_at",
    )
    .eq("processing_status", "uploading")
    .lt("updated_at", before)
    .order("updated_at", { ascending: true })
    .limit(limit);
  if (result.error) throw new Error(result.error.message);
  return (result.data ?? []) as Array<Record<string, unknown>>;
}

export async function markVersionExpired(
  client: PipelineClient,
  versionId: string,
  staleUpdatedAt: string,
) {
  const result = await client
    .from(MATERIAL_TABLES.versions)
    .update({
      processing_status: "rejected",
      lease_token: null,
      lease_expires_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", versionId)
    .eq("processing_status", "uploading")
    .eq("updated_at", staleUpdatedAt)
    .select("id")
    .maybeSingle();
  if (result.error) throw new Error(result.error.message);
  return Boolean(result.data);
}

export function leaseDurationSeconds() {
  return MATERIAL_LEASE_SECONDS;
}
