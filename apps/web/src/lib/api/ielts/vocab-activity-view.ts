import "server-only";

import { isDevAdminBypassEnabled } from "@/lib/dev-admin-bypass";
import { createTypedAdminClient } from "@/lib/supabase/admin";
import { createTypedServerClient } from "@/lib/supabase/server";
import type {
  IeltsTextActivityContent,
  IeltsTextActivityView,
} from "@/lib/ielts/learn/text-activities";

type VocabContent = Extract<
  IeltsTextActivityContent,
  { activityType: "ielts_vocab_collocation" }
>;

export async function loadVocabActivityView(
  content: VocabContent,
): Promise<IeltsTextActivityView> {
  const source = content.vocabSource;
  if (!source)
    throw new Error("loadVocabActivityView: missing vocabulary source");
  const client = isDevAdminBypassEnabled()
    ? createTypedAdminClient()
    : await createTypedServerClient();
  let query = client
    .from("vocab_items")
    .select("id, term, definition_en, definition_vi, example, collocations")
    .eq("subject", "ielts");
  if (source.bandTag) query = query.eq("band_tag", source.bandTag);
  if (source.topicTag) query = query.contains("topic_tags", [source.topicTag]);
  const { data, error } = await query.order("term").limit(source.limit);
  if (error) throw new Error(`loadVocabActivityView: ${error.message}`);
  const usable = (data ?? []).filter((item) => item.collocations.length > 0);
  if (usable.length === 0)
    throw new Error(
      "loadVocabActivityView: no vocabulary items match this bank source",
    );
  const answerPool = [...new Set(usable.flatMap((item) => item.collocations))];
  return {
    activityType: content.activityType,
    module: content.module,
    instruction: content.instruction,
    questions: usable.map((item, index) => {
      const correctAnswer = item.collocations[0];
      const distractors = answerPool
        .filter((answer) => answer !== correctAnswer)
        .slice(index, index + 3);
      return {
        questionId: item.id,
        skill: "writing",
        questionType: "multiple_choice",
        prompt: `Choose the best collocation for “${item.term}”.`,
        groupInstructions:
          item.definition_en || item.definition_vi || item.example,
        options: [correctAnswer, ...distractors].map((answer) => ({
          value: answer,
          label: answer,
        })),
        wordLimit: null,
        correctAnswer,
      };
    }),
  };
}
