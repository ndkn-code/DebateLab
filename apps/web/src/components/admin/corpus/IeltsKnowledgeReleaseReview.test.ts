import assert from "node:assert/strict";

import {
  getIeltsKnowledgeReleaseModel,
  IELTS_KNOWLEDGE_RELEASE_VERSION,
} from "./IeltsKnowledgeReleaseReview";

const source = {
  title: "Thinkfy IELTS mock",
  review_status: "approved",
  rights_status: "approved_for_derived_use",
  submitted_by: "importer",
  reviewed_by: "reviewer",
};
const item = {
  id: "item-1",
  source_id: "source-1",
  collection_version: IELTS_KNOWLEDGE_RELEASE_VERSION,
  item_kind: "practice_prompt",
  usable_for: ["coaching"],
  review_status: "approved",
  submitted_by: "importer",
  reviewed_by: "reviewer",
  ai_knowledge_sources: source,
};

const basePayload = {
  collection: { slug: "ielts.writing" },
  versions: [{ version: 2, status: "draft" }],
  items: [item, { ...item, id: "old-item", collection_version: 1 }],
};

const completePreflight = {
  ready: true,
  collection: "ielts.writing",
  version: 2,
  versionStatus: "draft",
  counts: {
    items: 1,
    coachingOnly: 1,
    answerKeyFlags: 0,
    approvedItems: 1,
    approvedSources: 1,
    currentEmbeddings: 1,
  },
  blockers: [],
};

{
  const model = getIeltsKnowledgeReleaseModel({
    collection: "ielts.writing",
    payload: { ...basePayload, preflight: completePreflight },
  });
  assert.equal(model.items.length, 1);
  assert.equal(model.sources.length, 1);
  assert.equal(model.sources[0]?.itemCount, 1);
  assert.equal(model.canPublish, true);
  assert.equal(model.counts.answerKeyFlags, 0);
  assert.deepEqual(model.blockers, []);
}

{
  const model = getIeltsKnowledgeReleaseModel({
    collection: "ielts.writing",
    payload: basePayload,
  });
  assert.equal(model.canPublish, false);
  assert.equal(model.counts.answerKeyFlags, null);
  assert.equal(model.counts.currentEmbeddings, null);
  assert.match(model.blockers.join(","), /safe_preflight_unavailable/);
}

{
  const model = getIeltsKnowledgeReleaseModel({
    collection: "ielts.writing",
    payload: {
      ...basePayload,
      preflight: {
        ...completePreflight,
        counts: { ...completePreflight.counts, currentEmbeddings: "1" },
      } as never,
    },
  });
  assert.equal(model.preflightAvailable, false);
  assert.equal(model.canPublish, false);
}

{
  const model = getIeltsKnowledgeReleaseModel({
    collection: "ielts.writing",
    payload: {
      ...basePayload,
      items: [
        {
          ...item,
          reviewed_by: "importer",
          ai_knowledge_sources: { ...source, reviewed_by: "importer" },
        },
      ],
    },
  });
  assert.equal(model.itemsComplete, false);
  assert.equal(model.sourcesComplete, false);
  assert.match(model.blockers.join(","), /items_need_independent_review/);
  assert.match(model.blockers.join(","), /sources_need_rights/);
}

{
  const model = getIeltsKnowledgeReleaseModel({
    collection: "ielts.writing",
    payload: {
      ...basePayload,
      preflight: { ...completePreflight, collection: "ielts.speaking" },
    },
  });
  assert.equal(model.preflightAvailable, false);
  assert.equal(model.canPublish, false);
  assert.match(model.blockers.join(","), /safe_preflight_unavailable/);
}

{
  const model = getIeltsKnowledgeReleaseModel({
    collection: "ielts.writing",
    payload: {
      ...basePayload,
      items: [{ ...item, usable_for: ["coaching", "grading"] }],
      preflight: completePreflight,
    },
  });
  assert.equal(model.canPublish, false);
  assert.match(model.blockers.join(","), /contains_non_coaching_material/);
}

console.log("IELTS knowledge release review tests passed");
