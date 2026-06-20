"use client";

/**
 * Register the IELTS Writing/Speaking capture surfaces with the renderer registry
 * (WS-5.2). The objective renderers are untouched; these add rich, registered
 * task surfaces for the AI-scored `writing_*` / `speaking_*` question types
 * (masterplan §2.7: new behaviour via registered types, never editing the engine).
 * Idempotent — `QuestionHost` invokes it once before resolving a renderer.
 */
import {
  IELTS_SPEAKING_QUESTION_TYPES,
  IELTS_WRITING_QUESTION_TYPES,
} from "@/lib/api/ielts/schema";
import { registerIeltsRenderer } from "../question-renderer-registry";
import { SpeakingTaskRenderer } from "./SpeakingTaskRenderer";
import { WritingTaskRenderer } from "./WritingTaskRenderer";

let registered = false;

export function ensureIeltsTaskRenderersRegistered(): void {
  if (registered) return;
  registered = true;
  for (const type of IELTS_WRITING_QUESTION_TYPES) {
    registerIeltsRenderer(type, WritingTaskRenderer);
  }
  for (const type of IELTS_SPEAKING_QUESTION_TYPES) {
    registerIeltsRenderer(type, SpeakingTaskRenderer);
  }
}
