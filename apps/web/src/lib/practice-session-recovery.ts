import { buildPracticeHref } from "./practice-prefill";
import type { PracticePrefill } from "./practice-prefill";
import type { DebateTopic } from "@/types";

export function buildPracticeRecoveryHref(prefill: PracticePrefill): string {
  // Locale comes from the existing next-intl router, never from a raw /vi prefix.
  return `${buildPracticeHref(prefill)}&resumeSetup=1`;
}

export function canResumePracticeSession(
  selectedTopic: DebateTopic | null,
  topic: DebateTopic | null | undefined,
  phase: string,
): boolean {
  return Boolean(
    selectedTopic &&
    topic &&
    (selectedTopic.topicKey ?? selectedTopic.id) ===
      (topic.topicKey ?? topic.id) &&
    ["mic-check", "prep", "speaking", "ai-rebuttal"].includes(phase),
  );
}
