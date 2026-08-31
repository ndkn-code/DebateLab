import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildIeltsMockKnowledgeRecords,
  buildOfficialIeltsKnowledgeRecords,
  IELTS_OFFICIAL_SOURCE_URLS,
  type IeltsKnowledgeQuestionRow,
} from "./ielts-release-corpus";
import { buildKnowledgeIngestionPlan } from "./ingestion";

test("official IELTS calibration covers Bands 4-9 by criterion and stays review-gated", () => {
  const writing = buildOfficialIeltsKnowledgeRecords("ielts.writing");
  const speaking = buildOfficialIeltsKnowledgeRecords("ielts.speaking");

  assert.equal(writing.items.length, 72);
  assert.equal(speaking.items.length, 24);
  for (const records of [writing, speaking]) {
    for (const source of records.sources) {
      assert.equal(new URL(source.canonicalUrl).hostname, "ielts.org");
      assert.equal(source.authorityTier, "official");
      assert.equal(source.rightsStatus, "requires_review");
      assert.equal(source.reviewStatus, "candidate");
    }
    for (const item of records.items) {
      assert.equal(item.reviewStatus, "needs_review");
      assert.deepEqual(item.usableFor, ["grading", "coaching"]);
      assert.equal(item.permittedExcerpt, undefined);
      assert.equal(item.bandMin, item.bandMax);
      assert.ok([4, 5, 6, 7, 8, 9].includes(item.bandMin ?? -1));
      assert.equal(item.metadata?.derivedOnly, true);
      assert.equal(item.metadata?.fullResponseStored, false);
      assert.equal(item.metadata?.rightsChecked, false);
      assert.equal(item.insight.sourceAuthority, "official");
      assert.ok(item.insight.adjacentBandDistinction);
    }
  }

  const writingCoverage = new Set(
    writing.items.map(
      (item) => `${item.taskType}:${item.criterion}:${item.bandMin}`,
    ),
  );
  for (const taskType of [
    "academic_task_1",
    "general_training_task_1",
    "writing_task_2",
  ]) {
    const firstCriterion =
      taskType === "writing_task_2" ? "task_response" : "task_achievement";
    for (const criterion of [
      firstCriterion,
      "coherence_and_cohesion",
      "lexical_resource",
      "grammatical_range_and_accuracy",
    ]) {
      for (const band of [4, 5, 6, 7, 8, 9]) {
        assert.ok(writingCoverage.has(`${taskType}:${criterion}:${band}`));
      }
    }
  }
});

test("mock recommendations stay first-party, answer-free, and coaching-only", () => {
  const rows: IeltsKnowledgeQuestionRow[] = [
    {
      id: "question-1",
      skill: "writing",
      question_type: "writing_task_2",
      prompt: "Discuss both views and give your opinion.",
      metadata: {
        coach_criteria: ["task_response", "coherence_and_cohesion"],
        subskill_tags: ["position", "development"],
      },
      ielts_tests: {
        slug: "mock-writing-1",
        title: "Mock Writing 1",
        status: "published",
      },
    },
  ];
  const records = buildIeltsMockKnowledgeRecords({
    rows,
    collection: "ielts.writing",
  });

  assert.equal(records.sources.length, 1);
  assert.equal(records.items.length, 2);
  assert.equal(records.sources[0]?.publisher, "DebateLab");
  assert.equal(records.sources[0]?.authorityTier, "ai_derived");
  for (const item of records.items) {
    assert.deepEqual(item.usableFor, ["coaching"]);
    assert.equal(item.reviewStatus, "needs_review");
    assert.equal(item.metadata?.answerKeyAvailable, false);
    assert.equal(item.metadata?.notOfficialIelts, true);
  }
});

test("combined release plans validate without copying official response text", () => {
  const official = buildOfficialIeltsKnowledgeRecords("ielts.speaking");
  const plan = buildKnowledgeIngestionPlan({
    collection: "ielts.speaking",
    collectionVersion: 3,
    sources: official.sources,
    items: official.items,
  });

  assert.equal(plan.items.length, 24);
  assert.ok(plan.importKey.length > 32);
  assert.equal(
    IELTS_OFFICIAL_SOURCE_URLS.speakingDescriptors.startsWith(
      "https://ielts.org/",
    ),
    true,
  );
  assert.equal(
    plan.items.some((item) => item.embeddingText.includes("Candidate:")),
    false,
  );
});
