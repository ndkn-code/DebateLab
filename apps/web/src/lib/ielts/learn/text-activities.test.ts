import assert from "node:assert/strict";
import {
  IeltsLearnAtomSchema,
  IELTS_LEARN_ACTIVITY_TYPES,
} from "@/lib/ielts/adaptive/contracts";
import {
  IELTS_FIRST_TEXT_ACTIVITY_TYPES,
  IeltsTfngReasoningActivityContentSchema,
  IeltsTextActivityContentSchema,
  defaultIeltsTextActivityContent,
  defaultIeltsTextActivitySubskill,
  getIeltsTextResponseForQuestion,
  isIeltsFirstTextActivityType,
  ieltsTextActivityEstimatedMinutes,
  scoreIeltsTextActivityPreview,
  toIeltsLearnAtom,
} from "./text-activities";

const QUESTION_ID = "00000000-0000-4000-8000-000000000201";

const content = IeltsTextActivityContentSchema.parse({
  activityType: "ielts_paraphrase_transform",
  instruction: {
    en: "Choose the paraphrase that keeps the meaning.",
    vi: "Chọn cách diễn đạt lại giữ nguyên nghĩa.",
  },
  sources: [
    {
      questionId: QUESTION_ID,
      subskillKey: "reading:paraphrase_recognition",
      labelEn: "Synonym recognition",
      labelVi: "Nhận diện từ đồng nghĩa",
    },
  ],
  rendererTags: ["paraphrase", "reading"],
});

{
  for (const activityType of IELTS_FIRST_TEXT_ACTIVITY_TYPES) {
    assert.ok(IELTS_LEARN_ACTIVITY_TYPES.includes(activityType));
    assert.equal(isIeltsFirstTextActivityType(activityType), true);
  }
  assert.equal(isIeltsFirstTextActivityType("quiz"), false);
}

{
  const expectedSubskills = {
    ielts_tfng_reasoning: "reading:true_false_notgiven",
    ielts_scan_detail: "reading:scan_specific_detail",
    ielts_sentence_transform: "writing:paraphrase_transform",
    ielts_cohesion_linker: "writing:coherence_cohesion",
  } as const;

  for (const [activityType, subskillKey] of Object.entries(expectedSubskills)) {
    const parsed = IeltsTextActivityContentSchema.parse(
      defaultIeltsTextActivityContent(activityType as keyof typeof expectedSubskills),
    );
    assert.equal(parsed.activityType, activityType);
    assert.equal(parsed.sources[0].subskillKey, subskillKey);
    assert.equal(defaultIeltsTextActivitySubskill(parsed.activityType), subskillKey);
    assert.equal(toIeltsLearnAtom(parsed).skill, subskillKey.split(":")[0]);
    assert.equal(
      toIeltsLearnAtom(parsed).estimatedMinutes,
      ieltsTextActivityEstimatedMinutes(parsed.activityType),
    );
  }
}

{
  assert.equal(content.module, "academic");
  assert.equal(content.version, 1);
  assert.equal(content.sources[0].subskillKey, "reading:paraphrase_recognition");
  assert.equal(
    Object.hasOwn(content, "correctAnswer"),
    false,
    "activity content must not carry answer keys",
  );
}

assert.throws(() =>
  IeltsTextActivityContentSchema.parse({
    activityType: "ielts_vocab_collocation",
    instruction: { en: "Pick one.", vi: "Chọn một đáp án." },
    sources: [
      {
        questionId: QUESTION_ID,
        subskillKey: "reading:paraphrase_recognition",
      },
      {
        questionId: "00000000-0000-4000-8000-000000000202",
        subskillKey: "reading:paraphrase_recognition",
      },
    ],
  }),
);

{
  const scan = IeltsTextActivityContentSchema.parse({
    activityType: "ielts_scan_detail",
    instruction: { en: "Scan for details.", vi: "Đọc quét tìm chi tiết." },
    sources: [
      {
        questionId: QUESTION_ID,
        subskillKey: "reading:scan_specific_detail",
      },
      {
        questionId: "00000000-0000-4000-8000-000000000202",
        subskillKey: "reading:scan_specific_detail",
      },
    ],
  });
  assert.equal(scoreIeltsTextActivityPreview(scan).maxScore, 2);
}

{
  const tfng = IeltsTfngReasoningActivityContentSchema.parse({
    activityType: "ielts_tfng_reasoning",
    instruction: { en: "Verify the claim.", vi: "Kiểm chứng nhận định." },
    sources: [
      {
        questionId: QUESTION_ID,
        subskillKey: "reading:true_false_notgiven",
      },
    ],
  });
  assert.equal(tfng.rationalePrompt.en.includes("reason"), true);
}

{
  const response = getIeltsTextResponseForQuestion(
    {
      answers: [
        { questionId: "other", value: "A" },
        { questionId: QUESTION_ID, value: "B" },
      ],
    },
    QUESTION_ID,
  );
  assert.deepEqual(response, { value: "B" });
}

{
  assert.deepEqual(scoreIeltsTextActivityPreview(content), {
    score: 0,
    maxScore: 1,
  });
}

{
  const atom = toIeltsLearnAtom(content);
  assert.deepEqual(IeltsLearnAtomSchema.parse(atom), atom);
  assert.equal(atom.activityType, "ielts_paraphrase_transform");
  assert.equal(atom.skill, "reading");
  assert.deepEqual(atom.questionIds, [QUESTION_ID]);
}

console.log("IELTS text activity contract tests passed");
