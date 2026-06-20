import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/supabase";
import type { SpeakingScorerGrounding } from "@/lib/ielts/speaking-scorer/prompt";

/**
 * IELTS Speaking exemplar corpus (WS-3.2) — retrieval-augmented grounding over
 * the *hand-authored* Band-9 material in `ielts_question_keys` (authoring spec
 * §5: Speaking ships a Band-9 sample answer/notes + per-criterion examiner
 * notes). Mirrors the Writing exemplar loader.
 *
 * Retrieval is keyed: the question's own Band-9 sample answer + examiner notes
 * are the calibration anchor; a few same-part-type samples broaden the style
 * reference. Answer keys have NO learner-readable RLS policy, so this runs with
 * the service-role admin client (server-only). Best-effort: any failure degrades
 * to empty grounding so scoring never blocks on the corpus.
 */
type AdminClient = SupabaseClient<Database>;
type IeltsQuestionType = Database["public"]["Enums"]["ielts_question_type"];

const MAX_PEER_EXEMPLARS = 2;
const MAX_EXEMPLAR_CHARS = 3000;
const MAX_EXAMINER_NOTES = 8;

const EMPTY_GROUNDING: SpeakingScorerGrounding = {
  questionSampleAnswer: null,
  examinerNotes: [],
  peerSampleAnswers: [],
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
      .filter(
        (item): item is string => typeof item === "string" && item.trim() !== "",
      )
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

export async function loadSpeakingExemplars(
  admin: AdminClient,
  params: { questionId: string; questionType: IeltsQuestionType },
): Promise<SpeakingScorerGrounding> {
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
    let peerSampleAnswers: string[] = [];
    if (peerIds.length > 0) {
      const { data: peerKeys } = await admin
        .from("ielts_question_keys")
        .select("model_answer")
        .in("question_id", peerIds)
        .not("model_answer", "is", null)
        .limit(MAX_PEER_EXEMPLARS);
      peerSampleAnswers = (peerKeys ?? [])
        .map((row) => truncate(row.model_answer))
        .filter((answer): answer is string => answer !== null);
    }

    return {
      questionSampleAnswer: truncate(key?.model_answer),
      examinerNotes: coerceExaminerNotes(key?.examiner_notes),
      peerSampleAnswers,
    };
  } catch {
    return EMPTY_GROUNDING;
  }
}
