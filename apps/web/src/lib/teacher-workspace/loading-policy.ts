import {
  isHeadTeacherWorkspaceSurface,
  type TeacherWorkspaceSurface,
} from "./presentation";

/** Partial fork of Lumist manager-dashboard.service.ts's per-resource load plan.
 * No automatic retries: one explicit refresh revalidates authorization first.
 */
export function teacherWorkspaceLoadPlan(surface: TeacherWorkspaceSurface) {
  const head = isHeadTeacherWorkspaceSurface(surface);
  return {
    calendar: head || surface === "calendar" || surface === "attendance",
    details: head || surface === "attendance",
    reviews: head || surface === "review-queue",
    assignments: head || surface === "assignments",
    materials: head || surface === "materials",
    announcements: head || surface === "announcements",
    gradebook: head || surface === "gradebook",
  };
}

/** Bounds presentation waiting, including auth. Existing SDK reads may finish in
 * the background; their eventual values cannot mutate the returned model.
 * This deliberately does not claim cancellation of a non-abortable SDK call.
 */
export async function withTeacherWorkspaceDeadline<T>(
  load: () => Promise<T>,
  timeoutMs: number,
): Promise<T> {
  if (timeoutMs <= 0) throw new Error("Teacher workspace request timed out");
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve().then(load),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("Teacher workspace request timed out")),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
