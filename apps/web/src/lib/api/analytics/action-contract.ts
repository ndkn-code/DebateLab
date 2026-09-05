import "server-only";
import { z } from "zod";
import { AnalyticsForbidden } from "./access";
const DaysSchema = z
  .union([z.literal(7), z.literal(30), z.literal(90)])
  .default(30);
export const ClassAnalyticsSchema = z
  .object({ classId: z.string().uuid(), days: DaysSchema })
  .strict();
export const CentreAnalyticsSchema = z
  .object({ clubId: z.string().uuid(), days: DaysSchema })
  .strict();
export const PostMockExportSchema = ClassAnalyticsSchema.extend({
  assignmentId: z.string().uuid(),
  locale: z.enum(["en", "vi"]).default("vi"),
  format: z.enum(["xlsx", "csv"]).default("xlsx"),
});
export type AnalyticsActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: "unavailable" | "forbidden" };
export async function analyticsAction<T>(
  action: () => Promise<T>,
): Promise<AnalyticsActionResult<T>> {
  try {
    return { ok: true, data: await action() };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof AnalyticsForbidden || error instanceof z.ZodError
          ? "forbidden"
          : "unavailable",
    };
  }
}
