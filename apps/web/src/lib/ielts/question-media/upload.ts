/**
 * Upload one question stimulus image to the public `ielts-question-media`
 * bucket (format-variety pass). Validates type + size against the bucket's
 * limits before touching storage, lazily creates the bucket (same fallback as
 * listening-audio), and returns the stored path plus its public URL.
 *
 * Storage writes use the service-role client — the admin gate lives in the
 * calling server action (or the fixture importer, which passes a stable
 * `objectPath` so re-runs overwrite in place instead of piling up blobs).
 */
import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import {
  ALLOWED_QUESTION_MEDIA_TYPES,
  IELTS_QUESTION_MEDIA_BUCKET,
  MAX_QUESTION_MEDIA_BYTES,
  extensionForContentType,
  publicQuestionMediaUrl,
  questionMediaStoragePath,
} from "./storage-paths";

type AdminClient = SupabaseClient<Database>;
type StorageClient = AdminClient["storage"];

export interface UploadQuestionMediaInput {
  testId: string;
  bytes: Uint8Array | Buffer;
  contentType: string;
  /** Original file name; informational only (the object id is generated). */
  fileName?: string;
  /**
   * Explicit object path (e.g. `tests/<testId>/diagram-1.png`). When given the
   * upload overwrites in place (`upsert: true`) — used by the fixture importer
   * for idempotent asset paths. Otherwise a fresh id is minted and uploads never
   * overwrite.
   */
  objectPath?: string;
}

export interface UploadQuestionMediaResult {
  path: string;
  url: string;
}

async function ensureBucket(storage: StorageClient): Promise<void> {
  const { error } = await storage.getBucket(IELTS_QUESTION_MEDIA_BUCKET);
  if (!error) return;
  const { error: createError } = await storage.createBucket(IELTS_QUESTION_MEDIA_BUCKET, {
    public: true,
    allowedMimeTypes: [...ALLOWED_QUESTION_MEDIA_TYPES],
    fileSizeLimit: MAX_QUESTION_MEDIA_BYTES,
  });
  if (createError) throw new Error(`ensureBucket failed: ${createError.message}`);
}

/** Validate, then store one image; returns its storage path and public URL. */
export async function uploadQuestionMedia(
  admin: AdminClient,
  input: UploadQuestionMediaInput,
): Promise<UploadQuestionMediaResult> {
  const contentType = input.contentType.toLowerCase().split(";")[0].trim();
  const ext = extensionForContentType(contentType);
  if (!ext) {
    throw new Error(
      `Unsupported media type "${input.contentType}"; allowed: ${ALLOWED_QUESTION_MEDIA_TYPES.join(", ")}`,
    );
  }
  if (input.bytes.byteLength === 0) throw new Error("Media file is empty");
  if (input.bytes.byteLength > MAX_QUESTION_MEDIA_BYTES) {
    throw new Error(
      `Media file is ${input.bytes.byteLength} bytes; the limit is ${MAX_QUESTION_MEDIA_BYTES} bytes (5 MB)`,
    );
  }

  const path = input.objectPath ?? questionMediaStoragePath(input.testId, randomUUID(), ext);
  const upsert = input.objectPath !== undefined;

  await ensureBucket(admin.storage);
  const { error } = await admin.storage
    .from(IELTS_QUESTION_MEDIA_BUCKET)
    .upload(path, Buffer.from(input.bytes), {
      contentType,
      cacheControl: "3600",
      upsert,
    });
  if (error) throw new Error(`uploadQuestionMedia failed: ${error.message}`);

  const url = publicQuestionMediaUrl(process.env.NEXT_PUBLIC_SUPABASE_URL, path);
  if (!url) throw new Error("uploadQuestionMedia failed: NEXT_PUBLIC_SUPABASE_URL is not set");
  return { path, url };
}
