/**
 * Canonical homework upload MIME types.
 *
 * `finalize_homework_submission` re-reads the storage object and rejects the
 * submission with `STORAGE_OBJECT_MIME_MISMATCH` when the object's recorded
 * mimetype is distinct from the `assignment_submission_files.mime_type` written
 * at reserve time. The browser's `File.type` cannot be trusted for that
 * comparison: it is empty for .m4a and for many .docx on Windows/Safari, and
 * supabase-js then defaults the upload's content type to
 * `text/plain;charset=UTF-8` — a mismatch that fails the student *after* the
 * bytes have already been uploaded.
 *
 * So both sides derive the MIME from the file extension instead. The server
 * records `canonicalMimeType(fileName)` and hands the same value back as the
 * upload target's `mimeType`; the client uploads with exactly that value.
 *
 * The map is a strict subset of the `assignment-submissions` bucket's
 * `allowed_mime_types` allowlist (see
 * supabase/migrations/20260708205016_homework_loop.sql) — storage itself
 * rejects anything outside it, so an extension without an entry here can never
 * complete an upload and must be refused before the reservation is made.
 *
 * Dependency-free and free of `server-only` on purpose: the server action and
 * the browser upload path both import it.
 */
export const HOMEWORK_MIME_BY_EXTENSION = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  wav: "audio/wav",
} as const;

export type HomeworkFileExtension = keyof typeof HOMEWORK_MIME_BY_EXTENSION;

/** Every extension a homework upload can actually complete with. */
export const HOMEWORK_SUPPORTED_EXTENSIONS = Object.keys(
  HOMEWORK_MIME_BY_EXTENSION,
) as HomeworkFileExtension[];

/** Lowercase, punctuation-stripped extension without the leading dot. */
export function homeworkFileExtension(fileName: string): string {
  const sanitized = fileName.trim().toLowerCase();
  const index = sanitized.lastIndexOf(".");
  const raw = index >= 0 ? sanitized.slice(index + 1) : "";
  return raw.replace(/[^a-z0-9]/g, "");
}

export function isSupportedHomeworkExtension(value: string): value is HomeworkFileExtension {
  return Object.prototype.hasOwnProperty.call(HOMEWORK_MIME_BY_EXTENSION, value);
}

/**
 * The MIME type the server records and the client uploads with, or `null` when
 * the extension is one storage would reject anyway.
 */
export function canonicalMimeType(fileName: string): string | null {
  const ext = homeworkFileExtension(fileName);
  return isSupportedHomeworkExtension(ext) ? HOMEWORK_MIME_BY_EXTENSION[ext] : null;
}

/**
 * Intersect a teacher-authored extension list with what storage accepts, so an
 * assignment configured with e.g. `heic` cannot advertise an upload the bucket
 * will reject after the fact. An empty intersection falls back to the full
 * supported list rather than blocking uploads entirely.
 */
export function normalizeAllowedExtensions(raw: string[] | null | undefined): string[] {
  const requested = (raw ?? [])
    .map((ext) => ext.trim().toLowerCase().replace(/^\./, "").replace(/[^a-z0-9]/g, ""))
    .filter((ext) => ext.length > 0);
  if (requested.length === 0) return [...HOMEWORK_SUPPORTED_EXTENSIONS];
  const allowed = HOMEWORK_SUPPORTED_EXTENSIONS.filter((ext) => requested.includes(ext));
  return allowed.length > 0 ? allowed : [...HOMEWORK_SUPPORTED_EXTENSIONS];
}

/** `accept=` value for the file input: `.pdf,.docx,application/pdf,…`. */
export function homeworkAcceptAttribute(extensions: string[]): string {
  const exts = extensions.filter((ext) => isSupportedHomeworkExtension(ext));
  const list = exts.length > 0 ? exts : HOMEWORK_SUPPORTED_EXTENSIONS;
  const mimes = Array.from(new Set(list.map((ext) => HOMEWORK_MIME_BY_EXTENSION[ext])));
  return [...list.map((ext) => `.${ext}`), ...mimes].join(",");
}
