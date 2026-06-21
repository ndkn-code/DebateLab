import assert from "node:assert/strict";

import {
  assertContentMatchesAnswerKey,
  assertNoAnswerKeyLeak,
  findAnswerKeyLeakPath,
  type GeneratedMicroDraft,
} from "./schema";
import {
  buildMicroDraftInsert,
  buildPublishedActivityInsert,
  fallbackSubskillKey,
  type MicroDraftSourceContext,
} from "./model";

const source: MicroDraftSourceContext = {
  testId: "00000000-0000-4000-8000-000000000001",
  questionId: "00000000-0000-4000-8000-000000000002",
  passageId: "00000000-0000-4000-8000-000000000003",
  listeningSectionId: null,
  skill: "reading",
  questionType: "sentence_completion",
  prompt: "Complete the sentence.",
  groupInstructions: "NO MORE THAN TWO WORDS",
  sourceText: "The coastal survey found a sharp decline in native seagrass.",
  correctAnswer: { value: "native seagrass" },
  acceptVariants: ["seagrass"],
  explanationEn: "The phrase appears in paragraph B.",
  explanationVi: "Cụm này xuất hiện ở đoạn B.",
  modelAnswer: null,
  subskills: [
    {
      key: "reading:sentence_completion",
      skill: "reading",
      labelEn: "Sentence completion",
      labelVi: "Hoàn thành câu",
      kind: "question_type",
      questionType: "sentence_completion",
      tags: ["completion"],
    },
    {
      key: "reading:paraphrase_recognition",
      skill: "reading",
      labelEn: "Paraphrase recognition",
      labelVi: "Nhận diện diễn đạt tương đương",
      kind: "micro_skill",
      questionType: null,
      tags: ["paraphrase"],
    },
  ],
};

const gapDraft: GeneratedMicroDraft = {
  activityType: "ielts_gap_fill",
  subskillKey: null,
  content: {
    type: "ielts_gap_fill",
    title: { en: "Complete the key phrase", vi: "Hoàn thành cụm từ chính" },
    instruction: { en: "Fill the blank.", vi: "Điền chỗ trống." },
    prompt: { en: "Use words from the passage.", vi: "Dùng từ trong bài đọc." },
    sourceAttribution: {
      en: "Based on the reading passage.",
      vi: "Dựa trên bài đọc.",
    },
    estimatedMinutes: 3,
    textWithBlank: "The survey found a decline in [[blank]].",
    blankLabel: "1",
    wordLimit: 2,
  },
  answerKey: {
    type: "ielts_gap_fill",
    correctAnswers: ["native seagrass"],
    acceptVariants: ["seagrass"],
    caseSensitive: false,
    explanationEn: "The source sentence names native seagrass.",
    explanationVi: "Câu nguồn nêu native seagrass.",
  },
  rationaleEn: "Practices completion under an IELTS word limit.",
  rationaleVi: "Luyện hoàn thành câu theo giới hạn từ IELTS.",
  sourceTextQuote: "sharp decline in native seagrass",
};

assert.equal(
  findAnswerKeyLeakPath({
    title: { en: "Title", vi: "Tiêu đề" },
    nested: [{ correctAnswer: "A" }],
  }),
  "content.nested[0].correctAnswer",
);
assert.throws(
  () => assertNoAnswerKeyLeak({ answerKey: { correctOptionId: "a" } }),
  /answer-key data/,
);

assertContentMatchesAnswerKey(gapDraft.content, gapDraft.answerKey);
assert.equal(
  fallbackSubskillKey({ activityType: "ielts_gap_fill", source }),
  "reading:sentence_completion",
);
assert.equal(
  fallbackSubskillKey({ activityType: "ielts_paraphrase_transform", source }),
  "reading:paraphrase_recognition",
);

const insert = buildMicroDraftInsert({
  source,
  draft: gapDraft,
  audit: {
    providerLabel: "google",
    modelName: "gemini-2.5-flash",
    generatedAt: "2026-06-21T00:00:00.000Z",
  },
  createdBy: "00000000-0000-4000-8000-000000000004",
});
assert.equal(insert.subskill_key, "reading:sentence_completion");
assert.equal(insert.status, "needs_review");
assert.equal(insert.answer_key, gapDraft.answerKey);
assert.equal(insert.draft_content, gapDraft.content);
assert.match(JSON.stringify(insert.provenance), /answerKeyStoredSeparately/);

const activityInsert = buildPublishedActivityInsert({
  draftId: "00000000-0000-4000-8000-000000000005",
  moduleId: "00000000-0000-4000-8000-000000000006",
  orderIndex: 7,
  draft: {
    activity_type: "ielts_gap_fill",
    draft_content: gapDraft.content,
    rationale_en: gapDraft.rationaleEn,
    rationale_vi: gapDraft.rationaleVi,
    source_question_id: source.questionId,
    source_passage_id: source.passageId,
    source_listening_section_id: null,
    subskill_key: "reading:sentence_completion",
    test_id: source.testId,
  },
});
const activityJson = JSON.stringify(activityInsert);
assert.equal(activityInsert.order_index, 7);
assert.equal(activityInsert.activity_type, "ielts_gap_fill");
assert.doesNotMatch(activityJson, /native seagrass/);
assert.match(activityJson, /answerKeyStoredIn/);

const badChoiceDraft: GeneratedMicroDraft = {
  activityType: "ielts_vocab_collocation",
  subskillKey: null,
  content: {
    type: "ielts_vocab_collocation",
    title: { en: "Choose the collocation", vi: "Chọn kết hợp từ" },
    instruction: { en: "Pick one.", vi: "Chọn một đáp án." },
    prompt: { en: "Which phrase is natural?", vi: "Cụm nào tự nhiên?" },
    sourceAttribution: { en: "Based on the passage.", vi: "Dựa trên bài đọc." },
    estimatedMinutes: 3,
    stem: { en: "a ___ decline", vi: "một sự suy giảm ___" },
    options: [
      { id: "a", text: "sharp" },
      { id: "b", text: "round" },
    ],
    focusLexeme: "sharp decline",
  },
  answerKey: {
    type: "ielts_vocab_collocation",
    correctOptionId: "z",
    explanationEn: "Sharp decline is the source phrase.",
    explanationVi: "Sharp decline là cụm trong nguồn.",
  },
  rationaleEn: "Practices collocation.",
  rationaleVi: "Luyện kết hợp từ.",
  sourceTextQuote: "sharp decline",
};
assert.throws(
  () => assertContentMatchesAnswerKey(badChoiceDraft.content, badChoiceDraft.answerKey),
  /option/,
);

console.log("IELTS micro-draft model tests passed");
