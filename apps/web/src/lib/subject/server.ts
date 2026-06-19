import "server-only";
import { cookies } from "next/headers";
import { coerceSubject, type Subject } from "@thinkfy/shared/subject";
import { SUBJECT_COOKIE_NAME } from "./index";

/**
 * Resolve the active subject for the current request from the subject cookie
 * (mirrors how the theme is read server-side). Defaults to `debate`, so every
 * existing request renders byte-identically to today until a user opts into the
 * IELTS track.
 */
export async function getActiveSubject(): Promise<Subject> {
  const cookieStore = await cookies();
  return coerceSubject(cookieStore.get(SUBJECT_COOKIE_NAME)?.value);
}
