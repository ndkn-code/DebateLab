import assert from "node:assert/strict";

import { parseGradingBenchmarkImport } from "./contracts";

const source = {
  canonicalUrl: "https://example.org/official-ielts-holdout.pdf",
  publisher: "Official test publisher",
  title: "Reviewed examiner-scored holdout",
  authorityTier: "official" as const,
  rightsStatus: "approved_for_derived_use" as const,
  checksum: "a".repeat(64),
  reviewedBy: "rights-reviewer@example.org",
  reviewedAt: "2026-08-31T12:00:00.000Z",
  reviewNotes: "Approved for protected offline evaluation only.",
};

const writingBenchmark = {
  benchmarkKey: "official-writing-task2-holdout-001",
  collectionSlug: "ielts.writing" as const,
  sourceUrl: source.canonicalUrl,
  skill: "ielts_writing" as const,
  taskType: "writing_task2_essay",
  bandOrScoreRange: "6.5",
  accentGroup: "vi",
  split: "holdout" as const,
  protectedLabel: {
    criteria: {
      taskResponse: { band: 6.5, labelLocator: "page 3" },
      coherenceCohesion: { band: 6, labelLocator: "page 3" },
      lexicalResource: { band: 6.5, labelLocator: "page 3" },
      grammaticalRangeAccuracy: { band: 6, labelLocator: "page 3" },
    },
    input: {
      prompt: "Protected benchmark prompt",
      responseText: "Protected benchmark response",
      responseLocator: "page 2",
    },
    rubricVersion: "ielts-writing-2023",
    labelAuthority: "official_examiner" as const,
  },
  metadata: { protectedOfflineEvaluationOnly: true },
};

const validManifest = {
  manifestVersion: 1 as const,
  createdAt: "2026-08-31T12:00:00.000Z",
  sources: [source],
  benchmarks: [writingBenchmark],
};

assert.equal(
  parseGradingBenchmarkImport(validManifest).benchmarks[0]?.benchmarkKey,
  writingBenchmark.benchmarkKey,
);

assert.throws(
  () =>
    parseGradingBenchmarkImport({
      ...validManifest,
      benchmarks: [
        {
          ...writingBenchmark,
          protectedLabel: {
            ...writingBenchmark.protectedLabel,
            criteria: {
              taskResponse: { band: 6.5, labelLocator: "page 3" },
            },
          },
        },
      ],
    }),
  /Incomplete or unknown criterion labels/,
);

assert.throws(
  () =>
    parseGradingBenchmarkImport({
      ...validManifest,
      sources: [{ ...source, rightsStatus: "requires_review" }],
    }),
  /Invalid enum value|Invalid option/,
);

assert.throws(
  () =>
    parseGradingBenchmarkImport({
      ...validManifest,
      benchmarks: [
        writingBenchmark,
        {
          ...writingBenchmark,
          benchmarkKey: "official-writing-task2-development-001",
          split: "development",
        },
      ],
    }),
  /Source leakage across benchmark splits/,
);

assert.throws(
  () =>
    parseGradingBenchmarkImport({
      ...validManifest,
      benchmarks: [writingBenchmark, writingBenchmark],
    }),
  /Duplicate benchmarkKey/,
);

console.log("AI grading benchmark import contract tests passed");
