import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/supabase";
import type { WritingScorerGrounding } from "@/lib/ielts/writing-scorer/prompt";

/**
 * IELTS Writing exemplar corpus (WS-3.1) — retrieval-augmented grounding over
 * the *hand-authored* Band-9 material in `ielts_question_keys` (data-access §8:
 * "the Band-9 model seeds the exemplar RAG corpus used by the Writing scorer").
 *
 * Retrieval is keyed: the question's own Band-9 model answer + examiner notes
 * are the primary calibration anchor; a few same-task-type exemplars broaden the
 * rewrite's style reference. Answer keys have NO learner-readable RLS policy, so
 * this runs with the service-role admin client (server-only). Best-effort: any
 * failure degrades to empty grounding so scoring never blocks on the corpus.
 */
type AdminClient = SupabaseClient<Database>;
type IeltsQuestionType = Database["public"]["Enums"]["ielts_question_type"];

const MAX_PEER_EXEMPLARS = 2;
const MAX_EXEMPLAR_CHARS = 4000;
const MAX_EXAMINER_NOTES = 8;

const EMPTY_GROUNDING: WritingScorerGrounding = {
  questionModelAnswer: null,
  examinerNotes: [],
  peerModelAnswers: [],
};

function truncate(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > MAX_EXEMPLAR_CHARS
    ? trimmed.slice(0, MAX_EXEMPLAR_CHARS)
    : trimmed;
}

/** Examiner notes are free-form jsonb (array of strings or per-criterion map). */
function coerceExaminerNotes(value: Json | null | undefined): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string" && item.trim() !== "")
      .slice(0, MAX_EXAMINER_NOTES);
  }
  if (value && typeof value === "object") {
    return Object.entries(value)
      .filter(([, note]) => typeof note === "string" && note.trim() !== "")
      .map(([criterion, note]) => `${criterion}: ${note as string}`)
      .slice(0, MAX_EXAMINER_NOTES);
  }
  return [];
}

export async function loadWritingExemplars(
  admin: AdminClient,
  params: { questionId: string; questionType: IeltsQuestionType },
): Promise<WritingScorerGrounding> {
  try {
    const { data: key } = await admin
      .from("ielts_question_keys")
      .select("model_answer, examiner_notes")
      .eq("question_id", params.questionId)
      .maybeSingle();

    const { data: peerQuestions } = await admin
      .from("ielts_questions")
      .select("id")
      .eq("question_type", params.questionType)
      .neq("id", params.questionId)
      .limit(8);

    const peerIds = (peerQuestions ?? []).map((row) => row.id);
    let peerModelAnswers: string[] = [];
    if (peerIds.length > 0) {
      const { data: peerKeys } = await admin
        .from("ielts_question_keys")
        .select("model_answer")
        .in("question_id", peerIds)
        .not("model_answer", "is", null)
        .limit(MAX_PEER_EXEMPLARS);
      peerModelAnswers = (peerKeys ?? [])
        .map((row) => truncate(row.model_answer))
        .filter((answer): answer is string => answer !== null);
    }

    return {
      questionModelAnswer: truncate(key?.model_answer),
      examinerNotes: coerceExaminerNotes(key?.examiner_notes),
      peerModelAnswers,
    };
  } catch {
    return EMPTY_GROUNDING;
  }
}
