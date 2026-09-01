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
    provenance: {
      raterCount: 2,
      independentlyMarked: true as const,
      raterAuthorities: [
        "official_examiner" as const,
        "official_examiner" as const,
      ],
      adjudicationMethod: "official_published_adjudication" as const,
      adjudicationLocator: "page 3",
    },
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

const scannedWritingBenchmark = {
  ...writingBenchmark,
  benchmarkKey: "qualified-writing-scan-holdout-001",
  protectedLabel: {
    ...writingBenchmark.protectedLabel,
    input: {
      prompt: "Protected benchmark prompt",
      responseObjectPath: "benchmarks/writing/scan-001.pdf",
      artifactSha256: "b".repeat(64),
      artifactContentType: "application/pdf",
      responseLocator: "PDF page 1",
    },
  },
};

assert.equal(
  parseGradingBenchmarkImport({
    ...validManifest,
    benchmarks: [scannedWritingBenchmark],
  }).benchmarks[0]?.protectedLabel.input.responseObjectPath,
  "benchmarks/writing/scan-001.pdf",
);

assert.throws(
  () =>
    parseGradingBenchmarkImport({
      ...validManifest,
      benchmarks: [
        {
          ...scannedWritingBenchmark,
          protectedLabel: {
            ...scannedWritingBenchmark.protectedLabel,
            input: {
              ...scannedWritingBenchmark.protectedLabel.input,
              artifactSha256: undefined,
            },
          },
        },
      ],
    }),
  /require a SHA-256 checksum/,
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
            input: {
              ...writingBenchmark.protectedLabel.input,
              responseObjectPath: "benchmarks/writing/duplicate.pdf",
              artifactSha256: "c".repeat(64),
              artifactContentType: "application/pdf",
            },
          },
        },
      ],
    }),
  /exactly one of responseText, responseObjectPath, or audioObjectPath/,
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
            provenance: {
              ...writingBenchmark.protectedLabel.provenance,
              raterCount: 3,
            },
          },
        },
      ],
    }),
  /Rater authority count must equal raterCount/,
);

const speakingBenchmark = {
  ...writingBenchmark,
  benchmarkKey: "official-speaking-part2-holdout-001",
  collectionSlug: "ielts.speaking" as const,
  skill: "ielts_speaking" as const,
  taskType: "speaking_part2_cuecard",
  accentGroup: "vi",
  protectedLabel: {
    ...writingBenchmark.protectedLabel,
    criteria: {
      fluencyCoherence: { band: 6.5, labelLocator: "mark sheet" },
      lexicalResource: { band: 6.5, labelLocator: "mark sheet" },
      grammaticalRangeAccuracy: { band: 6, labelLocator: "mark sheet" },
      pronunciation: { band: 6, labelLocator: "mark sheet" },
    },
    input: {
      prompt: "Protected speaking prompt",
      audioObjectPath: "benchmarks/speaking/vi-001.wav",
      artifactSha256: "d".repeat(64),
      artifactContentType: "audio/wav",
      responseLocator: "full recording",
    },
  },
  metadata: { l1Group: "Vietnamese", audioQualityGroup: "typical_device" },
};

assert.equal(
  parseGradingBenchmarkImport({
    ...validManifest,
    benchmarks: [speakingBenchmark],
  }).benchmarks[0]?.protectedLabel.input.audioObjectPath,
  "benchmarks/speaking/vi-001.wav",
);

assert.throws(
  () =>
    parseGradingBenchmarkImport({
      ...validManifest,
      benchmarks: [
        {
          ...speakingBenchmark,
          metadata: { l1Group: "Vietnamese" },
        },
      ],
    }),
  /requires accent, L1, and audio-quality groups/,
);

console.log("AI grading benchmark import contract tests passed");
