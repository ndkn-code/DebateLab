import assert from "node:assert/strict";
import {
  localizeSurveyQuestions,
  normalizeSurveyQuestions,
  validateSurveyAnswers,
} from "@/lib/smart-popups/survey";

function run(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

const rawQuestions = [
  {
    id: "overall",
    type: "rating",
    required: true,
    min: 1,
    max: 5,
    label: {
      en: "How useful is this?",
      vi: "Điều này hữu ích thế nào?",
    },
  },
  {
    id: "feature",
    type: "single_choice",
    required: true,
    label: {
      en: "Pick one",
      vi: "Chọn một",
    },
    options: [
      { id: "practice", label: { en: "Practice", vi: "Luyện tập" } },
      { id: "feedback", label: { en: "Feedback", vi: "Feedback" } },
    ],
  },
  {
    id: "notes",
    type: "text",
    required: false,
    label: {
      en: "Anything else?",
      vi: "Còn gì nữa không?",
    },
  },
];

run("normalizes and localizes bilingual questions", () => {
  const questions = normalizeSurveyQuestions(rawQuestions);
  const vi = localizeSurveyQuestions(questions, "vi");

  assert.equal(questions.length, 3);
  assert.equal(vi[0]?.label, "Điều này hữu ích thế nào?");
  assert.equal(vi[1]?.options?.[0]?.label, "Luyện tập");
});

run("validates rating, choice, and text answers", () => {
  const questions = normalizeSurveyQuestions(rawQuestions);
  const answers = validateSurveyAnswers(questions, [
    { questionId: "overall", value: 5 },
    { questionId: "feature", value: "feedback" },
    { questionId: "notes", value: "Keep improving Vietnamese support." },
  ]);

  assert.deepEqual(answers, [
    { questionId: "overall", type: "rating", value: 5 },
    { questionId: "feature", type: "single_choice", value: "feedback" },
    {
      questionId: "notes",
      type: "text",
      value: "Keep improving Vietnamese support.",
    },
  ]);
});

run("rejects missing required answers", () => {
  const questions = normalizeSurveyQuestions(rawQuestions);

  assert.throws(() =>
    validateSurveyAnswers(questions, [{ questionId: "overall", value: 4 }])
  );
});

run("rejects invalid choice values", () => {
  const questions = normalizeSurveyQuestions(rawQuestions);

  assert.throws(() =>
    validateSurveyAnswers(questions, [
      { questionId: "overall", value: 4 },
      { questionId: "feature", value: "invalid" },
    ])
  );
});
