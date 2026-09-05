import { withinDeadline } from "./deadline";

export async function loadRequiredProfile<T extends { onboarding_completed?: boolean | null }>(
  read: () => PromiseLike<{ data: T | null; error: unknown }>,
  milliseconds = 3_000,
): Promise<{ status: "ready"; profile: T } | { status: "onboarding" } | { status: "unavailable" }> {
  try {
    const result = await withinDeadline(read, milliseconds);
    if (result.error) return { status: "unavailable" };
    if (!result.data || !result.data.onboarding_completed) return { status: "onboarding" };
    return { status: "ready", profile: result.data };
  } catch {
    return { status: "unavailable" };
  }
}
