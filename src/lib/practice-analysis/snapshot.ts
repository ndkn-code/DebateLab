import { createHash } from "node:crypto";
import {
  PRACTICE_FEEDBACK_PROMPT_BUNDLE_VERSION,
  getRubricKeyForPracticeTrack,
} from "./constants";
import type {
  PracticeAnalysisInput,
  PracticeAttemptSnapshot,
} from "./types";

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortJson);
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, sortJson(item)])
  );
}

export function canonicalJson(value: unknown) {
  return JSON.stringify(sortJson(value));
}

export function sha256Hex(value: unknown) {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

export function buildPracticeAttemptSnapshot(
  input: PracticeAnalysisInput,
  capturedAt = new Date().toISOString()
): PracticeAttemptSnapshot {
  return {
    schemaVersion: 1,
    capturedAt,
    analysisParams: {
      transcript: input.transcript,
      topic: input.topic,
      side: input.side,
      speechType: input.speechType,
      timeLimit: input.timeLimit,
      actualDuration: input.actualDuration,
      practiceTrack: input.practiceTrack,
      practiceLanguage: input.practiceLanguage,
      isFullRound: input.isFullRound,
      rounds: input.rounds,
    },
    session: {
      mode: input.mode,
      prepTime: input.prepTime,
      speechTime: input.speechTime,
      prepNotes: input.prepNotes ?? null,
      aiDifficulty: input.aiDifficulty ?? null,
      topicId: input.topicId ?? null,
      practiceTopicKey: input.practiceTopicKey ?? null,
      topicCategory: input.topicCategory,
      topicCategoryKey: input.topicCategoryKey ?? null,
      topicDifficulty: input.topicDifficulty,
      audioStoragePath: input.audioStoragePath ?? null,
      clubContext: input.clubContext ?? null,
    },
  };
}

export function createPracticeInputHash(input: PracticeAnalysisInput) {
  return sha256Hex({
    transcript: input.transcript,
    topic: input.topic,
    side: input.side,
    speechType: input.speechType,
    timeLimit: input.timeLimit,
    actualDuration: input.actualDuration,
    practiceTrack: input.practiceTrack,
    practiceLanguage: input.practiceLanguage,
    isFullRound: input.isFullRound,
    rounds: input.rounds ?? [],
    promptBundleVersion: PRACTICE_FEEDBACK_PROMPT_BUNDLE_VERSION,
    rubricKey: getRubricKeyForPracticeTrack(input.practiceTrack),
  });
}

export function createPromptHash(prompt: string) {
  return sha256Hex({
    prompt,
    promptBundleVersion: PRACTICE_FEEDBACK_PROMPT_BUNDLE_VERSION,
  });
}
