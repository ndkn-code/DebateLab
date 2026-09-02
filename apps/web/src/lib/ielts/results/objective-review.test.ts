import assert from "node:assert/strict";
import { buildObjectiveReview } from "./objective-review";
import { TFNG_OPTIONS } from "@/lib/ielts/question-types/registry";
import type { IeltsQuestionView } from "@/lib/ielts/question-types/types";
import type { IeltsQuestionGroupView } from "@/lib/ielts/question-types/groups";
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
    slot: null,
    numberSpan: null,
    allowNumber: null,
    cueCard: null,
    letter: null,
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

function input(
  objectiveQuestions: ResultsObjectiveQuestion[],
  questionGroups: IeltsQuestionGroupView[] = [],
): AttemptResultsInput {
  return {
    questionGroups,
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

// ---- New review fields: verdict, numberLabel, sourceRange, audioTimestamp ---
assert.equal(mcq[0].items[0].verdict?.isCorrect, true);
assert.equal(mcq[0].items[0].verdict?.awardedPoints, 1);
assert.deepEqual(mcq[0].items[0].verdict?.blanks["0"], { awarded: 1, max: 1, correct: true });
assert.equal(wrong[0].items[0].verdict?.isCorrect, false);
assert.equal(mcq[0].items[0].numberLabel, "1");
assert.equal(mcq[0].items[0].groupKey, null);
assert.equal(mcq[0].items[0].audioTimestamp, null);
assert.equal(mcq[0].items[0].sourceRange, null);
// An unanswered row with a key still gets a (failing) verdict...
assert.equal(wrong[0].items[1].verdict?.isCorrect, false);
// ...but the verdict is withheld (null) while the key is withheld (attempt in progress).
const withheld = buildObjectiveReview(
  input([oq({ response: { value: "a" }, correctAnswer: null }, { id: "q1", options: APPLE_OPTIONS })]),
);
assert.equal(withheld[0].items[0].verdict, null);
assert.equal(withheld[0].items[0].correctAnswer, "—");
// sourceRange mirrors the highlighted span offsets in the full source text.
const teaRange = source[0].items[0].sourceRange;
assert.ok(teaRange);
assert.equal(
  "Demand reshaped global trade, encouraging the spread of tea cultivation to India and Sri Lanka under colonial rule.".slice(
    teaRange.start,
    teaRange.end,
  ),
  "Sri Lanka",
);

// ---- Group bank: ids map to bank LABELS; group instructions inherited ------
const headingGroup: IeltsQuestionGroupView = {
  id: "g-1",
  groupKey: "headings-1",
  skill: "reading",
  passageId: "p-1",
  listeningSectionId: null,
  orderIndex: 0,
  title: "Questions 1-2",
  instructions: "Choose the correct heading for each paragraph.",
  stimulus: null,
  bank: [
    { id: "h1", label: "i", text: "Heading one" },
    { id: "h2", label: "ii", text: "Heading two" },
    { id: "h3", label: "iii", text: "Heading three" },
  ],
  bankReuse: false,
  answerMode: "select",
  anyOrder: false,
  questionIds: ["q1", "q2"],
  slotByQuestionId: { q1: "1", q2: "2" },
};
const banked = buildObjectiveReview(
  input(
    [
      oq(
        { response: { value: "h3" }, isCorrect: true, awardedPoints: 1, correctAnswer: "h3", groupKey: "headings-1" },
        { id: "q1", questionType: "matching_headings", family: "matching", options: [], prompt: "Paragraph A" },
      ),
      oq(
        { response: { value: "h2" }, isCorrect: false, awardedPoints: 0, correctAnswer: "h1", groupKey: "headings-1" },
        { id: "q2", questionType: "matching_headings", family: "matching", options: [], prompt: "Paragraph B" },
      ),
    ],
    [headingGroup],
  ),
);
assert.equal(banked[0].items[0].learnerAnswer, "iii");
assert.equal(banked[0].items[0].correctAnswer, "iii");
assert.equal(banked[0].items[1].learnerAnswer, "ii");
assert.equal(banked[0].items[1].correctAnswer, "i");
assert.equal(banked[0].items[0].groupKey, "headings-1");
assert.equal(banked[0].items[0].groupInstructions, "Choose the correct heading for each paragraph.");
// The verdict is re-derived against the group bank (select mode), not as free text.
assert.equal(banked[0].items[0].verdict?.isCorrect, true);
assert.equal(banked[0].items[1].verdict?.isCorrect, false);

// ---- numberSpan: one row consumes several numbers -------------------------
const spanned = buildObjectiveReview(
  input([
    oq(
      { response: { values: ["a", "c"] }, isCorrect: true, awardedPoints: 2, correctAnswer: ["a", "c"] },
      { id: "l1", skill: "listening", questionType: "mcq_multi", family: "multi_select", options: APPLE_OPTIONS, maxPoints: 2, numberSpan: 2 },
    ),
    oq({ correctAnswer: "b" }, { id: "l2", skill: "listening", options: APPLE_OPTIONS }),
  ]),
);
assert.deepEqual(spanned[0].items.map((i) => [i.number, i.numberLabel]), [
  [1, "1\u20132"],
  [3, "3"],
]);

// ---- Parts: items split by passage / section, sourceText + audioUrl -------
const parts = buildObjectiveReview(
  input([
    oq(
      { correctAnswer: "a", source: { kind: "reading", title: "Passage 1", text: "First passage text.", partId: "p-1" } },
      { id: "r1", options: APPLE_OPTIONS },
    ),
    oq(
      { correctAnswer: "b", source: { kind: "reading", title: "Passage 1", text: "First passage text.", partId: "p-1" } },
      { id: "r2", options: APPLE_OPTIONS },
    ),
    oq(
      { correctAnswer: "c", source: { kind: "reading", title: "Passage 2", text: "Second passage text.", partId: "p-2" } },
      { id: "r3", options: APPLE_OPTIONS },
    ),
    oq(
      {
        correctAnswer: "a",
        source: { kind: "listening", title: "Section 1", text: "Transcript.", partId: "s-1", audioUrl: "https://cdn/sections/s-1.mp3?v=2" },
      },
      { id: "l1", skill: "listening", options: APPLE_OPTIONS },
    ),
  ]),
);
const readingParts = parts.find((s) => s.skill === "reading")!.parts;
assert.deepEqual(readingParts.map((p) => [p.partId, p.title, p.items.length]), [
  ["p-1", "Passage 1", 2],
  ["p-2", "Passage 2", 1],
]);
assert.equal(readingParts[0].sourceText, "First passage text.");
assert.equal(readingParts[0].audioUrl, null);
assert.deepEqual(readingParts[0].items.map((i) => i.questionId), ["r1", "r2"]);
const listeningParts = parts.find((s) => s.skill === "listening")!.parts;
assert.equal(listeningParts[0].audioUrl, "https://cdn/sections/s-1.mp3?v=2");
assert.equal(listeningParts[0].sourceText, "Transcript.");
// Items without a source fall into a single per-skill part.
assert.equal(mcq[0].parts.length, 1);
assert.equal(mcq[0].parts[0].partId, "reading:general");
assert.equal(mcq[0].parts[0].sourceText, null);

console.log("ielts/results/objective-review tests passed");
