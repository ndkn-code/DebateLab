import assert from "node:assert/strict";
import test from "node:test";

import { buildOfficialIeltsKnowledgeRecords } from "./ielts-release-corpus";
import { buildKnowledgeIngestionPlan, ingestKnowledgePlan } from "./ingestion";

function speakingPlan() {
  const records = buildOfficialIeltsKnowledgeRecords("ielts.speaking");
  return buildKnowledgeIngestionPlan({
    collection: "ielts.speaking",
    collectionVersion: 5,
    sources: records.sources,
    items: records.items,
  });
}

test("all 35 official Speaking inputs have distinct deterministic identities", () => {
  const first = speakingPlan();
  const second = speakingPlan();
  assert.equal(first.items.length, 35);
  assert.equal(new Set(first.items.map((item) => item.id)).size, 35);
  assert.deepEqual(
    first.items.map((item) => item.id),
    second.items.map((item) => item.id),
  );
});

test("same-band same-topic Speaking example locators remain distinct", () => {
  const plan = speakingPlan();
  for (const band of [6, 8]) {
    const pair = plan.items.filter(
      (item) =>
        item.itemType === "scored_example_locator_candidate" &&
        item.bandMin === band &&
        item.taskType === "speaking_part_3",
    );
    assert.equal(pair.length, 2, `expected known Band ${band} pair`);
    assert.equal(new Set(pair.map((item) => item.sourceLocator)).size, 2);
    assert.equal(new Set(pair.map((item) => item.id)).size, 2);
    assert.equal(new Set(pair.map((item) => item.contentHash)).size, 2);
  }
});

test("locator whitespace is canonicalized before identity hashing", () => {
  const records = buildOfficialIeltsKnowledgeRecords("ielts.speaking");
  const original = records.items[0]!;
  assert.throws(
    () =>
      buildKnowledgeIngestionPlan({
        collection: "ielts.speaking",
        collectionVersion: 5,
        sources: records.sources,
        items: [
          { ...original, sourceLocator: "Speaking descriptors  page 1" },
          { ...original, sourceLocator: " Speaking descriptors\npage 1 " },
        ],
      }),
    /knowledge_plan_duplicate_item_ids:groups=1:rows=2/,
  );
});

test("a duplicate plan is rejected before Supabase or Voyage can run", async () => {
  const valid = speakingPlan();
  const duplicatePlan = {
    ...valid,
    items: [valid.items[0]!, valid.items[0]!],
  };
  let externalAccesses = 0;
  const inaccessibleClient = new Proxy(
    {},
    {
      get() {
        externalAccesses += 1;
        throw new Error("external dependency must not be reached");
      },
    },
  );

  await assert.rejects(
    ingestKnowledgePlan({
      supabase: inaccessibleClient as never,
      plan: duplicatePlan,
      embed: true,
      submittedBy: "8ab4ff4f-17ee-4c6f-bc11-0c224be2ce76",
    }),
    /knowledge_plan_duplicate_item_ids:groups=1:rows=2/,
  );
  assert.equal(externalAccesses, 0);
});
