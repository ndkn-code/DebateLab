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
 */
export async function getActiveSubject(): Promise<Subject> {
  if (!IELTS_ENABLED) return DEFAULT_SUBJECT;
  const cookieStore = await cookies();
  return coerceSubject(cookieStore.get(SUBJECT_COOKIE_NAME)?.value);
}
