import assert from "node:assert/strict";
import {
  IeltsLearnAtomSchema,
  IELTS_LEARN_ACTIVITY_TYPES,
} from "@/lib/ielts/adaptive/contracts";
import {
  IELTS_FIRST_TEXT_ACTIVITY_TYPES,
  IeltsTextActivityContentSchema,
  getIeltsTextResponseForQuestion,
  isIeltsFirstTextActivityType,
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
