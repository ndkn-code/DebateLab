import assert from "node:assert/strict";
import { buildAttemptResultsViewModel } from "./view-model";
import type { BandConversionRow } from "@/lib/scoring/ielts/band-conversion";
import type { AttemptResultsInput } from "./types";

const conversions: BandConversionRow[] = [
  {
    conversion_key: "default",
    skill: "listening",
    module: null,
    band: 7,
    raw_min: 30,
    raw_max: 31,
  },
  {
    conversion_key: "default",
    skill: "reading",
    module: "academic",
    band: 6.5,
    raw_min: 27,
    raw_max: 29,
  },
];

const input: AttemptResultsInput = {
  attemptId: "att-1",
  userId: "user-1",
  testTitle: "Academic Mock 1",
  testSlug: "academic-mock-1",
  module: "academic",
  attemptStatus: "completed",
  submittedAt: "2026-06-20T00:00:00Z",
  skillsInTest: ["listening", "reading", "writing", "speaking"],
  listeningRaw: 30,
  readingRaw: 28,
  listeningBand: 7,
  readingBand: 6.5,
  storedWritingBand: null,
  storedSpeakingBand: null,
  objectiveQuestions: [
    {
      view: {
        id: "l1",
        questionType: "true_false_notgiven",
        family: "single_select",
        skill: "listening",
        prompt: "Statement",
        groupInstructions: null,
        wordLimit: null,
        maxPoints: 1,
        options: [{ id: "true", label: "T", text: "True" }],
        items: [],
        visual: null,
        selectCount: null,
        slot: null,
        numberSpan: null,
        allowNumber: null,
        cueCard: null,
        letter: null,
      },
      response: { value: "true" },
      isCorrect: true,
      awardedPoints: 1,
      correctAnswer: "true",
      acceptVariants: [],
      explanationEn: "Because.",
      explanationVi: null,
    },
  ],
  bandConversions: conversions,
  writingTasks: [
    {
      questionId: "w2",
      prompt: null,
      taskNumber: 2,
      status: "scored",
      essay: "This essay develops a clear position with relevant examples.",
      wordCount: 270,
      taskResponseBand: 7,
      coherenceCohesionBand: 7,
      lexicalResourceBand: 6.5,
      grammarBand: 6.5,
      taskBand: 7,
      criteriaFeedback: { summary: "Strong essay." },
      inlineCorrections: [],
      paragraphFeedback: [],
      modelAnswer: "Model.",
      feedbackLanguage: "en",
    },
  ],
  speakingParts: [], // Speaking not yet scored (WS-3.2 pending)
  questionGroups: [
    {
      id: "g-1",
      groupKey: "headings-1",
      skill: "reading",
      passageId: "p-1",
      listeningSectionId: null,
      orderIndex: 0,
      title: "Questions 1-2",
      instructions: "Choose the correct heading.",
      stimulus: null,
      bank: [
        { id: "h1", label: "i", text: "Heading one" },
        { id: "h2", label: "ii", text: "Heading two" },
      ],
      bankReuse: false,
      answerMode: "select",
      anyOrder: false,
      questionIds: [],
      slotByQuestionId: {},
    },
  ],
};

const vm = buildAttemptResultsViewModel(input);

// Top-level passthrough.
assert.equal(vm.attemptId, "att-1");
assert.equal(vm.testTitle, "Academic Mock 1");
assert.equal(vm.module, "academic");

// Overall is provisional: Listening + Reading + Writing present (3), Speaking pending.
assert.equal(vm.overall.presentCount, 3);
assert.equal(vm.overall.totalSkills, 4);
assert.equal(vm.overall.isProvisional, true);
// A partial mean is never presented as the overall band.
assert.equal(vm.overall.band, null);

// Skill rows: writing scored from its task; speaking not attempted.
const skillStatus = Object.fromEntries(
  vm.skills.map((s) => [s.skill, s.status]),
);
assert.deepEqual(skillStatus, {
  listening: "scored",
  reading: "scored",
  writing: "scored",
  speaking: "not_attempted",
});
assert.equal(vm.skills.find((s) => s.skill === "writing")?.band, 7);

// Breakdowns for the two objective skills.
assert.deepEqual(
  vm.breakdowns.map((b) => b.skill),
  ["listening", "reading"],
);

// Objective review present for listening.
assert.equal(vm.objective.length, 1);
assert.equal(vm.objective[0].skill, "listening");
assert.equal(vm.objective[0].items[0].learnerAnswer, "T. True");
assert.equal(vm.objective[0].items[0].numberLabel, "1");
assert.equal(vm.objective[0].items[0].groupKey, null);
assert.equal(vm.objective[0].items[0].verdict?.isCorrect, true);
assert.equal(vm.objective[0].parts.length, 1);
assert.equal(vm.objective[0].parts[0].items[0].questionId, "l1");

// Question groups pass through to the view-model (and default to [] when absent).
assert.equal(vm.groups.length, 1);
assert.equal(vm.groups[0].groupKey, "headings-1");
assert.deepEqual(
  buildAttemptResultsViewModel({ ...input, questionGroups: undefined }).groups,
  [],
);

// Writing projected; speaking null.
assert.ok(vm.writing);
assert.equal(vm.writing.band, 7);
assert.equal(vm.speaking, null);

console.log("ielts/results/view-model tests passed");
