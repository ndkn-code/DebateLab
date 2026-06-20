"use server";

import { createTypedServerClient } from "@/lib/supabase/server";
import { gradeQuestionResponse } from "@/lib/api/ielts/grading-repository";
import type { IeltsVerdict } from "@/lib/ielts/question-types/types";

/**
 * Submit one objective IELTS answer and receive a server-graded, key-free
 * verdict (Learn-mode immediate feedback).
 *
 * Grading is server-authoritative: the answer key is read only on the server
 * (service-role) and never returned. WS-2.1 owns persisting responses inside a
 * timed attempt — this action only grades, it does not write.
 */
export async function submitIeltsAnswer(raw: unknown): Promise<IeltsVerdict> {
  const supabase = await createTypedServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  return gradeQuestionResponse(raw);
}
