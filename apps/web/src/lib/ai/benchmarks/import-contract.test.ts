import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  countInvalidStoredBenchmarkRows,
  isReleaseEligibleStoredBenchmark,
  parseOperationalSafetyEvidence,
  parseGradingBenchmarkImport,
} from "./contracts";

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
      artifactSha256: "e".repeat(64),
      modelInputSha256: "7".repeat(64),
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
          protectedLabel: {
            ...writingBenchmark.protectedLabel,
            input: {
              ...writingBenchmark.protectedLabel.input,
              responseText: "A different protected development response.",
              responseLocator: "examiner packet page 4",
              artifactSha256: "9".repeat(64),
            },
          },
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
      modelInputSha256: "8".repeat(64),
      artifactContentType: "application/pdf",
      artifactStorageVersion: "storage-version-1",
      artifactEtag: "etag-scan-001",
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
        scannedWritingBenchmark,
        {
          ...scannedWritingBenchmark,
          benchmarkKey: "qualified-writing-scan-holdout-002",
          protectedLabel: {
            ...scannedWritingBenchmark.protectedLabel,
            input: {
              ...scannedWritingBenchmark.protectedLabel.input,
              responseObjectPath: "benchmarks/writing/scan-copy.pdf",
              responseLocator: "PDF page 2",
              artifactSha256: "B".repeat(64),
              artifactStorageVersion: "storage-version-copy",
              artifactEtag: "etag-scan-copy",
            },
          },
        },
      ],
    }),
  /Duplicate benchmark artifact/,
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
  /expected string|SHA-256/,
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
      modelInputSha256: "6".repeat(64),
      artifactContentType: "audio/wav",
      artifactStorageVersion: "storage-version-2",
      artifactEtag: "etag-audio-001",
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

assert.throws(
  () =>
    parseGradingBenchmarkImport({
      ...validManifest,
      benchmarks: [
        writingBenchmark,
        {
          ...writingBenchmark,
          benchmarkKey: "official-writing-task2-holdout-duplicate-artifact",
        },
      ],
    }),
  /Duplicate benchmark artifact/,
);

const storedSource = {
  canonicalUrl: source.canonicalUrl,
  authorityTier: source.authorityTier,
  rightsStatus: source.rightsStatus,
  reviewStatus: "approved" as const,
  checksum: source.checksum,
  submittedBy: "00000000-0000-4000-8000-000000000001",
  reviewedBy: "00000000-0000-4000-8000-000000000002",
};
const storedWritingBenchmark = {
  benchmarkKey: writingBenchmark.benchmarkKey,
  skill: writingBenchmark.skill,
  taskType: writingBenchmark.taskType,
  accentGroup: writingBenchmark.accentGroup,
  protectedLabel: writingBenchmark.protectedLabel,
  metadata: writingBenchmark.metadata,
  source: storedSource,
};
assert.equal(isReleaseEligibleStoredBenchmark(storedWritingBenchmark), true);
assert.equal(
  isReleaseEligibleStoredBenchmark({
    ...storedWritingBenchmark,
    source: { ...storedSource, reviewStatus: "needs_review" },
  }),
  false,
);
assert.equal(
  isReleaseEligibleStoredBenchmark({
    ...storedWritingBenchmark,
    source: { ...storedSource, reviewedBy: storedSource.submittedBy },
  }),
  false,
);
assert.equal(
  countInvalidStoredBenchmarkRows([
    storedWritingBenchmark,
    {
      ...storedWritingBenchmark,
      benchmarkKey: "duplicate-stored-artifact",
    },
  ]),
  1,
);

const importer = readFileSync(
  resolve(process.cwd(), "src/scripts/ai-grading-benchmarks-import.ts"),
  "utf8",
);
assert.match(importer, /submitted_by,reviewed_by/);
assert.match(importer, /existing\.submitted_by !== existing\.reviewed_by/);
assert.match(importer, /equalJson\(existing\.metadata, row\.metadata\)/);
assert.match(importer, /sha256\(input\.responseText\)/);
assert.match(importer, /artifactStorageVersion/);
assert.match(importer, /\.download\(objectName\)/);
assert.match(
  importer,
  /must be registered and independently approved before label import/,
);
assert.doesNotMatch(importer, /\.from\("ai_knowledge_sources"\)\s*\.insert/);

const operationalScenarios = [
  "duplicate_delivery",
  "provider_timeout",
  "stale_claim",
  "persistence_retry",
  "retry_exhaustion",
].map((scenario, index) => ({
  workflowRunId: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
  scenario,
  expectedProviderCalls: scenario === "retry_exhaustion" ? 3 : 1,
  observedProviderCalls: scenario === "retry_exhaustion" ? 3 : 1,
  actualProviderCalls: scenario === "retry_exhaustion" ? 3 : 1,
  terminalStatus:
    scenario === "provider_timeout" || scenario === "retry_exhaustion"
      ? "failed"
      : "completed",
  actualWorkflowStatus:
    scenario === "provider_timeout" || scenario === "retry_exhaustion"
      ? "failed"
      : "completed",
  invalidAuthoritativeCitationCount: 0,
  passed: true,
  detailsHash: "f".repeat(64),
}));
assert.ok(
  parseOperationalSafetyEvidence({
    runId: "preview-fault-injection-1",
    graderVersion: "provisional-v1",
    corpusVersion: 1,
    environment: "preview",
    deploymentId: "preview-deployment-1",
    imageDigest: `sha256:${"1".repeat(64)}`,
    startedAt: "2026-09-01T10:00:00.000Z",
    verifiedAt: "2026-09-01T10:30:00.000Z",
    expiresAt: "2026-09-08T10:30:00.000Z",
    evidenceHash: "a".repeat(64),
    scenarios: operationalScenarios,
  }),
);
assert.ok(
  parseOperationalSafetyEvidence({
    runId: "preview-adjudicated-fault-injection-1",
    graderVersion: "evidence-adjudicated-v1",
    corpusVersion: 1,
    environment: "preview",
    deploymentId: "preview-deployment-1",
    imageDigest: `sha256:${"2".repeat(64)}`,
    startedAt: "2026-09-01T10:00:00.000Z",
    verifiedAt: "2026-09-01T10:30:00.000Z",
    expiresAt: "2026-09-08T10:30:00.000Z",
    evidenceHash: "a".repeat(64),
    scenarios: operationalScenarios.map((scenario) => {
      const calls =
        scenario.scenario === "retry_exhaustion"
          ? 3
          : scenario.scenario === "provider_timeout"
            ? 1
            : 2;
      return {
        ...scenario,
        expectedProviderCalls: calls,
        observedProviderCalls: calls,
        actualProviderCalls: calls,
      };
    }),
  }),
);
assert.equal(
  parseOperationalSafetyEvidence({
    runId: "preview-fault-injection-incomplete",
    graderVersion: "provisional-v1",
    corpusVersion: 1,
    environment: "preview",
    deploymentId: "preview-deployment-1",
    imageDigest: `sha256:${"1".repeat(64)}`,
    startedAt: "2026-09-01T10:00:00.000Z",
    verifiedAt: "2026-09-01T10:30:00.000Z",
    expiresAt: "2026-09-08T10:30:00.000Z",
    evidenceHash: "a".repeat(64),
    scenarios: operationalScenarios.slice(0, 4),
  }),
  null,
);
assert.equal(
  parseOperationalSafetyEvidence({
    runId: "preview-fault-injection-counter-mismatch",
    graderVersion: "provisional-v1",
    corpusVersion: 1,
    environment: "preview",
    deploymentId: "preview-deployment-1",
    imageDigest: `sha256:${"1".repeat(64)}`,
    startedAt: "2026-09-01T10:00:00.000Z",
    verifiedAt: "2026-09-01T10:30:00.000Z",
    expiresAt: "2026-09-08T10:30:00.000Z",
    evidenceHash: "a".repeat(64),
    scenarios: operationalScenarios.map((scenario, index) =>
      index === 0 ? { ...scenario, actualProviderCalls: 2 } : scenario,
    ),
  }),
  null,
);

console.log("AI grading benchmark import contract tests passed");
