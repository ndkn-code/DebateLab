import assert from "node:assert/strict";

import {
  calculateCourseCompletionXp,
  calculateDuelXp,
  calculateLessonXp,
  calculatePracticeXp,
  createXpIdempotencyKey,
  getLevelFromXp,
} from "./model";

{
  const lowVolumeQuality = calculatePracticeXp({
    mode: "full",
    durationSeconds: 420,
    totalScore: 88,
    topicDifficulty: "advanced",
    aiDifficulty: "hard",
    previousBestScore: 80,
  });
  const spammyEasy = calculatePracticeXp({
    mode: "quick",
    durationSeconds: 80,
    totalScore: 45,
    topicDifficulty: "beginner",
    previousBestScore: 60,
  });

  assert.equal(lowVolumeQuality.eligible, true);
  assert.equal(spammyEasy.eligible, true);
  assert.ok(lowVolumeQuality.total > spammyEasy.total * 2);
  assert.ok(lowVolumeQuality.components.personalBest > 0);
  assert.ok(lowVolumeQuality.components.topicChallenge > 0);
}

{
  const tooShort = calculatePracticeXp({
    mode: "quick",
    durationSeconds: 12,
    totalScore: 95,
  });
  const missingScore = calculatePracticeXp({
    mode: "full",
    durationSeconds: 300,
    totalScore: null,
  });

  assert.equal(tooShort.total, 0);
  assert.equal(tooShort.reason, "below_min_duration");
  assert.equal(missingScore.total, 0);
  assert.equal(missingScore.reason, "missing_score");
}

{
  const lesson = calculateLessonXp({ activityType: "lesson", score: null });
  const quiz = calculateLessonXp({ activityType: "quiz", score: 8, maxScore: 10 });
  const flashcard = calculateLessonXp({
    activityType: "flashcard",
    score: 1,
    maxScore: 4,
  });

  assert.equal(lesson.total, 12);
  assert.equal(quiz.total, 22);
  assert.equal(flashcard.total, 7);
}

{
  assert.equal(calculateCourseCompletionXp().total, 100);
  assert.equal(calculateDuelXp({ result: "win", integrityStatus: "clean" }).total, 50);
  assert.equal(
    calculateDuelXp({ result: "win", integrityStatus: "no_contest" }).reason,
    "integrity_excluded"
  );
}

{
  assert.equal(getLevelFromXp(0), 1);
  assert.equal(getLevelFromXp(499), 1);
  assert.equal(getLevelFromXp(500), 2);
  assert.equal(getLevelFromXp(1250), 3);
  assert.equal(
    createXpIdempotencyKey(["practice", "user:1", null, 3]),
    "practice:user_1:none:3"
  );
}

console.log("XP model tests passed");

