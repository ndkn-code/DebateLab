import assert from "node:assert/strict";
import {
  computeNextDueAt,
  createReviewItemSchedule,
  qualityGradeForRating,
  rateReviewItem,
  shouldArchiveReviewItem,
} from "./scheduler";
import { CreateIeltsReviewItemSchema, RateIeltsReviewItemSchema } from "./schema";

const baseNow = new Date("2026-06-21T12:00:00.000Z");
const hoursBetween = (from: Date, to: Date): number =>
  (to.getTime() - from.getTime()) / 3_600_000;

assert.equal(qualityGradeForRating("again"), 1);
assert.equal(qualityGradeForRating("hard"), 3);
assert.equal(qualityGradeForRating("good"), 4);
assert.equal(qualityGradeForRating("easy"), 5);

{
  const schedule = createReviewItemSchedule({ now: baseNow });
  assert.equal(schedule.algorithm, "sm2_v1");
  assert.equal(schedule.state, "new");
  assert.equal(schedule.easeFactor, 2.5);
  assert.equal(schedule.intervalDays, 0);
  assert.equal(schedule.difficulty, 5);
  assert.equal(schedule.stability, 0);
  assert.equal(schedule.retrievability, 1);
  assert.equal(schedule.dueAt.toISOString(), baseNow.toISOString());
}

{
  const result = rateReviewItem(createReviewItemSchedule({ now: baseNow }), {
    rating: "again",
    now: baseNow,
  });
  assert.equal(result.qualityGrade, 1);
  assert.equal(result.next.state, "relearning");
  assert.equal(result.next.repetitions, 0);
  assert.equal(result.next.lapses, 1);
  assert.equal(result.next.intervalDays, 0.25);
  assert.equal(result.next.easeFactor, 2.3);
  assert.equal(hoursBetween(baseNow, result.next.dueAt), 6);
}

{
  const result = rateReviewItem(createReviewItemSchedule({ now: baseNow }), {
    rating: "hard",
    now: baseNow,
  });
  assert.equal(result.next.state, "learning");
  assert.equal(result.next.repetitions, 1);
  assert.equal(result.next.intervalDays, 1);
  assert.equal(result.next.easeFactor, 2.36);
}

{
  const first = rateReviewItem(createReviewItemSchedule({ now: baseNow }), {
    rating: "good",
    now: baseNow,
  });
  const second = rateReviewItem(first.next, {
    rating: "good",
    now: first.next.dueAt,
  });
  assert.equal(second.next.state, "learning");
  assert.equal(second.next.repetitions, 2);
  assert.equal(second.next.intervalDays, 3);
  assert.equal(second.next.easeFactor, 2.5);
}

{
  const mature = createReviewItemSchedule({ now: baseNow });
  mature.repetitions = 2;
  mature.intervalDays = 3;
  const result = rateReviewItem(mature, { rating: "easy", now: baseNow });
  assert.equal(result.next.state, "review");
  assert.equal(result.next.repetitions, 3);
  assert.equal(result.next.intervalDays, 8);
  assert.equal(result.next.easeFactor, 2.6);
}

{
  const capped = computeNextDueAt({
    now: baseNow,
    intervalDays: 10,
    targetTestDate: new Date("2026-06-25T12:00:00.000Z"),
  });
  assert.equal(capped.toISOString(), "2026-06-24T12:00:00.000Z");
}

assert.equal(
  shouldArchiveReviewItem({
    state: "review",
    repetitions: 5,
    intervalDays: 61,
    lapses: 0,
    recentRatings: ["good", "easy", "good"],
  }),
  true,
);
assert.equal(
  shouldArchiveReviewItem({
    state: "review",
    repetitions: 5,
    intervalDays: 61,
    lapses: 1,
    recentRatings: ["good", "easy", "good"],
  }),
  false,
);

{
  const input = CreateIeltsReviewItemSchema.parse({
    userId: "11111111-1111-4111-8111-111111111111",
    sourceType: "manual",
    sourceKey: "manual:collocation:boost-results",
    skill: "writing",
    focusArea: "collocation",
    reviewKind: "collocation",
    prompt: { en: "Use boost results.", vi: "Dùng cụm boost results." },
  });
  assert.equal(input.algorithm, "sm2_v1");
  assert.deepEqual(input.metadata, {});
}

{
  const input = RateIeltsReviewItemSchema.parse({
    reviewItemId: "22222222-2222-4222-8222-222222222222",
    rating: "easy",
    responseMs: 1200,
  });
  assert.equal(input.rating, "easy");
  assert.deepEqual(input.metadata, {});
}

console.log("ielts/review/scheduler.test.ts passed");
