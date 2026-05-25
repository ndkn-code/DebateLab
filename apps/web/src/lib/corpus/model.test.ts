import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  buildDebateCorpusItemPlans,
  estimateDebateCorpusTokens,
  formatRetrievedDebateCorpusContext,
  hashDebateCorpusContent,
  isSafeEvidenceStatusForRetrieval,
  purposeToCorpusUsableFor,
  type DebateCorpusSeed,
  type RetrievedDebateCorpusItem,
} from "./model";

const repoRoot = process.cwd().endsWith(`${path.sep}apps${path.sep}web`)
  ? path.resolve(process.cwd(), "../..")
  : process.cwd();
const seedPath = path.resolve(
  repoRoot,
  "data/corpus/truong-teen-2025.seed.normalized.json"
);
const seed = JSON.parse(fs.readFileSync(seedPath, "utf8")) as DebateCorpusSeed;
const items = buildDebateCorpusItemPlans(seed);

assert.equal(seed.sources.length, 14);
assert.equal(seed.canonical_matches.length, 4);
assert.equal(items.length, 209);
assert.equal(
  items.filter((item) => item.itemType === "debate_moment").length,
  110
);
assert.equal(
  items.filter((item) => item.itemType === "phrase_bank").length,
  67
);
assert.equal(
  items.filter((item) => item.itemType === "judging_lesson").length,
  32
);
assert.equal(
  items.some((item) =>
    item.canonicalMatchKey.includes("cac_cuoc_thi_mang_tinh_canh_tranh")
  ),
  false,
  "metadata-only final intro must not create RAG items"
);
assert.equal(
  new Set(
    items.map(
      (item) =>
        `${item.canonicalMatchKey}:${item.itemType}:${item.canonicalFingerprint}`
    )
  ).size,
  items.length,
  "importer upsert key must be unique/idempotent"
);

const first = items[0];
assert.equal(
  first.contentHash,
  hashDebateCorpusContent({
    content: first.content,
    embeddingText: first.embeddingText,
  })
);
assert.ok(first.embeddingText.includes("Motion:"));
assert.ok(first.embeddingText.includes("Strategic value:"));
assert.ok(estimateDebateCorpusTokens(first.embeddingText) > 20);

assert.equal(purposeToCorpusUsableFor("rebuttal"), "rebuttal");
assert.equal(purposeToCorpusUsableFor("judging"), "judging");
assert.equal(isSafeEvidenceStatusForRetrieval("uncertain_stt"), false);
assert.equal(isSafeEvidenceStatusForRetrieval("mentioned_but_unverified"), true);

const retrieved: RetrievedDebateCorpusItem[] = [
  {
    item_id: "item-1",
    canonical_match_key: "match-1",
    motion_vi: "Nên bỏ kỳ thi tốt nghiệp trung học phổ thông",
    item_type: "debate_moment",
    side: "opposition",
    usable_for: ["rebuttal", "eval"],
    evidence_status: "mentioned_but_unverified",
    confidence: 0.95,
    review_status: "candidate",
    embedding_text: first.embeddingText,
    content: first.content,
    similarity: 0.81234,
  },
  {
    item_id: "item-2",
    canonical_match_key: "match-2",
    motion_vi: "Sáng tác văn học nên là nội dung bắt buộc",
    item_type: "debate_moment",
    side: "proposition",
    usable_for: ["rebuttal"],
    evidence_status: "uncertain_stt",
    confidence: 0.9,
    review_status: "candidate",
    embedding_text: first.embeddingText,
    content: first.content,
    similarity: 0.7,
  },
];

const context = formatRetrievedDebateCorpusContext(retrieved, "rebuttal");
assert.match(context, /Truong Teen Retrieved Context/);
assert.match(context, /debater-mentioned, not independently verified/);
assert.doesNotMatch(context, /item-2/);
assert.ok(context.length < 2500, "retrieved prompt context should stay compact");
assert.equal(formatRetrievedDebateCorpusContext(retrieved, "judging"), "");
