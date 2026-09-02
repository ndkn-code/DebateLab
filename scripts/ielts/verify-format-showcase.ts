/**
 * Offline verification for the format-showcase fixtures.
 *
 *   npm run ielts:showcase:verify
 *
 * Runs the authored questions through the REAL objective grader
 * (`gradeObjectiveAttempt` + `buildAnswerKey`) with the default band table:
 *  - every fixture-level structural rule (`content-check`),
 *  - a perfect synthetic attempt → raw 40/40 → band 9.0 (Academic),
 *  - a partial attempt with the first N listening/reading items wrong,
 *  - every `markingCases` entry (articles, number words, hyphen/space, "/"
 *    alternatives, AND/OR A NUMBER, any-order sets) awards the expected points,
 *  - the numberSpan/any-order groups roll up to the right raw totals.
 */
import assert from "node:assert/strict";
import { getQuestionFamily, isObjectiveQuestionType } from "../../apps/web/src/lib/ielts/question-types/registry";
import type { IeltsQuestionType } from "../../apps/web/src/lib/ielts/question-types/types";
import {
  gradeObjectiveAttempt,
  type GradableGroup,
  type GradableQuestion,
} from "../../apps/web/src/lib/scoring/ielts/grade-objective";
import type { ObjectiveKey } from "../../apps/web/src/lib/scoring/ielts/objective-scoring";
import type { BandConversionRow } from "../../apps/web/src/lib/scoring/ielts/band-conversion";
import { runContentCheck } from "./format-showcase/content-check";
import { FORMAT_SHOWCASE_TESTS } from "./format-showcase";
import type { AuthoredQuestion, AuthoredTest } from "./format-showcase/types";

// Mirrors supabase/migrations/20260620120100_ielts_mock_engine.sql ('default').
const L = (band: number, min: number, max: number): BandConversionRow => ({
  conversion_key: "default", skill: "listening", module: null, band, raw_min: min, raw_max: max,
});
const RA = (band: number, min: number, max: number): BandConversionRow => ({
  conversion_key: "default", skill: "reading", module: "academic", band, raw_min: min, raw_max: max,
});
const RG = (band: number, min: number, max: number): BandConversionRow => ({
  conversion_key: "default", skill: "reading", module: "general_training", band, raw_min: min, raw_max: max,
});
export const DEFAULT_BAND_ROWS: BandConversionRow[] = [
  L(9, 39, 40), L(8.5, 37, 38), L(8, 35, 36), L(7.5, 32, 34), L(7, 30, 31), L(6.5, 26, 29),
  L(6, 23, 25), L(5.5, 18, 22), L(5, 16, 17), L(4.5, 13, 15), L(4, 10, 12), L(3.5, 8, 9),
  L(3, 6, 7), L(2.5, 4, 5), L(2, 2, 3), L(1, 1, 1), L(0, 0, 0),
  RA(9, 39, 40), RA(8.5, 37, 38), RA(8, 35, 36), RA(7.5, 33, 34), RA(7, 30, 32), RA(6.5, 27, 29),
  RA(6, 23, 26), RA(5.5, 19, 22), RA(5, 15, 18), RA(4.5, 13, 14), RA(4, 10, 12), RA(3.5, 8, 9),
  RA(3, 6, 7), RA(2.5, 4, 5), RA(2, 2, 3), RA(1, 1, 1), RA(0, 0, 0),
  RG(9, 40, 40), RG(8.5, 39, 39), RG(8, 37, 38), RG(7.5, 36, 36), RG(7, 34, 35), RG(6.5, 32, 33),
  RG(6, 30, 31), RG(5.5, 27, 29), RG(5, 23, 26), RG(4.5, 19, 22), RG(4, 15, 18), RG(3.5, 12, 14),
  RG(3, 9, 11), RG(2.5, 6, 8), RG(2, 3, 5), RG(1, 1, 2), RG(0, 0, 0),
];

function toGradable(q: AuthoredQuestion): GradableQuestion {
  const type = q.questionType as IeltsQuestionType;
  return {
    id: q.importId,
    skill: q.skill,
    questionType: type,
    maxPoints: q.maxPoints ?? 1,
    wordLimit: q.wordLimit ?? null,
    family: getQuestionFamily(type),
    hasOptionBank: (q.options?.length ?? 0) > 0,
    selectCount: q.selectCount ?? q.numberSpan ?? null,
    groupKey: q.groupKey ?? null,
    allowNumber: q.allowNumber ?? false,
    numberSpan: q.numberSpan ?? null,
  };
}

function keyFor(q: AuthoredQuestion): ObjectiveKey {
  return {
    correct_answer: (q.correctAnswer ?? "") as ObjectiveKey["correct_answer"],
    accept_variants: (q.acceptVariants ?? []) as ObjectiveKey["accept_variants"],
  };
}

/**
 * A correct answer as a learner would type/select it. Members of an any-order
 * group share one key ("laboratory/library"), so the i-th member takes the
 * i-th alternative — answering the same word twice earns one mark, correctly.
 */
function perfectResponse(q: AuthoredQuestion, alternativeIndex = 0): unknown {
  const answer = q.correctAnswer;
  if (Array.isArray(answer)) return { values: { "0": answer } };
  const alternatives = String(answer ?? "").split("/").map((s) => s.trim()).filter(Boolean);
  return { values: { "0": alternatives[alternativeIndex % Math.max(alternatives.length, 1)] ?? "" } };
}

/** questionId → perfect response for every objective question. */
function perfectResponses(test: AuthoredTest, questions: AuthoredQuestion[]): Map<string, unknown> {
  const anyOrderKeys = new Set(test.groups.filter((g) => g.anyOrder).map((g) => g.groupKey));
  const memberIndex = new Map<string, number>();
  const out = new Map<string, unknown>();
  for (const q of questions) {
    let index = 0;
    if (q.groupKey && anyOrderKeys.has(q.groupKey)) {
      index = memberIndex.get(q.groupKey) ?? 0;
      memberIndex.set(q.groupKey, index + 1);
    }
    out.set(q.importId, perfectResponse(q, index));
  }
  return out;
}

function groupsOf(test: AuthoredTest): Map<string, GradableGroup> {
  return new Map(test.groups.map((g) => [g.groupKey, { anyOrder: Boolean(g.anyOrder) }]));
}

function objectiveQuestions(test: AuthoredTest): AuthoredQuestion[] {
  return test.questions.filter((q) => isObjectiveQuestionType(q.questionType as IeltsQuestionType));
}

function gradeWith(test: AuthoredTest, responses: Map<string, unknown>) {
  const questions = objectiveQuestions(test);
  return gradeObjectiveAttempt({
    questions: questions.map(toGradable),
    keys: new Map(questions.map((q) => [q.importId, keyFor(q)])),
    responses,
    module: test.module,
    bandRows: DEFAULT_BAND_ROWS,
    groups: groupsOf(test),
  });
}

function verifyPerfectAndPartial(test: AuthoredTest): void {
  const questions = objectiveQuestions(test);
  const perfect = gradeWith(test, perfectResponses(test, questions));
  const hasListening = questions.some((q) => q.skill === "listening");
  const readingMax = questions.filter((q) => q.skill === "reading").reduce((s, q) => s + (q.maxPoints ?? 1), 0);
  if (hasListening) {
    assert.equal(perfect.listeningRaw, 40, `${test.slug}: perfect listening raw`);
    assert.equal(perfect.bands.listeningBand, 9, `${test.slug}: perfect listening band`);
  }
  assert.equal(perfect.readingRaw, readingMax, `${test.slug}: perfect reading raw`);
  if (readingMax === 40) assert.equal(perfect.bands.readingBand, 9, `${test.slug}: perfect reading band`);
  console.log(
    `${test.slug}: perfect → L ${perfect.listeningRaw ?? "–"} (band ${perfect.bands.listeningBand ?? "–"}), R ${perfect.readingRaw} (band ${perfect.bands.readingBand ?? "–"})`,
  );

  if (hasListening && readingMax === 40) {
    // Drop 10 listening points and 12 reading points → 30 → 7.0 and 28 → 6.5.
    const responses = perfectResponses(test, questions);
    let lDropped = 0;
    let rDropped = 0;
    for (const q of questions) {
      const points = q.maxPoints ?? 1;
      if (q.skill === "listening" && lDropped + points <= 10) { lDropped += points; responses.delete(q.importId); continue; }
      if (q.skill === "reading" && rDropped + points <= 12) { rDropped += points; responses.delete(q.importId); continue; }
    }
    assert.equal(lDropped, 10); assert.equal(rDropped, 12);
    const partial = gradeWith(test, responses);
    assert.equal(partial.listeningRaw, 30, "partial listening raw");
    assert.equal(partial.bands.listeningBand, 7, "partial listening band");
    assert.equal(partial.readingRaw, 28, "partial reading raw");
    assert.equal(partial.bands.readingBand, 6.5, "partial reading band");
    console.log(`${test.slug}: partial → L 30 (7.0), R 28 (6.5) ✓`);
  }
}

function verifyMarkingCases(test: AuthoredTest): number {
  let checked = 0;
  const failures: string[] = [];
  const questions = objectiveQuestions(test);
  for (const q of questions) {
    for (const c of q.markingCases ?? []) {
      // Grade the whole attempt with only this question answered (any-order groups
      // need the sibling rows present but unanswered).
      const responses = new Map<string, unknown>([[q.importId, { values: { "0": c.input } }]]);
      const grade = gradeWith(test, responses);
      const row = grade.graded.find((g) => g.questionId === q.importId);
      const awarded = row?.awardedPoints ?? 0;
      if (awarded !== c.expectedPoints) {
        failures.push(
          `${test.slug} ${q.importId} [${c.note}]: input ${JSON.stringify(c.input)} → ${awarded}, expected ${c.expectedPoints}`,
        );
      }
      checked++;
    }
  }
  assert.equal(failures.length, 0, `marking cases failed:\n${failures.join("\n")}`);
  return checked;
}

function verifyAnyOrderGroups(test: AuthoredTest): void {
  for (const group of test.groups.filter((g) => g.anyOrder)) {
    const members = objectiveQuestions(test).filter((q) => q.groupKey === group.groupKey);
    if (members.length < 2) continue;
    // The i-th member takes the i-th alternative of the shared key, then the
    // order is reversed — a real learner writing the pair the other way round.
    const answers = members.map((q, i) => {
      const alternatives = String(q.correctAnswer ?? "").split("/").map((s) => s.trim()).filter(Boolean);
      return alternatives[i % alternatives.length] ?? "";
    });
    // Reverse the order: every member still earns its point.
    const reversed = new Map<string, unknown>(
      members.map((q, i) => [q.importId, { values: { "0": answers[answers.length - 1 - i] } }]),
    );
    const grade = gradeWith(test, reversed);
    const awarded = members.reduce(
      (s, q) => s + (grade.graded.find((g) => g.questionId === q.importId)?.awardedPoints ?? 0),
      0,
    );
    assert.equal(awarded, members.length, `${test.slug} ${group.groupKey}: reversed any-order answers`);
    // Same answer twice earns one point only.
    const dup = new Map<string, unknown>(members.map((q) => [q.importId, { values: { "0": answers[0] } }]));
    const dupGrade = gradeWith(test, dup);
    const dupAwarded = members.reduce(
      (s, q) => s + (dupGrade.graded.find((g) => g.questionId === q.importId)?.awardedPoints ?? 0),
      0,
    );
    assert.equal(dupAwarded, 1, `${test.slug} ${group.groupKey}: duplicate any-order answer`);
    console.log(`${test.slug}: any-order group ${group.groupKey} ✓`);
  }
}

function main(): void {
  runContentCheck(FORMAT_SHOWCASE_TESTS);
  let cases = 0;
  for (const test of FORMAT_SHOWCASE_TESTS) {
    verifyPerfectAndPartial(test);
    cases += verifyMarkingCases(test);
    verifyAnyOrderGroups(test);
  }
  console.log(`format-showcase verify: ${FORMAT_SHOWCASE_TESTS.length} tests, ${cases} marking cases ✓`);
}

main();
