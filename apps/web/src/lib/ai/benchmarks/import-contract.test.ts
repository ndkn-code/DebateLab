import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  countInvalidStoredBenchmarkRows,
  isReleaseEligibleStoredBenchmark,
  parseOperationalSafetyEvidence,
  parseGradingBenchmarkImport,
} from "./contracts";

const sha256 = (value: string) =>
  createHash("sha256").update(value, "utf8").digest("hex");

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
      grounding: {
        questionReferenceAnswer: "Reviewed exact-question model answer",
        examinerNotes: ["Address every part of the task."],
        peerReferenceAnswers: ["Reviewed same-task peer answer"],
      },
      cueCardBullets: [],
      artifactSha256: "e".repeat(64),
      modelInputSha256: "7".repeat(64),
      responseLocator: "page 2",
    },
    rubricVersion: "ielts-writing-rubric-v1",
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
      responseObjectPath:
        "ai-grading-benchmarks-private/writing/scan-001.pdf",
      scoringResponseText: "Reviewed OCR transcription of the response.",
      grounding: writingBenchmark.protectedLabel.input.grounding,
      cueCardBullets: [],
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
  "ai-grading-benchmarks-private/writing/scan-001.pdf",
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
              responseObjectPath: "public/writing/scan-001.pdf",
            },
          },
        },
      ],
    }),
  /must be stored in ai-grading-benchmarks-private/,
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
              responseObjectPath:
                "ai-grading-benchmarks-private/writing/scan-copy.pdf",
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
              responseObjectPath:
                "ai-grading-benchmarks-private/writing/duplicate.pdf",
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
      audioObjectPath:
        "ai-grading-benchmarks-private/speaking/vi-001.wav",
      scoringResponseText:
        "I would like to describe a teacher who changed how I learn.",
      scoringContext: {
        durationSeconds: 65,
        pronunciation: {
          pronunciationScore: 72,
          accuracyScore: 74,
          fluencyScore: 70,
          completenessScore: null,
          prosodyScore: 69,
          mispronouncedWords: ["changed"],
        },
      },
      grounding: {
        questionReferenceAnswer: "Reviewed exact-question sample answer",
        examinerNotes: ["Cover every cue-card bullet."],
        peerReferenceAnswers: ["Reviewed Part 2 peer answer"],
      },
      cueCardBullets: [
        "who the teacher was",
        "what the teacher taught",
        "why the teacher was helpful",
      ],
      audioPreprocessing: {
        audioArtifactSha256: "d".repeat(64),
        stt: {
          provider: "deepgram",
          model: "nova-3",
          transcriptSha256: sha256(
            "I would like to describe a teacher who changed how I learn.",
          ),
        },
        pronunciation: {
          provider: "azure" as const,
          model: "pronunciation-assessment" as const,
          apiVersion: "speech-sdk/1.51.0" as const,
          assessmentMode: "unscripted" as const,
          config: {
            locale: "en-US",
            gradingSystem: "HundredMark" as const,
            granularity: "Phoneme" as const,
            dimension: "Comprehensive" as const,
            phonemeAlphabet: "IPA" as const,
            enableProsodyAssessment: true as const,
            enableMiscue: false as const,
            audioFormat: {
              container: "wav" as const,
              encoding: "pcm_s16le" as const,
              sampleRateHertz: 16_000 as const,
              bitsPerSample: 16 as const,
              channels: 1 as const,
            },
            referenceTextSha256: sha256(""),
          },
          configSha256: "4".repeat(64),
          reportObjectPath:
            "ai-grading-benchmarks-private/azure/vi-001.json",
          reportStorageVersion: "report-storage-v1",
          reportEtag: "report-etag-v1",
          reportSha256: "5".repeat(64),
          completenessLimitationReason:
            "Unscripted continuous assessment does not report completeness.",
        },
        acousticAttestation: {
          envelope: {
            envelopeVersion: 1 as const,
            benchmarkKey: "official-speaking-part2-holdout-001",
            captureId: "00000000-0000-4000-8000-000000000099",
            audioObjectPath:
              "ai-grading-benchmarks-private/speaking/vi-001.wav",
            reportObjectPath:
              "ai-grading-benchmarks-private/azure/vi-001.json",
            audioArtifactSha256: "d".repeat(64),
            transcriptSha256: sha256(
              "I would like to describe a teacher who changed how I learn.",
            ),
            configSha256: "4".repeat(64),
            reportSha256: "5".repeat(64),
            provider: "azure" as const,
            model: "pronunciation-assessment" as const,
            apiVersion: "speech-sdk/1.51.0" as const,
            assessmentMode: "unscripted" as const,
          },
          signature: "6".repeat(64),
        },
      },
      artifactSha256: "d".repeat(64),
      modelInputSha256: "6".repeat(64),
      artifactContentType: "audio/wav",
      artifactStorageVersion: "storage-version-2",
      artifactEtag: "etag-audio-001",
      responseLocator: "full recording",
    },
    rubricVersion: "ielts-speaking-rubric-v1",
  },
  metadata: { l1Group: "Vietnamese", audioQualityGroup: "typical_device" },
};

assert.equal(
  parseGradingBenchmarkImport({
    ...validManifest,
    benchmarks: [speakingBenchmark],
  }).benchmarks[0]?.protectedLabel.input.audioObjectPath,
  "ai-grading-benchmarks-private/speaking/vi-001.wav",
);

assert.throws(
  () =>
    parseGradingBenchmarkImport({
      ...validManifest,
      benchmarks: [
        {
          ...speakingBenchmark,
          protectedLabel: {
            ...speakingBenchmark.protectedLabel,
            input: {
              ...speakingBenchmark.protectedLabel.input,
              audioPreprocessing: {
                ...speakingBenchmark.protectedLabel.input.audioPreprocessing,
                acousticAttestation: {
                  ...speakingBenchmark.protectedLabel.input.audioPreprocessing
                    .acousticAttestation,
                  envelope: {
                    ...speakingBenchmark.protectedLabel.input.audioPreprocessing
                      .acousticAttestation.envelope,
                    reportSha256: "f".repeat(64),
                  },
                },
              },
            },
          },
        },
      ],
    }),
  /Acoustic attestation must bind/,
);

const reusedReportSpeaking = structuredClone(speakingBenchmark);
reusedReportSpeaking.benchmarkKey = "official-speaking-part2-holdout-002";
reusedReportSpeaking.protectedLabel.input.scoringResponseText =
  "A distinct second protected speaking response.";
reusedReportSpeaking.protectedLabel.input.audioObjectPath =
  "ai-grading-benchmarks-private/speaking/vi-002.wav";
reusedReportSpeaking.protectedLabel.input.artifactSha256 = "7".repeat(64);
reusedReportSpeaking.protectedLabel.input.responseLocator =
  "second full recording";
reusedReportSpeaking.protectedLabel.input.audioPreprocessing.audioArtifactSha256 =
  "7".repeat(64);
reusedReportSpeaking.protectedLabel.input.audioPreprocessing.stt.transcriptSha256 =
  sha256("A distinct second protected speaking response.");
const reusedEnvelope =
  reusedReportSpeaking.protectedLabel.input.audioPreprocessing
    .acousticAttestation.envelope;
reusedEnvelope.benchmarkKey = reusedReportSpeaking.benchmarkKey;
reusedEnvelope.captureId = "00000000-0000-4000-8000-000000000100";
reusedEnvelope.audioObjectPath =
  reusedReportSpeaking.protectedLabel.input.audioObjectPath;
reusedEnvelope.audioArtifactSha256 = "7".repeat(64);
reusedEnvelope.transcriptSha256 =
  reusedReportSpeaking.protectedLabel.input.audioPreprocessing.stt.transcriptSha256;
assert.throws(
  () =>
    parseGradingBenchmarkImport({
      ...validManifest,
      benchmarks: [speakingBenchmark, reusedReportSpeaking],
    }),
  /Duplicate benchmark artifact locator\/content/,
);

assert.throws(
  () =>
    parseGradingBenchmarkImport({
      ...validManifest,
      benchmarks: [
        {
          ...speakingBenchmark,
          protectedLabel: {
            ...speakingBenchmark.protectedLabel,
            input: {
              ...speakingBenchmark.protectedLabel.input,
              audioPreprocessing: {
                ...speakingBenchmark.protectedLabel.input.audioPreprocessing,
                pronunciation: {
                  ...speakingBenchmark.protectedLabel.input.audioPreprocessing
                    .pronunciation,
                  reportObjectPath: "public/azure/vi-001.json",
                },
              },
            },
          },
        },
      ],
    }),
  /must be stored in ai-grading-benchmarks-private/,
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
const storedSpeakingBenchmark = {
  benchmarkKey: speakingBenchmark.benchmarkKey,
  skill: speakingBenchmark.skill,
  taskType: speakingBenchmark.taskType,
  accentGroup: speakingBenchmark.accentGroup,
  protectedLabel: speakingBenchmark.protectedLabel,
  metadata: speakingBenchmark.metadata,
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
assert.equal(
  countInvalidStoredBenchmarkRows([
    storedSpeakingBenchmark,
    {
      ...storedSpeakingBenchmark,
      benchmarkKey: reusedReportSpeaking.benchmarkKey,
      protectedLabel: reusedReportSpeaking.protectedLabel,
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
assert.match(importer, /reportObjectPath/);
assert.match(importer, /reportStorageVersion/);
assert.match(importer, /reportEtag/);
assert.match(importer, /reportSha256/);
assert.match(importer, /audioReportBytes/);
assert.match(importer, /ieltsBenchmarkModelInputSha256/);
assert.match(importer, /.from\("buckets"\)/);
assert.match(importer, /data\.public !== false/);
assert.match(importer, /AI_GRADING_BENCHMARK_PRIVATE_BUCKET/);
assert.match(
  importer,
  /verify_ai_grading_benchmark_acoustic_attestation/,
);
assert.doesNotMatch(importer, /AI_GRADING_BENCHMARK_ATTESTATION_SECRET/);
assert.doesNotMatch(importer, /createHmac|subtle\.sign|extensions\.hmac/);
assert.match(
  importer,
  /must be registered and independently approved before label import/,
);
assert.doesNotMatch(importer, /\.from\("ai_knowledge_sources"\)\s*\.insert/);

const releaseGate = readFileSync(
  resolve(process.cwd(), "src/scripts/ai-grading-release-gate.ts"),
  "utf8",
);
assert.match(releaseGate, /reportObjectPath/);
assert.match(releaseGate, /reportStorageVersion/);
assert.match(releaseGate, /reportEtag/);
assert.match(releaseGate, /reportSha256/);
assert.match(releaseGate, /\.download\(reportName\)/);
assert.match(releaseGate, /assertIeltsBenchmarkModelInputHash/);
assert.match(releaseGate, /audioReportBytes/);
assert.match(releaseGate, /\.from\("buckets"\)/);
assert.match(releaseGate, /data\.public !== false/);
assert.match(releaseGate, /AI_GRADING_BENCHMARK_PRIVATE_BUCKET/);
assert.match(
  releaseGate,
  /verify_ai_grading_benchmark_acoustic_attestation/,
);
assert.ok(
  releaseGate.indexOf("verifyStoredModelInputs({ rows") <
    releaseGate.indexOf("const coverage = validateIeltsBenchmarkCoverage"),
  "release must verify protected model inputs before counting benchmark coverage",
);

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
