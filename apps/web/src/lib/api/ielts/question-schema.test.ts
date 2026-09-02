/**
 * Unit tests for the canonical question+key boundary schema (WS-1.1). Run under tsx.
 */
import assert from "node:assert/strict";
import { parseInput } from "@/lib/api/boundary";
import {
  CreateIeltsQuestionSchema,
  UpdateIeltsQuestionSchema,
  questionCategory,
  toCreateQuestionArgs,
  toUpdateQuestionArgs,
} from "./question-schema";

const TID = "11111111-1111-4111-8111-111111111111";
const QID = "22222222-2222-4222-8222-222222222222";

// category mapping
assert.equal(questionCategory("true_false_notgiven"), "objective");
assert.equal(questionCategory("writing_task2_essay"), "writing");
assert.equal(questionCategory("speaking_part1"), "speaking");

// TRUE/FALSE/NOT GIVEN normalizes a loose token + sets correctAnswer
{
  const q = parseInput(CreateIeltsQuestionSchema, {
    testId: TID,
    skill: "reading",
    questionType: "true_false_notgiven",
    prompt: "Wolves were absent for over fifty years.",
    correctAnswer: "f",
    explanationEn: "Para 2 says forty years.",
  });
  assert.equal(q.correctAnswer, "false"); // stored as the registry option id
  assert.equal(q.explanationEn, "Para 2 says forty years.");
  const args = toCreateQuestionArgs(q);
  assert.equal(args.p_test_id, TID);
  assert.equal(args.p_skill, "reading");
  assert.equal(args.p_correct_answer, "false");
}

// invalid TF/NG token is rejected
assert.throws(() =>
  parseInput(CreateIeltsQuestionSchema, {
    testId: TID,
    skill: "reading",
    questionType: "true_false_notgiven",
    prompt: "X",
    correctAnswer: "maybe",
  }),
);

// mcq_single requires >= 2 options
assert.throws(() =>
  parseInput(CreateIeltsQuestionSchema, {
    testId: TID,
    skill: "reading",
    questionType: "mcq_single",
    prompt: "Pick one",
    options: ["only"],
    correctAnswer: "only",
  }),
);

// mcq_multi splits a pipe string into a deduped array
{
  const q = parseInput(CreateIeltsQuestionSchema, {
    testId: TID,
    skill: "listening",
    questionType: "mcq_multi",
    prompt: "Choose two",
    options: "A|B|C|D",
    correctAnswer: "B|D",
  });
  assert.deepEqual(q.correctAnswer, ["B", "D"]);
  assert.deepEqual(q.options, ["A", "B", "C", "D"]);
}

// completion accept-variants split + answer kept verbatim
{
  const q = parseInput(CreateIeltsQuestionSchema, {
    testId: TID,
    skill: "reading",
    questionType: "summary_completion",
    prompt: "Reintroducing the predator triggered a ____.",
    correctAnswer: "trophic cascade",
    acceptVariants: "trophic-cascade|trophic cascades",
    wordLimit: 2,
  });
  assert.equal(q.correctAnswer, "trophic cascade");
  assert.deepEqual(q.acceptVariants, ["trophic-cascade", "trophic cascades"]);
  assert.equal(q.wordLimit, 2);
}

// multi-blank object keys are preserved for matching/completion renderers
{
  const q = parseInput(CreateIeltsQuestionSchema, {
    testId: TID,
    skill: "reading",
    questionType: "matching_features",
    prompt: "Match each policy with the correct department.",
    options: "Bookings|Payroll|Safety",
    metadata: {
      items: [
        { id: "q1", text: "Handles overtime claims." },
        { id: "q2", text: "Issues visitor passes." },
      ],
    },
    correctAnswer: { q1: "1", q2: "2" },
    acceptVariants: { q1: ["payroll"], q2: ["safety"] },
  });
  assert.deepEqual(q.correctAnswer, { q1: "1", q2: "2" });
  assert.deepEqual(q.acceptVariants, { q1: ["payroll"], q2: ["safety"] });
}

// writing: no objective answer, model + examiner notes retained
{
  const q = parseInput(CreateIeltsQuestionSchema, {
    testId: TID,
    skill: "writing",
    questionType: "writing_task2_essay",
    prompt: "Discuss both views…",
    modelAnswer: "A band-9 essay…",
    examinerNotes: { task: "Both views addressed", grammar: "Near error-free" },
  });
  assert.deepEqual(q.correctAnswer, {});
  assert.equal(q.modelAnswer, "A band-9 essay…");
  assert.equal(q.examinerNotes.task, "Both views addressed");
}

// skill/type consistency is enforced
assert.throws(() =>
  parseInput(CreateIeltsQuestionSchema, {
    testId: TID,
    skill: "reading",
    questionType: "writing_task2_essay",
    prompt: "X",
  }),
);
// a reading question may not link a listening section
assert.throws(() =>
  parseInput(CreateIeltsQuestionSchema, {
    testId: TID,
    skill: "reading",
    questionType: "true_false_notgiven",
    prompt: "X",
    correctAnswer: "TRUE",
    listeningSectionId: QID,
  }),
);

// update schema requires a question id and maps it
{
  const u = parseInput(UpdateIeltsQuestionSchema, {
    questionId: QID,
    testId: TID,
    skill: "reading",
    questionType: "yes_no_notgiven",
    prompt: "Claim",
    correctAnswer: "y",
  });
  assert.equal(u.correctAnswer, "yes");
  const args = toUpdateQuestionArgs(u);
  assert.equal(args.p_question_id, QID);
  assert.equal(args.p_correct_answer, "yes");
}

// ---- format-variety rules ---------------------------------------------------
const base = (over: Record<string, unknown>) => ({ testId: TID, ...over });
const ok = (input: Record<string, unknown>) => parseInput(CreateIeltsQuestionSchema, base(input));
const rejects = (input: Record<string, unknown>, pattern: RegExp, label: string) =>
  assert.throws(() => parseInput(CreateIeltsQuestionSchema, base(input)), pattern, label);

// strict metadata: malformed known field rejected; adaptive tags still checked
rejects(
  { skill: "reading", questionType: "mcq_single", prompt: "P", options: "A|B", correctAnswer: "A", metadata: { slot: 7 } },
  /metadata/,
  "metadata.slot must be a string",
);
rejects(
  { skill: "reading", questionType: "mcq_single", prompt: "P", options: "A|B", correctAnswer: "A", metadata: { subskill_tags: ["Bad Tag!"] } },
  /metadata/,
  "adaptive tags still validated",
);

// mcq_multi: selectCount within options + key length matches
{
  const q = ok({
    skill: "listening", questionType: "mcq_multi", prompt: "Choose TWO",
    options: "A|B|C|D|E", correctAnswer: "B|D", metadata: { selectCount: 2 },
  });
  assert.equal(q.metadata.selectCount, 2);
}
rejects(
  { skill: "listening", questionType: "mcq_multi", prompt: "P", options: "A|B|C", correctAnswer: "A|B", metadata: { selectCount: 4 } },
  /selectCount/,
  "selectCount > options",
);
rejects(
  { skill: "listening", questionType: "mcq_multi", prompt: "P", options: "A|B|C|D", correctAnswer: "A", metadata: { selectCount: 2 } },
  /exactly 2/,
  "key length must equal selectCount",
);
// numberSpan: key length and maxPoints must both equal the span
{
  const q = ok({
    skill: "listening", questionType: "mcq_multi", prompt: "Questions 21-22",
    options: "A|B|C|D|E", correctAnswer: "A|C", maxPoints: 2, metadata: { numberSpan: 2 },
  });
  assert.equal(q.maxPoints, 2);
}
rejects(
  { skill: "listening", questionType: "mcq_multi", prompt: "P", options: "A|B|C|D|E", correctAnswer: "A|C", maxPoints: 1, metadata: { numberSpan: 2 } },
  /maxPoints/,
  "maxPoints must equal numberSpan",
);

// matching_*: options OR items OR groupKey
ok({ skill: "reading", questionType: "matching_sentence_endings", prompt: "The study found", correctAnswer: "B", groupKey: "set-a" });
ok({ skill: "reading", questionType: "matching_headings", prompt: "Paragraph A", correctAnswer: "ii", options: "i|ii|iii" });
rejects(
  { skill: "reading", questionType: "matching_sentence_endings", prompt: "The study found", correctAnswer: "B" },
  /groupKey/,
  "matching without a bank source",
);

// completion: >=2 markers require a record key covering every marker
{
  const q = ok({
    skill: "reading", questionType: "summary_completion",
    prompt: "Wolves changed the __BLANK_1__ and the __BLANK_2__.",
    correctAnswer: { "1": "rivers", "2": "forests" },
  });
  assert.deepEqual(q.correctAnswer, { "1": "rivers", "2": "forests" });
}
ok({ skill: "reading", questionType: "sentence_completion", prompt: "One __BLANK_1__ here.", correctAnswer: "answer" });
rejects(
  { skill: "reading", questionType: "summary_completion", prompt: "A __BLANK_1__ and __BLANK_2__.", correctAnswer: "rivers" },
  /several __BLANK_/,
  "bare string with 2 markers",
);
rejects(
  { skill: "reading", questionType: "summary_completion", prompt: "A __BLANK_1__ and __BLANK_2__.", correctAnswer: { "1": "rivers" } },
  /missing blank/,
  "record must cover every marker",
);

// labeling: image visual OR groupKey
ok({
  skill: "listening", questionType: "map_plan_label", prompt: "The cafe", options: "A|B|C", correctAnswer: "C",
  visual: { type: "image", url: "https://x.test/map.png", alt: "Map" },
});
ok({ skill: "listening", questionType: "diagram_label", prompt: "Part 1", correctAnswer: "valve", groupKey: "diagram-1" });
rejects(
  { skill: "listening", questionType: "map_plan_label", prompt: "The cafe", options: "A|B|C", correctAnswer: "C" },
  /image visual/,
  "labeling without an image",
);

// speaking part 2 requires a cue card (defaults applied); part 1 does not
{
  const q = ok({
    skill: "speaking", questionType: "speaking_part2_cuecard", prompt: "Describe a place",
    metadata: { cueCard: { topic: "Describe a place you like", bullets: ["where it is"] } },
  });
  const cue = q.metadata.cueCard as Record<string, unknown>;
  assert.equal(cue.prepSeconds, 60);
  assert.equal(cue.speakSeconds, 120);
}
ok({ skill: "speaking", questionType: "speaking_part1", prompt: "Do you work or study?" });
rejects(
  { skill: "speaking", questionType: "speaking_part2_cuecard", prompt: "Describe a place" },
  /cueCard/,
  "cue card required",
);

// writing task 1 general requires a letter brief; academic does not
ok({
  skill: "writing", questionType: "writing_task1_general", prompt: "Write a letter",
  metadata: { letter: { recipient: "your landlord", register: "formal", bullets: ["explain the problem"] } },
});
ok({ skill: "writing", questionType: "writing_task1_academic", prompt: "The chart shows" });
rejects(
  { skill: "writing", questionType: "writing_task1_general", prompt: "Write a letter" },
  /letter/,
  "letter required",
);

// auto-derive wordLimit + allowNumber from instructions; explicit values win
{
  const q = ok({
    skill: "listening", questionType: "short_answer", prompt: "Name of the hotel?", correctAnswer: "Grand",
    groupInstructions: "Write NO MORE THAN TWO WORDS AND/OR A NUMBER for each answer.",
  });
  assert.equal(q.wordLimit, 2);
  assert.equal(q.metadata.allowNumber, true);
  const explicit = ok({
    skill: "listening", questionType: "short_answer", prompt: "Name?", correctAnswer: "Grand",
    groupInstructions: "Write NO MORE THAN TWO WORDS AND/OR A NUMBER.", wordLimit: 3, metadata: { allowNumber: false },
  });
  assert.equal(explicit.wordLimit, 3);
  assert.equal(explicit.metadata.allowNumber, false);
  const plain = ok({
    skill: "listening", questionType: "short_answer", prompt: "Name?", correctAnswer: "Grand",
    groupInstructions: "Write ONE WORD ONLY.",
  });
  assert.equal(plain.wordLimit, null);
  assert.equal(plain.metadata.allowNumber, undefined);
}

// TFNG / YNNG keys are stored as option ids, whatever the authored form
{
  const parsed = parseInput(CreateIeltsQuestionSchema, {
    testId: "00000000-0000-4000-8000-000000000001", skill: "reading", questionType: "true_false_notgiven",
    prompt: "Dunes grow.", correctAnswer: "NOT GIVEN",
  });
  assert.equal(parsed.correctAnswer, "not_given");
  const record = parseInput(CreateIeltsQuestionSchema, {
    testId: "00000000-0000-4000-8000-000000000001", skill: "reading", questionType: "yes_no_notgiven",
    prompt: "Lights off?", correctAnswer: { "0": "Yes" },
  });
  assert.deepEqual(record.correctAnswer, { "0": "yes" });
}

console.log("IELTS question-schema tests passed");
