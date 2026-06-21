import "server-only";
import { cookies } from "next/headers";
import { coerceSubject, DEFAULT_SUBJECT, type Subject } from "@thinkfy/shared/subject";
import { IELTS_ENABLED } from "@/lib/features";
import { SUBJECT_COOKIE_NAME } from "./index";

/**
 * Resolve the active subject for the current request from the subject cookie
 * (mirrors how the theme is read server-side). Defaults to `debate`, so every
 * existing request renders byte-identically to today until a user opts into the
 * IELTS track.
 *
 * The IELTS launch flag (WS-5.1) is enforced here: while `IELTS_ENABLED` is off,
 * the active subject is forced to `debate` regardless of the cookie, so a stale
 * `ielts` preference cannot light up the (gated) IELTS nav/surface. This makes
 * the whole app debate-identical when the flag is off, in one place.
 *
 * Admin preview: callers that have already loaded the viewer's role (the
 * protected layout) pass `ieltsAccessible: true` so admins can opt into the
 * IELTS track in production before launch — without this resolver adding an
 * auth round-trip to every protected request. Defaults to the flag, so call
 * sites that don't know the role stay debate-identical while the flag is off.
 */
export async function getActiveSubject(opts?: {
  ieltsAccessible?: boolean;
}): Promise<Subject> {
  const accessible = opts?.ieltsAccessible ?? IELTS_ENABLED;
  if (!accessible) return DEFAULT_SUBJECT;
  const cookieStore = await cookies();
  return coerceSubject(cookieStore.get(SUBJECT_COOKIE_NAME)?.value);
}
