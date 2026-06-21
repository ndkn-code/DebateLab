import assert from "node:assert/strict";

import {
  assertContentMatchesAnswerKey,
  assertNoAnswerKeyLeak,
  findAnswerKeyLeakPath,
  type GeneratedMicroDraft,
} from "./schema";
import { IeltsTextActivityContentSchema } from "@/lib/ielts/learn/text-activities";
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
    {
      key: "reading:true_false_notgiven",
      skill: "reading",
      labelEn: "True / False / Not Given",
      labelVi: "Đúng / Sai / Không có thông tin",
      kind: "question_type",
      questionType: "true_false_notgiven",
      tags: ["claim_verification"],
    },
    {
      key: "reading:scan_specific_detail",
      skill: "reading",
      labelEn: "Scan for detail",
      labelVi: "Đọc quét tìm chi tiết",
      kind: "strategy",
      questionType: null,
      tags: ["locating"],
    },
  ],
};

const writingSource: MicroDraftSourceContext = {
  ...source,
  skill: "writing",
  questionType: "writing_task2_essay",
  subskills: [
    {
      key: "writing:paraphrase_transform",
      skill: "writing",
      labelEn: "Paraphrase transformation",
      labelVi: "Chuyển đổi diễn đạt tương đương",
      kind: "micro_skill",
      questionType: null,
      tags: ["paraphrase"],
    },
    {
      key: "writing:coherence_cohesion",
      skill: "writing",
      labelEn: "Coherence and cohesion",
      labelVi: "Mạch lạc và liên kết",
      kind: "band_criterion",
      questionType: "writing_task2_essay",
      tags: ["cohesion"],
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
assert.equal(
  fallbackSubskillKey({ activityType: "ielts_tfng_reasoning", source }),
  "reading:true_false_notgiven",
);
assert.equal(
  fallbackSubskillKey({ activityType: "ielts_scan_detail", source }),
  "reading:scan_specific_detail",
);
assert.equal(
  fallbackSubskillKey({ activityType: "ielts_sentence_transform", source: writingSource }),
  "writing:paraphrase_transform",
);
assert.equal(
  fallbackSubskillKey({ activityType: "ielts_cohesion_linker", source: writingSource }),
  "writing:coherence_cohesion",
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
assert.deepEqual(
  IeltsTextActivityContentSchema.parse(activityInsert.content).sources[0],
  {
    questionId: source.questionId,
    subskillKey: "reading:sentence_completion",
    labelEn: "Complete the key phrase",
    labelVi: "Hoàn thành cụm từ chính",
  },
);
assert.doesNotMatch(activityJson, /native seagrass/);
assert.match(activityJson, /answerKeyStoredIn/);

const newTypeDrafts: GeneratedMicroDraft[] = [
  {
    activityType: "ielts_tfng_reasoning",
    subskillKey: "reading:true_false_notgiven",
    content: {
      type: "ielts_tfng_reasoning",
      title: { en: "Verify the claim", vi: "Kiểm chứng nhận định" },
      instruction: { en: "Choose and justify.", vi: "Chọn và giải thích." },
      prompt: { en: "Use the passage.", vi: "Dựa vào bài đọc." },
      sourceAttribution: { en: "Based on the passage.", vi: "Dựa trên bài đọc." },
      estimatedMinutes: 4,
      statement: {
        en: "The survey measured native seagrass.",
        vi: "Khảo sát đo lường cỏ biển bản địa.",
      },
      options: [
        { id: "true", text: "True" },
        { id: "false", text: "False" },
        { id: "not_given", text: "Not Given" },
      ],
      rationalePrompt: {
        en: "Quote the clue.",
        vi: "Trích dấu hiệu trong bài.",
      },
    },
    answerKey: {
      type: "ielts_tfng_reasoning",
      correctOptionId: "true",
      explanationEn: "The passage says native seagrass.",
      explanationVi: "Bài đọc nêu cỏ biển bản địa.",
    },
    rationaleEn: "Practices claim verification.",
    rationaleVi: "Luyện kiểm chứng nhận định.",
    sourceTextQuote: "native seagrass",
  },
  {
    activityType: "ielts_scan_detail",
    subskillKey: "reading:scan_specific_detail",
    content: {
      type: "ielts_scan_detail",
      title: { en: "Find the detail", vi: "Tìm chi tiết" },
      instruction: { en: "Scan for the answer.", vi: "Đọc quét tìm đáp án." },
      prompt: { en: "Answer briefly.", vi: "Trả lời ngắn gọn." },
      sourceAttribution: { en: "Based on the passage.", vi: "Dựa trên bài đọc." },
      estimatedMinutes: 5,
      sourceText: "The coastal survey found a sharp decline in native seagrass.",
      detailQuestion: {
        en: "What declined sharply?",
        vi: "Điều gì suy giảm mạnh?",
      },
      wordLimit: 2,
    },
    answerKey: {
      type: "ielts_scan_detail",
      correctAnswers: ["native seagrass"],
      acceptVariants: ["seagrass"],
      caseSensitive: false,
      explanationEn: "The phrase appears in the sentence.",
      explanationVi: "Cụm này xuất hiện trong câu.",
    },
    rationaleEn: "Practices locating exact detail.",
    rationaleVi: "Luyện tìm chi tiết chính xác.",
    sourceTextQuote: "native seagrass",
  },
  {
    activityType: "ielts_sentence_transform",
    subskillKey: "writing:paraphrase_transform",
    content: {
      type: "ielts_sentence_transform",
      title: { en: "Rewrite accurately", vi: "Viết lại chính xác" },
      instruction: { en: "Keep the meaning.", vi: "Giữ nguyên nghĩa." },
      prompt: { en: "Complete the rewrite.", vi: "Hoàn thành câu viết lại." },
      sourceAttribution: { en: "Based on the model answer.", vi: "Dựa trên bài mẫu." },
      estimatedMinutes: 4,
      sourceSentence: "The survey found a sharp decline.",
      targetMeaning: {
        en: "The survey identified a significant fall.",
        vi: "Khảo sát xác định một sự sụt giảm đáng kể.",
      },
      textWithBlank: "The survey [[blank]] a significant fall.",
      wordLimit: 1,
    },
    answerKey: {
      type: "ielts_sentence_transform",
      correctAnswers: ["identified"],
      acceptVariants: ["found"],
      caseSensitive: false,
      explanationEn: "Identified preserves found.",
      explanationVi: "Identified giữ nghĩa của found.",
    },
    rationaleEn: "Practices paraphrase control.",
    rationaleVi: "Luyện kiểm soát diễn đạt lại.",
    sourceTextQuote: "survey found",
  },
  {
    activityType: "ielts_cohesion_linker",
    subskillKey: "writing:coherence_cohesion",
    content: {
      type: "ielts_cohesion_linker",
      title: { en: "Choose the linker", vi: "Chọn từ nối" },
      instruction: { en: "Make the sentence cohesive.", vi: "Làm câu liên kết mạch lạc." },
      prompt: { en: "Pick the best linker.", vi: "Chọn từ nối phù hợp nhất." },
      sourceAttribution: { en: "Based on the passage.", vi: "Dựa trên bài đọc." },
      estimatedMinutes: 5,
      textWithBlank: "The habitat declined; [[blank]], restoration became urgent.",
      options: [
        { id: "therefore", text: "therefore" },
        { id: "however", text: "however" },
      ],
    },
    answerKey: {
      type: "ielts_cohesion_linker",
      correctOptionId: "therefore",
      explanationEn: "Therefore shows result.",
      explanationVi: "Therefore thể hiện kết quả.",
    },
    rationaleEn: "Practices cohesive devices.",
    rationaleVi: "Luyện phương tiện liên kết.",
    sourceTextQuote: "habitat declined",
  },
];

for (const draft of newTypeDrafts) {
  assertContentMatchesAnswerKey(draft.content, draft.answerKey);
  const insert = buildMicroDraftInsert({
    source: draft.activityType.startsWith("ielts_sentence") ||
      draft.activityType.startsWith("ielts_cohesion")
      ? writingSource
      : source,
    draft,
    audit: {
      providerLabel: "google",
      modelName: "gemini-2.5-flash",
      generatedAt: "2026-06-21T00:00:00.000Z",
    },
    createdBy: "00000000-0000-4000-8000-000000000004",
  });
  assert.equal(insert.activity_type, draft.activityType);
  assert.equal(insert.subskill_key, draft.subskillKey);
}

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
