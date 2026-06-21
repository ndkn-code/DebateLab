"use client";

/**
 * Register the IELTS objective and Writing/Speaking capture surfaces with the
 * renderer registry. Objective items use the WS-1.2 family renderers; AI-scored
 * `writing_*` / `speaking_*` prompts use the WS-5.2 task surfaces
 * (masterplan §2.7: new behaviour via registered types, never editing the engine).
 * Idempotent — `QuestionHost` invokes it once before resolving a renderer.
 */
import {
  IELTS_SPEAKING_QUESTION_TYPES,
  IELTS_WRITING_QUESTION_TYPES,
} from "@/lib/api/ielts/schema";
import {
  ensureIeltsObjectiveRenderersRegistered,
  registerIeltsRenderer,
} from "../question-renderer-registry";
import { SpeakingTaskRenderer } from "./SpeakingTaskRenderer";
import { WritingTaskRenderer } from "./WritingTaskRenderer";

let registered = false;

export function ensureIeltsTaskRenderersRegistered(): void {
  if (registered) return;
  registered = true;
  ensureIeltsObjectiveRenderersRegistered();
  for (const type of IELTS_WRITING_QUESTION_TYPES) {
    registerIeltsRenderer(type, WritingTaskRenderer);
  }
  for (const type of IELTS_SPEAKING_QUESTION_TYPES) {
    registerIeltsRenderer(type, SpeakingTaskRenderer);
  }
}
