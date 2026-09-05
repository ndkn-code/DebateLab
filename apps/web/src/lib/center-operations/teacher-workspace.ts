import type { TeacherRun } from "./contracts";

export const TEACHER_RUN_STAGES = [
  "loading_context",
  "reading_materials",
  "thinking",
  "saving",
  "completed",
  "failed",
  "stopped",
] as const;
export type TeacherRunStage = (typeof TEACHER_RUN_STAGES)[number];
export const TEACHER_RUN_DEADLINE_MS = 90_000;

export type TeacherWorkspaceLease = {
  run: TeacherRun;
  leaseToken: string;
  completed?: boolean;
};

export type TeacherWorkspaceDriver = {
  start: () => Promise<TeacherWorkspaceLease>;
  stage: (stage: TeacherRunStage, leaseToken: string) => Promise<void>;
  active: (leaseToken: string) => Promise<boolean>;
  complete: (
    status: "completed" | "failed" | "stopped",
    leaseToken: string,
    errorCode?: string,
  ) => Promise<void>;
};

export function teacherRunErrorCode(error: unknown): string {
  if (error instanceof Error && error.message === "TEACHER_RUN_STOPPED")
    return "stopped";
  if (error instanceof Error && error.message === "TEACHER_RUN_TIMEOUT")
    return "timeout";
  if (error instanceof Error && error.message === "TEACHER_RUN_STALE")
    return "stale_run";
  return "provider_error";
}

export async function runTeacherWorkspace<T>(input: {
  driver: TeacherWorkspaceDriver;
  work: (checkpoint: (stage: TeacherRunStage) => Promise<void>) => Promise<T>;
  deadlineMs?: number;
}): Promise<T> {
  const lease = await input.driver.start();
  if (lease.completed) throw new Error("TEACHER_RUN_ALREADY_COMPLETED");
  const deadlineMs = input.deadlineMs ?? TEACHER_RUN_DEADLINE_MS;
  let expired = false;
  let finished = false;
  const deadlineAt = Date.now() + deadlineMs;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      expired = true;
      reject(new Error("TEACHER_RUN_TIMEOUT"));
    }, deadlineMs);
  });
  const checkpoint = async (stage: TeacherRunStage) => {
    if (expired || Date.now() >= deadlineAt)
      throw new Error("TEACHER_RUN_TIMEOUT");
    if (finished) throw new Error("TEACHER_RUN_STALE");
    if (!(await input.driver.active(lease.leaseToken)))
      throw new Error("TEACHER_RUN_STALE");
    await input.driver.stage(stage, lease.leaseToken);
  };
  try {
    const result = await Promise.race([input.work(checkpoint), deadline]);
    await checkpoint("completed");
    await input.driver.complete("completed", lease.leaseToken);
    return result;
  } catch (error) {
    const code = teacherRunErrorCode(error);
    const status = code === "stopped" ? "stopped" : "failed";
    await input.driver
      .complete(status, lease.leaseToken, code)
      .catch(() => undefined);
    throw error;
  } finally {
    finished = true;
    if (timer) clearTimeout(timer);
  }
}
