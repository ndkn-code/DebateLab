import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildIeltsMockKnowledgeRecords,
  buildOfficialIeltsKnowledgeRecords,
  IELTS_OFFICIAL_SOURCE_URLS,
  type IeltsKnowledgeQuestionRow,
} from "./ielts-release-corpus";
import { buildKnowledgeIngestionPlan } from "./ingestion";
import { buildGenericKnowledgeRpcArgs } from "./runtime";

test("official IELTS calibration covers Bands 4-9 by criterion and stays review-gated", () => {
  const writing = buildOfficialIeltsKnowledgeRecords("ielts.writing");
  const speaking = buildOfficialIeltsKnowledgeRecords("ielts.speaking");

  assert.equal(writing.items.length, 78);
  assert.equal(speaking.items.length, 35);
  for (const records of [writing, speaking]) {
    for (const source of records.sources) {
      assert.equal(new URL(source.canonicalUrl).hostname, "ielts.org");
      assert.equal(source.authorityTier, "official");
      assert.equal(source.rightsStatus, "requires_review");
      assert.equal(source.reviewStatus, "candidate");
    }
    for (const item of records.items.filter(
      (candidate) => candidate.itemType === "rubric_descriptor_candidate",
    )) {
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

test("production scorer filters match every official IELTS rubric criterion", () => {
  const cases = [
    {
      collection: "ielts.writing" as const,
      taskType: "writing_task1_academic",
      criteria: [
        "taskResponse",
        "coherenceCohesion",
        "lexicalResource",
        "grammaticalRangeAccuracy",
      ],
    },
    {
      collection: "ielts.writing" as const,
      taskType: "writing_task1_general",
      criteria: [
        "taskResponse",
        "coherenceCohesion",
        "lexicalResource",
        "grammaticalRangeAccuracy",
      ],
    },
    {
      collection: "ielts.writing" as const,
      taskType: "writing_task2_essay",
      criteria: [
        "taskResponse",
        "coherenceCohesion",
        "lexicalResource",
        "grammaticalRangeAccuracy",
      ],
    },
    ...["speaking_part1", "speaking_part2_cuecard", "speaking_part3"].map(
      (taskType) => ({
        collection: "ielts.speaking" as const,
        taskType,
        criteria: [
          "fluencyCoherence",
          "lexicalResource",
          "grammaticalRangeAccuracy",
          "pronunciation",
        ],
      }),
    ),
  ];

  for (const testCase of cases) {
    const records = buildOfficialIeltsKnowledgeRecords(testCase.collection);
    for (const criterion of testCase.criteria) {
      const args = buildGenericKnowledgeRpcArgs({
        collection: testCase.collection,
        query: "adjacent band evidence",
        purpose: "grading",
        language: "en",
        sourceRoute: "ielts-release-corpus-contract-test",
        taskType: testCase.taskType,
        criteria: [criterion],
        targetBands: [6, 7, 8],
      });
      const filters = args.p_filters as Record<string, unknown>;
      assert.ok(
        records.items.some(
          (item) =>
            item.taskType === filters.taskType &&
            item.criterion === filters.criterion &&
            item.bandMin != null &&
            item.bandMax != null &&
            item.bandMax >= 6 &&
            item.bandMin <= 8,
        ),
        `${testCase.taskType}/${criterion} has no matching official corpus item`,
      );
    }
  }
});

test("official scored-example locators are coaching-only and cannot become benchmark truth", () => {
  const writing = buildOfficialIeltsKnowledgeRecords("ielts.writing");
  const speaking = buildOfficialIeltsKnowledgeRecords("ielts.speaking");
  const examples = [...writing.items, ...speaking.items].filter(
    (item) => item.itemType === "scored_example_locator_candidate",
  );

  assert.equal(examples.length, 17);
  assert.deepEqual(
    new Set(examples.map((item) => item.bandMin)),
    new Set([4, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9]),
  );
  for (const item of examples) {
    assert.equal(item.reviewStatus, "needs_review");
    assert.deepEqual(item.usableFor, ["coaching", "explanation"]);
    assert.equal(item.criterion, "overall_performance");
    assert.equal(item.permittedExcerpt, undefined);
    assert.equal(item.metadata?.fullResponseStored, false);
    assert.equal(item.metadata?.transcriptStored, false);
    assert.equal(item.metadata?.criterionScoresPublished, false);
    assert.equal(item.metadata?.benchmarkEligible, false);
    assert.equal(
      item.metadata?.retrievalClassification,
      "coaching_example_locator",
    );
    assert.ok(item.sourceLocator);
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

  assert.equal(plan.items.length, 35);
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
