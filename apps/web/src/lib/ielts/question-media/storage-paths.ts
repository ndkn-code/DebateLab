/**
 * Storage bucket + path/URL helpers for IELTS question media (diagram / map /
 * plan figures, Writing Task 1 visuals). Pure + unit tested; mirrors the
 * listening-audio helpers. Objects live under `tests/<testId>/<id>.<ext>` so a
 * test's assets are enumerable and a fixture importer can choose a stable id.
 */

/** Public bucket holding question stimulus images (service-role write). */
export const IELTS_QUESTION_MEDIA_BUCKET = "ielts-question-media";

export const ALLOWED_QUESTION_MEDIA_TYPES = [
  "image/png",
  "image/jpeg",
  "image/svg+xml",
  "image/webp",
] as const;
export type QuestionMediaContentType = (typeof ALLOWED_QUESTION_MEDIA_TYPES)[number];

/** Matches the bucket's `file_size_limit` (5 MB). */
export const MAX_QUESTION_MEDIA_BYTES = 5 * 1024 * 1024;

const EXTENSION_BY_TYPE: Record<QuestionMediaContentType, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/svg+xml": "svg",
  "image/webp": "webp",
};

export function isAllowedQuestionMediaType(
  contentType: string,
): contentType is QuestionMediaContentType {
  return (ALLOWED_QUESTION_MEDIA_TYPES as readonly string[]).includes(contentType);
}

/** File extension for an allowed content type; null when the type is not allowed. */
export function extensionForContentType(contentType: string): string | null {
  return isAllowedQuestionMediaType(contentType) ? EXTENSION_BY_TYPE[contentType] : null;
}

/** Storage object path for one media object: `tests/<testId>/<id>.<ext>`. */
export function questionMediaStoragePath(testId: string, id: string, ext: string): string {
  return `tests/${testId}/${id}.${ext.replace(/^\.+/, "")}`;
}

/** Public URL for a stored media object (bucket is public-read). */
export function publicQuestionMediaUrl(
  supabaseUrl: string | undefined,
  storagePath: string | null,
): string | null {
  if (!supabaseUrl || !storagePath) return null;
  const base = supabaseUrl.replace(/\/+$/, "");
  return `${base}/storage/v1/object/public/${IELTS_QUESTION_MEDIA_BUCKET}/${storagePath}`;
}
