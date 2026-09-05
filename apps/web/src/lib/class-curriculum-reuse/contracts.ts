import { z } from "zod";

export type ReuseSource = {
  id: string;
  actorId: string;
  title: string;
  clubId: string;
  clubName: string;
  programType: "debate" | "ielts" | "public_speaking";
  startDate: string | null;
  endDate: string | null;
};
export type ReuseItem = {
  id: string;
  title: string;
  eligible: boolean;
  reason: string | null;
};
export type ReusePreview = {
  source: ReuseSource;
  fingerprint: string;
  courses: (ReuseItem & {
    modules: { id: string; title: string; lessonCount: number }[];
  })[];
  materials: (ReuseItem & {
    releaseAt: string | null;
    expiresAt: string | null;
  })[];
  assignments: (ReuseItem & { dueAt: string | null })[];
  legacyResourceCount: number;
  datePreview?: {
    dayOffset: number | null;
    assignments: { id: string; dueAt: string | null }[];
    materials: {
      id: string;
      releaseAt: string | null;
      expiresAt: string | null;
    }[];
  } | null;
};

export function validCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return (
    Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}
const calendarDate = z
  .string()
  .refine(validCalendarDate, "REUSE_INVALID_DATES")
  .nullable();
const idList = z
  .array(z.string().uuid())
  .max(200)
  .refine((ids) => new Set(ids).size === ids.length);
export const reuseDatesSchema = z
  .object({
    startDate: calendarDate,
    endDate: calendarDate,
    dateMode: z.enum(["clear", "shift"]),
    timezone: z
      .string()
      .min(1)
      .max(100)
      .refine((value) => {
        try {
          new Intl.DateTimeFormat("en", { timeZone: value });
          return true;
        } catch {
          return false;
        }
      }),
    assignmentIds: idList,
    materialPlacementIds: idList,
  })
  .refine(
    (data) =>
      !data.startDate || !data.endDate || data.endDate >= data.startDate,
    "REUSE_INVALID_DATES",
  );
export const reuseInputSchema = reuseDatesSchema
  .safeExtend({
    sourceClassId: z.string().uuid(),
    title: z.string().trim().min(1).max(200),
    courseIds: idList,
    previewFingerprint: z.string().min(1).max(128),
    idempotencyKey: z.string().uuid(),
  })
  .strict();
export type ReuseDates = z.infer<typeof reuseDatesSchema>;
export type ReuseInput = z.infer<typeof reuseInputSchema>;
export type ReuseResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: string };

export function reuseErrorCode(error: unknown): string {
  if (error instanceof z.ZodError) return "REUSE_INVALID_INPUT";
  const message = error instanceof Error ? error.message : String(error);
  const known = message.match(
    /REUSE_(?:SOURCE_CHANGED|INVALID_DATES|INVALID_TIMEZONE|DST_GAP|DATE_OUTSIDE_CLASS|INVALID_INPUT|INELIGIBLE_SELECTION|FORBIDDEN|NOT_FOUND|IDEMPOTENCY_CONFLICT)/,
  )?.[0];
  if (known) return known;
  if (/FORBIDDEN|Unauthorized|Forbidden|not authenticated/i.test(message))
    return "REUSE_FORBIDDEN";
  if (/idempotency.*(conflict|mismatch)|IDEMPOTENCY_KEY_REUSE/i.test(message))
    return "REUSE_IDEMPOTENCY_CONFLICT";
  return "REUSE_FAILED";
}
