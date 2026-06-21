import assert from "node:assert/strict";

import type {
  ActivityContent,
  ActivityType,
  DragOrderContent,
  FillBlankContent,
  FlashcardContent,
  MatchingContent,
  QuizContent,
} from "@/lib/types/admin";
import {
  createActivityRegistry,
  defineActivityDefinition,
  getDefaultContent,
  getDefaultDuration,
  getDefaultPhase,
  getRegisteredActivityTypes,
  scoreActivityContent,
  validateActivityContent,
  type ActivityResponses,
  type ScoreResult,
} from "./registry";

function makeQuizContent(): QuizContent {
  return {
    questions: [
      {
        id: "quiz-1",
        question: "Pick the claim.",
        type: "multiple_choice",
        options: [
          { id: "a", text: "Claim A" },
          { id: "b", text: "Claim B" },
        ],
        correctAnswer: "a",
        explanation: "A is supported.",
      },
      {
        id: "quiz-2",
        question: "The statement is true.",
        type: "true_false",
        options: [],
        correctAnswer: "true",
        explanation: "It is stated directly.",
      },
    ],
  };
}

function makeMatchingContent(): MatchingContent {
  return {
    pairs: [
      { id: "match-1", left: "Term", right: "Definition" },
      { id: "match-2", left: "Cause", right: "Effect" },
    ],
  };
}

function makeFillBlankContent(): FillBlankContent {
  return {
    passages: [
      {
        id: "passage-1",
        text: "The answer is __BLANK_1__ and then __BLANK_2__.",
        blanks: [
          {
            id: "blank-1",
            answer: "Alpha",
            acceptedAnswers: ["Beta"],
            caseSensitive: false,
          },
          {
            id: "blank-2",
            answer: "CASE",
            caseSensitive: true,
          },
        ],
      },
    ],
  };
}

function makeDragOrderContent(): DragOrderContent {
  return {
    instruction: "Order the steps.",
    items: [
      { id: "second", text: "Second", correctOrder: 2 },
      { id: "first", text: "First", correctOrder: 1 },
    ],
  };
}

function makeFlashcardContent(): FlashcardContent {
  return {
    cards: [
      { id: "card-1", front: "Front 1", back: "Back 1" },
      { id: "card-2", front: "Front 2", back: "Back 2" },
      { id: "card-3", front: "Front 3", back: "Back 3" },
    ],
  };
}

{
  const defaultSnapshot = [
    "lesson",
    "quiz",
    "matching",
    "fill_blank",
    "drag_order",
    "flashcard",
  ].map((type) => {
    const activityType = type as ActivityType;
    return {
      type,
      phase: getDefaultPhase(activityType),
      duration: getDefaultDuration(activityType),
      content: getDefaultContent(activityType),
    };
  });

  assert.deepEqual(defaultSnapshot, [
    {
      type: "lesson",
      phase: "learn",
      duration: 10,
      content: { type: "article", body: "" },
    },
    {
      type: "quiz",
      phase: "apply",
      duration: 5,
      content: { questions: [] },
    },
    {
      type: "matching",
      phase: "practice",
      duration: 5,
      content: { pairs: [] },
    },
    {
      type: "fill_blank",
      phase: "practice",
      duration: 5,
      content: { passages: [] },
    },
    {
      type: "drag_order",
      phase: "practice",
      duration: 3,
      content: { items: [], instruction: "" },
    },
    {
      type: "flashcard",
      phase: "learn",
      duration: 5,
      content: { cards: [] },
    },
  ]);

  assert.deepEqual(getRegisteredActivityTypes().sort(), [
    "drag_order",
    "fill_blank",
    "flashcard",
    "ielts_gap_fill",
    "ielts_paraphrase_transform",
    "ielts_vocab_collocation",
    "lesson",
    "matching",
    "quiz",
  ]);
}

{
  assert.deepEqual(validateActivityContent("quiz", makeQuizContent()), {
    valid: true,
    errors: [],
  });
  assert.deepEqual(validateActivityContent("lesson", { type: "article", body: "" }), {
    valid: false,
    errors: ["Article body is empty"],
  });
  assert.deepEqual(validateActivityContent("unregistered", {}), {
    valid: false,
    errors: ["Unknown activity type: unregistered"],
  });
}

const scoringCases = [
  {
    label: "quiz scores selected option ids by question id",
    type: "quiz",
    content: makeQuizContent(),
    responses: {
      answers: [
        { questionId: "quiz-1", selectedOptionId: "a" },
        { questionId: "quiz-2", selectedOptionId: "false" },
      ],
    },
    expected: { score: 1, maxScore: 2 },
  },
  {
    label: "matching keeps the existing self-id match contract",
    type: "matching",
    content: makeMatchingContent(),
    responses: { matches: { "match-1": "match-1", "match-2": "other" } },
    expected: { score: 1, maxScore: 2 },
  },
  {
    label: "fill blank trims answers and honors accepted variants",
    type: "fill_blank",
    content: makeFillBlankContent(),
    responses: { answers: { "blank-1": " beta ", "blank-2": "case" } },
    expected: { score: 1, maxScore: 2 },
  },
  {
    label: "drag order compares positions against one-based correct order",
    type: "drag_order",
    content: makeDragOrderContent(),
    responses: { order: ["first", "second"] },
    expected: { score: 2, maxScore: 2 },
  },
  {
    label: "flashcard floors and clamps first-try counts",
    type: "flashcard",
    content: makeFlashcardContent(),
    responses: { gotOnFirst: 4.7 },
    expected: { score: 3, maxScore: 3 },
  },
  {
    label: "lesson always completes with one point",
    type: "lesson",
    content: { type: "article", body: "Read this." },
    responses: {},
    expected: { score: 1, maxScore: 1 },
  },
] satisfies Array<{
  label: string;
  type: ActivityType;
  content: ActivityContent;
  responses: ActivityResponses;
  expected: ScoreResult;
}>;

for (const testCase of scoringCases) {
  assert.deepEqual(
    scoreActivityContent(testCase.type, testCase.content, testCase.responses),
    testCase.expected,
    testCase.label,
  );
}

{
  assert.deepEqual(scoreActivityContent("unregistered", {}, {}), {
    score: 0,
    maxScore: 0,
  });
}

{
  type DummyContent = {
    prompt: string;
    answer: string;
  };

  const registry = createActivityRegistry();
  registry.register(
    defineActivityDefinition<"dummy_registered", DummyContent>({
      type: "dummy_registered",
      defaultPhase: "practice",
      defaultDuration: 2,
      defaultContent: () => ({ prompt: "Say IELTS", answer: "IELTS" }),
      validate(content) {
        const errors = content.prompt.trim() && content.answer.trim()
          ? []
          : ["Prompt and answer are required"];
        return { valid: errors.length === 0, errors };
      },
      score(content, responses) {
        return {
          score: responses.answer === content.answer ? 1 : 0,
          maxScore: 1,
        };
      },
    }),
  );

  const definition = registry.get("dummy_registered");
  assert.ok(definition);
  assert.equal(registry.has("dummy_registered"), true);
  assert.deepEqual(definition.defaultContent(), {
    prompt: "Say IELTS",
    answer: "IELTS",
  });
  assert.deepEqual(definition.validate({ prompt: "Say IELTS", answer: "IELTS" }), {
    valid: true,
    errors: [],
  });
  assert.deepEqual(definition.score({ prompt: "Say IELTS", answer: "IELTS" }, {
    answer: "IELTS",
  }), {
    score: 1,
    maxScore: 1,
  });
}
