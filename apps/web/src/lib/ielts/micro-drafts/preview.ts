import type { Json } from "@/types/supabase";

export function readAnswerKeyPreview(answerKey: Json): string {
  return JSON.stringify(answerKey).slice(0, 400);
}
