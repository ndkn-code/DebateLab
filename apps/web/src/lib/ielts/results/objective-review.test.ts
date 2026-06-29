import assert from "node:assert/strict";
import { buildObjectiveReview } from "./objective-review";
import { TFNG_OPTIONS } from "@/lib/ielts/question-types/registry";
import type { IeltsQuestionView } from "@/lib/ielts/question-types/types";
import type { AttemptResultsInput, ResultsObjectiveQuestion } from "./types";

function viewOf(p: Partial<IeltsQuestionView>): IeltsQuestionView {
  return {
    id: "q",
    questionType: "mcq_single",
    family: "single_select",
    skill: "reading",
    prompt: "Prompt",
    groupInstructions: null,
    wordLimit: null,
    maxPoints: 1,
    options: [],
    items: [],
    visual: null,
    selectCount: null,
    ...p,
  };
}

function oq(p: Partial<ResultsObjectiveQuestion>, view: Partial<IeltsQuestionView>): ResultsObjectiveQuestion {
  return {
    view: viewOf(view),
    response: null,
    isCorrect: null,
    awardedPoints: null,
    correctAnswer: null,
    acceptVariants: [],
    explanationEn: null,
    explanationVi: null,
    ...p,
  };
}

function input(objectiveQuestions: ResultsObjectiveQuestion[]): AttemptResultsInput {
  return {
    attemptId: "a",
    userId: "user-1",
    testTitle: "T",
    testSlug: "t",
    module: "academic",
    attemptStatus: "completed",
    submittedAt: null,
    skillsInTest: ["listening", "reading"],
    listeningRaw: null,
    readingRaw: null,
    listeningBand: null,
    readingBand: null,
    storedWritingBand: null,
    storedSpeakingBand: null,
    objectiveQuestions,
    bandConversions: [],
    writingTasks: [],
    speakingParts: [],
  };
}

const APPLE_OPTIONS = [
  { id: "a", label: "A", text: "Apple" },
  { id: "b", label: "B", text: "Banana" },
  { id: "c", label: "C", text: "Cherry" },
];

// ---- MCQ single: option ids render as "label. text" ------------------------
const mcq = buildObjectiveReview(
  input([
    oq(
      { response: { value: "a" }, isCorrect: true, awardedPoints: 1, correctAnswer: "a" },
      { id: "q1", questionType: "mcq_single", options: APPLE_OPTIONS, prompt: "Pick one", maxPoints: 1 },
    ),
  ]),
);
assert.equal(mcq.length, 1);
assert.equal(mcq[0].skill, "reading");
assert.equal(mcq[0].items[0].learnerAnswer, "A. Apple");
assert.equal(mcq[0].items[0].correctAnswer, "A. Apple");
assert.equal(mcq[0].items[0].isCorrect, true);
assert.equal(mcq[0].items[0].number, 1);
assert.equal(mcq[0].correctCount, 1);
assert.equal(mcq[0].totalCount, 1);

// ---- Wrong + unanswered ----------------------------------------------------
const wrong = buildObjectiveReview(
  input([
    oq(
      { response: { value: "b" }, isCorrect: false, awardedPoints: 0, correctAnswer: "a" },
      { id: "q1", options: APPLE_OPTIONS },
    ),
    oq({ isCorrect: null, correctAnswer: "c" }, { id: "q2", options: APPLE_OPTIONS }),
  ]),
);
assert.equal(wrong[0].items[0].learnerAnswer, "B. Banana");
assert.equal(wrong[0].items[0].correctAnswer, "A. Apple");
assert.equal(wrong[0].items[1].learnerAnswer, "Not answered");
assert.equal(wrong[0].items[1].correctAnswer, "C. Cherry");
assert.equal(wrong[0].correctCount, 0);
assert.equal(wrong[0].totalCount, 2);

// ---- True/False/Not Given (fixed options) ----------------------------------
const tfng = buildObjectiveReview(
  input([
    oq(
      { response: { value: "true" }, isCorrect: true, awardedPoints: 1, correctAnswer: "true" },
      { id: "q1", questionType: "true_false_notgiven", options: TFNG_OPTIONS },
    ),
  ]),
);
assert.equal(tfng[0].items[0].learnerAnswer, "T. True");
assert.equal(tfng[0].items[0].correctAnswer, "T. True");

// ---- Text completion: raw strings, blank markers cleaned -------------------
const text = buildObjectiveReview(
  input([
    oq(
      {
        response: { value: "Photosynthesis" },
        isCorrect: true,
        awardedPoints: 1,
        correctAnswer: "photosynthesis",
        explanationEn: "It captures light energy.",
        explanationVi: "Nó hấp thụ năng lượng ánh sáng.",
      },
      {
        id: "q1",
        questionType: "short_answer",
        family: "completion",
        prompt: "Name the process: __BLANK_1__",
        options: [],
      },
    ),
  ]),
);
assert.equal(text[0].items[0].learnerAnswer, "Photosynthesis");
assert.equal(text[0].items[0].correctAnswer, "photosynthesis");
assert.equal(text[0].items[0].prompt, "Name the process: ______");
assert.equal(text[0].items[0].explanationVi, "Nó hấp thụ năng lượng ánh sáng.");

// ---- Source context: Reading span found from explanation fallback ----------
const source = buildObjectiveReview(
  input([
    oq(
      {
        correctAnswer: "Sri Lanka",
        explanationEn: "The final sentence names India and Sri Lanka.",
        source: {
          kind: "reading",
          title: "The Origins of Tea",
          text: "Demand reshaped global trade, encouraging the spread of tea cultivation to India and Sri Lanka under colonial rule.",
        },
      },
      { id: "q1", questionType: "short_answer", family: "completion", prompt: "Where else?" },
    ),
  ]),
);
assert.equal(source[0].items[0].sourceContext?.label, "Relevant passage span");
assert.equal(source[0].items[0].sourceContext?.title, "The Origins of Tea");
assert.equal(
  source[0].items[0].sourceContext?.segments.find((segment) => segment.highlighted)?.text,
  "Sri Lanka",
);

// ---- Source context: Listening span found from authored quote hint ----------
const listeningSource = buildObjectiveReview(
  input([
    oq(
      {
        correctAnswer: "library card",
        explanationEn: "The student asks to register for a library card.",
        source: {
          kind: "listening",
          title: "Section 1",
          text: "Student: Hi, I would like to register for a library card.",
        },
        sourceHints: [{ answerLocation: { quote: "register for a library card" } }],
      },
      { id: "q1", skill: "listening", questionType: "short_answer", family: "completion" },
    ),
  ]),
);
assert.equal(
  listeningSource[0].items[0].sourceContext?.segments.find((segment) => segment.highlighted)?.text,
  "register for a library card",
);
assert.equal(listeningSource[0].items[0].sourceContext?.label, "Transcript answer location");

// ---- MCQ multi: list joined with ", " --------------------------------------
const multi = buildObjectiveReview(
  input([
    oq(
      {
        response: { values: ["a", "c"] },
        isCorrect: true,
        awardedPoints: 2,
        correctAnswer: ["a", "c"],
      },
      { id: "q1", questionType: "mcq_multi", family: "multi_select", options: APPLE_OPTIONS, maxPoints: 2 },
    ),
  ]),
);
assert.equal(multi[0].items[0].learnerAnswer, "A. Apple, C. Cherry");
assert.equal(multi[0].items[0].correctAnswer, "A. Apple, C. Cherry");
assert.equal(multi[0].items[0].maxPoints, 2);

// ---- Grouping by skill, in listening→reading order, numbered per skill -----
const grouped = buildObjectiveReview(
  input([
    oq({ isCorrect: true, correctAnswer: "a" }, { id: "r1", skill: "reading", options: APPLE_OPTIONS }),
    oq({ isCorrect: false, correctAnswer: "a" }, { id: "l1", skill: "listening", options: APPLE_OPTIONS }),
    oq({ isCorrect: true, correctAnswer: "b" }, { id: "r2", skill: "reading", options: APPLE_OPTIONS }),
  ]),
);
assert.deepEqual(
  grouped.map((s) => [s.skill, s.totalCount, s.correctCount]),
  [
    ["listening", 1, 0],
    ["reading", 2, 2],
  ],
);
assert.deepEqual(grouped[1].items.map((i) => i.number), [1, 2]);

console.log("ielts/results/objective-review tests passed");
