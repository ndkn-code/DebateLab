import { z } from "zod";
import { SUBJECTS } from "@thinkfy/shared/subject";

export * from "@thinkfy/shared/subject";

/**
 * Active-subject persistence — mirrors the theme cookie in `lib/theme.ts`.
 *
 * The cookie is the source of truth for the active subject in server components
 * (read via `getActiveSubject()` in `lib/subject/server.ts`) and is written by
 * the `saveSubjectPreference` server action, which also mirrors it into
 * `profiles.preferences.subject` for cross-device persistence (no new column).
 * `httpOnly: false` keeps it client-readable too, exactly like the theme cookie.
 */
export const SUBJECT_COOKIE_NAME = "thinkfy_subject";
export const SUBJECT_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** Zod schema for the subject axis — used with `parseInput` at action boundaries. */
export const SubjectSchema = z.enum(SUBJECTS);
