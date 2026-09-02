/** Pure initial-state helpers for `MockTestPlayer` (split out for the file-size cap). */
import type { AttemptState, MockStructure } from "@/lib/api/ielts/mock-repository";

export type Phase = "intro" | "running" | "done";

export function initialPhase(initialState?: AttemptState): Phase {
  if (!initialState) return "intro";
  // A finalized attempt (reload after "Finish test", or a recovered submit)
  // must not drop the learner back into locked sections with no way out.
  return initialState.attempt.status === "in_progress" ? "running" : "done";
}

export function initialAttemptState(initialState?: AttemptState): AttemptState | null {
  return initialState ?? null;
}

export function initialStructure(
  structure: MockStructure,
  initialState?: AttemptState,
): MockStructure {
  return initialState?.structure ?? structure;
}
