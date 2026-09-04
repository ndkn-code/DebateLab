/**
 * The teacher workspace write seam.
 *
 * Every mutation a teacher can trigger from `/dashboard/teacher/*` crosses this
 * boundary. It exists because the underlying RPCs speak in bare SQLSTATE
 * strings (`STALE_UPDATE`, `FORBIDDEN`, `IDEMPOTENCY_KEY_REUSED`) that must
 * never reach a teacher mid-class, and because a mutation that fails silently
 * during a lesson is worse than one that was never offered.
 *
 * Contract:
 * - Server actions in `app/actions/class-lms.ts` return `TeacherWorkspaceWriteResult`
 *   and never throw. A rejected write is data, not an exception.
 * - Every write carries an idempotency key that stays stable across retries of
 *   the same payload and changes when the payload changes.
 * - Every versioned write carries `expectedUpdatedAt`; a mismatch surfaces as
 *   `stale` so the teacher is told to reload rather than silently overwriting a
 *   colleague's edit.
 *
 * Pure module: no server-only imports, no React. Unit-tested in `write-seam.test.ts`.
 */

export const TEACHER_WORKSPACE_FAILURES = [
  "unauthorized",
  "forbidden",
  "stale",
  "replayed",
  "invalid",
  "register_closed",
  "unknown",
] as const;

export type TeacherWorkspaceFailure = (typeof TEACHER_WORKSPACE_FAILURES)[number];

export type TeacherWorkspaceWriteResult<T> =
  | { ok: true; data: T }
  | { ok: false; failure: TeacherWorkspaceFailure; message: string };

/** Raw RPC error strings, in the order they must be matched. */
const FAILURE_PATTERNS: Array<[RegExp, TeacherWorkspaceFailure]> = [
  [/\bSTALE_UPDATE\b/, "stale"],
  [/\bIDEMPOTENCY_KEY_REUSED\b/, "replayed"],
  [/\bIDEMPOTENCY_KEY_REQUIRED\b/, "invalid"],
  [/\bUNAUTHORIZED\b|\bAuth session missing\b/i, "unauthorized"],
  [/\bFORBIDDEN\b/, "forbidden"],
  [/\bATTENDANCE_OCCURRENCE_REQUIRED\b/, "register_closed"],
  [/\bINVALID_GRADE\b|\bINVALID_ATTENDANCE_STATUS\b/, "invalid"],
  [/was not enrolled in this class/i, "invalid"],
  [/\brow-level security\b|permission denied/i, "forbidden"],
];

export function classifyTeacherWorkspaceFailure(
  error: unknown,
): TeacherWorkspaceFailure {
  const message = error instanceof Error ? error.message : String(error ?? "");
  for (const [pattern, failure] of FAILURE_PATTERNS) {
    if (pattern.test(message)) return failure;
  }
  // Zod rejections carry a human sentence; an unrecognised bare code, or no
  // message at all, is a fault we cannot describe to a teacher.
  const trimmed = message.trim();
  if (!trimmed || /^[A-Z_]+$/.test(trimmed)) return "unknown";
  return "invalid";
}

const FAILURE_COPY: Record<TeacherWorkspaceFailure, { en: string; vi: string }> = {
  unauthorized: {
    en: "Your session expired. Sign in again, then retry — nothing was saved.",
    vi: "Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại rồi thử lại — chưa có gì được lưu.",
  },
  forbidden: {
    en: "You do not manage this class, so this change was not saved.",
    vi: "Bạn không phụ trách lớp này nên thay đổi chưa được lưu.",
  },
  stale: {
    en: "Someone else changed this first. Reload to see their version — your edit was not saved.",
    vi: "Người khác vừa sửa trước. Hãy tải lại để xem bản mới — thay đổi của bạn chưa được lưu.",
  },
  replayed: {
    en: "This save was already recorded with different values. Reload before editing again.",
    vi: "Thao tác này đã được ghi với giá trị khác. Hãy tải lại trước khi sửa tiếp.",
  },
  invalid: {
    en: "That value was rejected. Check the fields and try again — nothing was saved.",
    vi: "Giá trị không hợp lệ. Hãy kiểm tra lại các ô rồi thử lại — chưa có gì được lưu.",
  },
  register_closed: {
    en: "The register for this lesson has not been opened yet, so attendance cannot be corrected.",
    vi: "Sổ điểm danh của buổi này chưa được mở nên chưa thể sửa điểm danh.",
  },
  unknown: {
    en: "The save did not go through. Nothing was changed — try again.",
    vi: "Chưa lưu được. Không có gì thay đổi — hãy thử lại.",
  },
};

export function teacherWorkspaceFailureMessage(
  failure: TeacherWorkspaceFailure,
  locale: string,
): string {
  const copy = FAILURE_COPY[failure] ?? FAILURE_COPY.unknown;
  return locale === "vi" ? copy.vi : copy.en;
}

export function teacherWorkspaceWriteFailure(
  error: unknown,
  locale = "en",
): { ok: false; failure: TeacherWorkspaceFailure; message: string } {
  const failure = classifyTeacherWorkspaceFailure(error);
  return { ok: false, failure, message: teacherWorkspaceFailureMessage(failure, locale) };
}

/**
 * Idempotency keys must survive a retry of the *same* payload and change when
 * the payload changes, or the RPC answers `IDEMPOTENCY_KEY_REUSED`. Callers
 * hold one key per pending edit and drop it when the edit succeeds or its
 * inputs change.
 */
export function newTeacherWorkspaceIdempotencyKey(operation: string): string {
  const random =
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  return `tw-${operation}-${random}`.slice(0, 200);
}

/** Bilingual confirmation copy, so no surface invents its own success wording. */
export function teacherWorkspaceSavedMessage(locale: string): string {
  return locale === "vi" ? "Đã lưu." : "Saved.";
}
