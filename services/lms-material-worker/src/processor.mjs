import { createHash, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import {
  MATERIAL_BUCKETS,
  MATERIAL_MAX_ATTEMPTS,
  MATERIAL_PREVIEW_TTL_SECONDS,
  buildLeaseExpiry,
  canClaimMaterialLease,
  createPreviewStoragePath,
} from "./contracts.mjs";
import { downloadAndConvertMaterial } from "./converter.mjs";
import { createLlamaParseAdapter } from "./llamaparse.mjs";
import {
  processQuestionImportVersion,
  releaseQuestionImportVersionQuota,
} from "./question-import.mjs";

function requiredEnvironment(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}.`);
  return value;
}

function hashBytes(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function buildDraftMaterialDocument(input) {
  const title = input.title.trim() || "Untitled material";
  const text = input.text.trim();
  return {
    schemaVersion: 1,
    title,
    sourceVersionId: input.versionId,
    language: "en",
    sections: [
      {
        id: "section-1",
        title,
        blocks: [
          {
            id: "page-preview-1",
            type: "page_preview",
            renditionId: input.renditionId,
            pageNumber: 1,
            alt: `${title} preview`,
          },
          ...(text
            ? [{ id: "extracted-text-1", type: "paragraph", text }]
            : []),
        ],
      },
    ],
  };
}

function createProductionDependencies() {
  const supabase = createClient(
    requiredEnvironment("SUPABASE_URL"),
    requiredEnvironment("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  return { supabase, convert: downloadAndConvertMaterial };
}

let productionDependencies;

function dependencies() {
  productionDependencies ??= createProductionDependencies();
  return productionDependencies;
}

async function getVersion(supabase, versionId) {
  const result = await supabase
    .from("lms_material_versions")
    .select("*")
    .eq("id", versionId)
    .maybeSingle();
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

async function claimVersionLease(supabase, version, now = new Date()) {
  if (!canClaimMaterialLease(version, now)) return null;
  const leaseToken = randomUUID();
  const result = await supabase
    .from("lms_material_versions")
    .update({
      processing_status: "converting",
      lease_token: leaseToken,
      lease_expires_at: buildLeaseExpiry(now),
      processing_attempts: Number(version.processing_attempts ?? 0) + 1,
      updated_at: now.toISOString(),
    })
    .eq("id", version.id)
    .in("processing_status", ["queued", "converting"])
    .or(`lease_expires_at.is.null,lease_expires_at.lte.${now.toISOString()}`)
    .select("*")
    .maybeSingle();
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

async function failVersion(supabase, version, error) {
  const message = error instanceof Error ? error.message : "Material conversion failed.";
  // A provider job that is still running must retain its durable id and remain retryable.
  const externallyPending = /LLAMAPARSE_PENDING|SUBMIT_AMBIGUOUS|PENDING_TIMEOUT/.test(message);
  const terminal = !externallyPending && Number(version.processing_attempts ?? 0) >= MATERIAL_MAX_ATTEMPTS;
  const result = await supabase
    .from("lms_material_versions")
    .update({
      processing_status: terminal ? "failed" : "queued",
      lease_token: null,
      lease_expires_at: null,
      error_code: "CONVERSION_FAILED",
      error_message: message.slice(0, 2_000),
      updated_at: new Date().toISOString(),
    })
    .eq("id", version.id)
    .eq("lease_token", version.lease_token)
    .eq("processing_status", "converting");
  if (result.error) throw new Error(result.error.message);
  return terminal;
}

export async function processMaterialVersion(versionId, injectedDependencies) {
  const { supabase, convert } = injectedDependencies ?? dependencies();
  const current = await getVersion(supabase, versionId);
  if (!current || current.processing_status === "ready" || current.processing_status === "rejected" || current.processing_status === "failed") {
    return "skipped";
  }
  if (current.purpose === "question_import" &&
      (!/^(true|1)$/i.test(process.env.LMS_QUESTION_IMPORT_ENABLED ?? "") ||
       !/^(true|1)$/i.test(process.env.LMS_QUESTION_IMPORT_COMPLIANCE_APPROVED ?? ""))) {
    throw new Error("QUESTION_IMPORT_DISABLED");
  }
  const claimed = await claimVersionLease(supabase, current);
  if (!claimed) return "lease_active";
  try {
    if (!claimed.lease_token || !claimed.original_path) {
      throw new Error("Material lease or original path is missing.");
    }
    if (claimed.purpose === "question_import") {
      await processQuestionImportVersion({ supabase, version: claimed, parse: injectedDependencies?.parse ?? createLlamaParseAdapter() });
      const completed = await supabase.from("lms_material_versions").update({ processing_status: "ready", lease_token: null, lease_expires_at: null, error_code: null, error_message: null, updated_at: new Date().toISOString() }).eq("id", claimed.id).eq("lease_token", claimed.lease_token).eq("processing_status", "converting").select("id").maybeSingle();
      if (completed.error) throw new Error(completed.error.message);
      return completed.data ? "completed" : "lease_lost";
    }
    const signed = await supabase.storage
      .from(MATERIAL_BUCKETS.originals)
      .createSignedUrl(claimed.original_path, MATERIAL_PREVIEW_TTL_SECONDS);
    if (signed.error) throw new Error(signed.error.message);

    const conversion = await convert({
      sourceUrl: signed.data.signedUrl,
      mimeType: claimed.detected_mime_type ?? "application/octet-stream",
      fileName: claimed.source_file_name,
      materialId: claimed.material_id,
      versionId: claimed.id,
    });
    const bytes = new TextEncoder().encode(conversion.text);
    const previewPath = createPreviewStoragePath(
      claimed.material_id,
      claimed.id,
    );
    const upload = await supabase.storage
      .from(MATERIAL_BUCKETS.previews)
      .upload(previewPath, bytes, {
        contentType: "text/plain",
        upsert: true,
      });
    if (upload.error) throw new Error(upload.error.message);

    const rendition = await supabase
      .from("lms_material_renditions")
      .upsert(
        {
          id: randomUUID(),
          version_id: claimed.id,
          rendition_kind: "pdf_preview",
          bucket_id: MATERIAL_BUCKETS.previews,
          storage_path: previewPath,
          mime_type: "text/plain",
          size_bytes: bytes.byteLength,
          sha256: hashBytes(bytes),
          processing_status: "ready",
          created_at: new Date().toISOString(),
        },
        { onConflict: "version_id,rendition_kind,storage_path" },
      )
      .select("id")
      .single();
    if (rendition.error) throw new Error(rendition.error.message);

    const draftDocument = buildDraftMaterialDocument({
      title: conversion.title ?? claimed.source_file_name,
      versionId: claimed.id,
      renditionId: rendition.data.id,
      text: conversion.text,
    });
    const draftUpdate = await supabase
      .from("lms_material_versions")
      .update({
        native_document: draftDocument,
        updated_at: new Date().toISOString(),
      })
      .eq("id", claimed.id)
      .eq("lease_token", claimed.lease_token);
    if (draftUpdate.error) throw new Error(draftUpdate.error.message);

    const completed = await supabase
      .from("lms_material_versions")
      .update({
        processing_status: "ready",
        lease_token: null,
        lease_expires_at: null,
        error_code: null,
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", claimed.id)
      .eq("lease_token", claimed.lease_token)
      .eq("processing_status", "converting")
      .select("id")
      .maybeSingle();
    if (completed.error) throw new Error(completed.error.message);
    return completed.data ? "completed" : "lease_lost";
  } catch (error) {
    const terminal = await failVersion(supabase, claimed, error);
    if (terminal) {
      if (claimed.purpose === "question_import") {
        await releaseQuestionImportVersionQuota({ supabase, version: claimed, error });
      }
      return "failed";
    }
    throw error;
  }
}
