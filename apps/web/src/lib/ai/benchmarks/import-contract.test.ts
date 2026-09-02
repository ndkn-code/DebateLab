import assert from "node:assert/strict";
import {
  createHash,
  generateKeyPairSync,
  sign as signPayload,
} from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  benchmarkTranscriptReviewSha256,
  benchmarkReleaseAttestationPayload,
  countInvalidStoredBenchmarkRows,
  isReleaseEligibleStoredBenchmark,
  parseOperationalSafetyEvidence,
  countDuplicatePaidScoringAttempts,
  parseGradingBenchmarkImport,
  verifyBenchmarkReleaseAttestation,
} from "./contracts";

const sha256 = (value: string) =>
  createHash("sha256").update(value, "utf8").digest("hex");

const source = {
  canonicalUrl: "https://example.org/official-ielts-holdout.pdf",
  publisher: "Official test publisher",
  title: "Reviewed examiner-scored holdout",
  authorityTier: "official" as const,
  rightsStatus: "approved_for_benchmark_evaluation" as const,
  checksum: "a".repeat(64),
  reviewedBy: "rights-reviewer@example.org",
  reviewedAt: "2026-08-31T12:00:00.000Z",
  reviewNotes: "Approved for protected offline evaluation only.",
};

const consent = {
  receiptKey: "consent-00000001",
  receiptSha256: "1".repeat(64),
  consentVersion: "benchmark-consent-v1",
  consentedAt: "2026-08-01T10:00:00.000Z",
  participantAgeGroup: "adult" as const,
  scopes: {
    commercialAiEvaluation: true as const,
    humanExaminerReview: true as const,
    modelTraining: false,
    futureVersionedReevaluation: true,
    voiceProcessing: false,
  },
  guardianConsentReceiptSha256: null,
  learnerAssentReceiptSha256: null,
  retentionUntil: "2028-08-01T10:00:00.000Z",
  withdrawal: {
    status: "not_withdrawn" as const,
    checkedAt: "2026-08-31T10:00:00.000Z",
    registryReceiptSha256: "2".repeat(64),
  },
};

function examinerMark(params: {
  raterKey: string;
  criteria: Record<string, number>;
  overallBand: number;
  rubricVersion: string;
}) {
  return {
    raterKey: params.raterKey,
    authority: "official_examiner" as const,
    credential: {
      proofSha256: sha256(`credential:${params.raterKey}`),
      verifiedAt: "2026-07-01T10:00:00.000Z",
      verifiedByKey: "credential-reviewer-01",
    },
    rubricVersion: params.rubricVersion,
    markedAt: "2026-08-20T10:00:00.000Z",
    blindIndependentMark: true as const,
    criteria: params.criteria,
    overallBand: params.overallBand,
    markLocator: `mark-sheet-${params.raterKey}`,
  };
}

const writingCriteria = {
  taskResponse: 6.5,
  coherenceCohesion: 6,
  lexicalResource: 6.5,
  grammaticalRangeAccuracy: 6,
};

const writingProvenance = {
  independentlyMarked: true as const,
  raterRecords: [
    examinerMark({
      raterKey: "examiner-writing-01",
      criteria: writingCriteria,
      overallBand: 6.5,
      rubricVersion: "ielts-writing-rubric-v1",
    }),
    examinerMark({
      raterKey: "examiner-writing-02",
      criteria: writingCriteria,
      overallBand: 6.5,
      rubricVersion: "ielts-writing-rubric-v1",
    }),
  ],
  declaredBoundaryCrossing: false,
  adjudication: null,
};

function releaseAttestationFor(params: {
  benchmarkKey: string;
  artifactSha256: string;
  consent: {
    receiptSha256: string;
    retentionUntil: string;
    withdrawal: { registryReceiptSha256: string; checkedAt: string };
  };
  provenance: {
    raterRecords: Array<{ credential: { proofSha256: string } }>;
  };
  metadata: {
    candidateKey: string;
    promptFamilyKey: string;
    sourceGroupKey: string;
    captureSessionKey: string;
  };
}) {
  return {
    keyId: "study-lead-signing-01",
    envelope: {
      envelopeVersion: 1 as const,
      benchmarkKey: params.benchmarkKey,
      artifactSha256: params.artifactSha256,
      consentReceiptSha256: params.consent.receiptSha256,
      consentRetentionUntil: params.consent.retentionUntil,
      withdrawalRegistryReceiptSha256:
        params.consent.withdrawal.registryReceiptSha256,
      withdrawalCheckedAt: params.consent.withdrawal.checkedAt,
      grouping: {
        candidateKey: params.metadata.candidateKey,
        promptFamilyKey: params.metadata.promptFamilyKey,
        sourceGroupKey: params.metadata.sourceGroupKey,
        captureSessionKey: params.metadata.captureSessionKey,
      },
      groupingReceipts: {
        candidateReceiptSha256: "8".repeat(64),
        promptFamilyReceiptSha256: "9".repeat(64),
        sourceGroupReceiptSha256: "a".repeat(64),
        captureSessionReceiptSha256: "b".repeat(64),
      },
      captureIdentityReceiptSha256: "c".repeat(64),
      examinerCredentialProofsSha256:
        params.provenance.raterRecords.map((rater) =>
          rater.credential.proofSha256,
        ),
      verifiedAt: "2026-08-31T10:30:00.000Z",
      expiresAt: "2026-09-01T09:59:00.000Z",
    },
    signatureBase64: `${"A".repeat(86)}==`,
  };
}

function refreshReleaseAttestation(benchmark: any) {
  benchmark.releaseAttestation = releaseAttestationFor({
    benchmarkKey: benchmark.benchmarkKey,
    artifactSha256: benchmark.protectedLabel.input.artifactSha256,
    consent: benchmark.protectedLabel.consent,
    provenance: benchmark.protectedLabel.provenance,
    metadata: benchmark.metadata,
  });
}

const writingMetadata = {
  candidateKey: "candidate-writing-0001",
  promptFamilyKey: "prompt-family-task2-0001",
  sourceGroupKey: "source-group-study-0001",
  captureSessionKey: "capture-writing-0001",
  studyDesignId: "debatelab-ielts-examiner-study" as const,
  studyDesignVersion: 2 as const,
  protectedOfflineEvaluationOnly: true,
};

const writingBenchmark = {
  benchmarkKey: "official-writing-task2-holdout-001",
  collectionSlug: "ielts.writing" as const,
  sourceUrl: source.canonicalUrl,
  skill: "ielts_writing" as const,
  taskType: "writing_task2_essay",
  bandOrScoreRange: "6.5",
  accentGroup: null,
  split: "holdout" as const,
  protectedLabel: {
    criteria: {
      taskResponse: { band: 6.5, labelLocator: "page 3" },
      coherenceCohesion: { band: 6, labelLocator: "page 3" },
      lexicalResource: { band: 6.5, labelLocator: "page 3" },
      grammaticalRangeAccuracy: { band: 6, labelLocator: "page 3" },
    },
    overallBand: 6.5,
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
    provenance: writingProvenance,
    consent,
  },
  releaseAttestation: releaseAttestationFor({
    benchmarkKey: "official-writing-task2-holdout-001",
    artifactSha256: "e".repeat(64),
    consent,
    provenance: writingProvenance,
    metadata: writingMetadata,
  }),
  metadata: writingMetadata,
};

const validManifest = {
  manifestVersion: 1 as const,
  studyDesign: {
    id: "debatelab-ielts-examiner-study" as const,
    version: 2 as const,
  },
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
      studyDesign: { ...validManifest.studyDesign, version: 1 },
      benchmarks: validManifest.benchmarks.map((benchmark) => ({
        ...benchmark,
        metadata: { ...benchmark.metadata, studyDesignVersion: 1 },
      })),
    }),
  /Invalid literal value|Invalid input/,
  "new imports must use the current V2 study design",
);

const duplicateWritingArtifact: any = structuredClone(writingBenchmark);
duplicateWritingArtifact.benchmarkKey =
  "official-writing-task2-holdout-duplicate-artifact";
refreshReleaseAttestation(duplicateWritingArtifact);

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
  /Examiner mark criteria must match|Incomplete or unknown criterion labels/,
);

assert.throws(
  () =>
    parseGradingBenchmarkImport({
      ...validManifest,
      sources: [{ ...source, rightsStatus: "requires_review" }],
    }),
  /Invalid enum value|Invalid option/,
);

const crossSourceSplitBenchmark: any = structuredClone(writingBenchmark);
crossSourceSplitBenchmark.benchmarkKey =
  "official-writing-task2-development-001";
crossSourceSplitBenchmark.split = "development";
crossSourceSplitBenchmark.protectedLabel.input.responseText =
  "A different protected development response.";
crossSourceSplitBenchmark.protectedLabel.input.responseLocator =
  "examiner packet page 4";
crossSourceSplitBenchmark.protectedLabel.input.artifactSha256 = "9".repeat(64);
refreshReleaseAttestation(crossSourceSplitBenchmark);

assert.throws(
  () =>
    parseGradingBenchmarkImport({
      ...validManifest,
      benchmarks: [writingBenchmark, crossSourceSplitBenchmark],
    }),
  /sourceUrl leakage across benchmark splits/,
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
  releaseAttestation: releaseAttestationFor({
    benchmarkKey: "qualified-writing-scan-holdout-001",
    artifactSha256: "b".repeat(64),
    consent,
    provenance: writingProvenance,
    metadata: writingMetadata,
  }),
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

const duplicateScannedBenchmark: any = structuredClone(
  scannedWritingBenchmark,
);
duplicateScannedBenchmark.benchmarkKey =
  "qualified-writing-scan-holdout-002";
duplicateScannedBenchmark.protectedLabel.input.responseObjectPath =
  "ai-grading-benchmarks-private/writing/scan-copy.pdf";
duplicateScannedBenchmark.protectedLabel.input.responseLocator = "PDF page 2";
duplicateScannedBenchmark.protectedLabel.input.artifactSha256 = "B".repeat(64);
duplicateScannedBenchmark.protectedLabel.input.artifactStorageVersion =
  "storage-version-copy";
duplicateScannedBenchmark.protectedLabel.input.artifactEtag = "etag-scan-copy";
refreshReleaseAttestation(duplicateScannedBenchmark);

assert.throws(
  () =>
    parseGradingBenchmarkImport({
      ...validManifest,
      benchmarks: [scannedWritingBenchmark, duplicateScannedBenchmark],
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
              raterRecords: [
                writingBenchmark.protectedLabel.provenance.raterRecords[0],
                writingBenchmark.protectedLabel.provenance.raterRecords[0],
              ],
            },
          },
        },
      ],
    }),
  /rater keys must be distinct/,
);

const disputedWriting = structuredClone(writingBenchmark);
disputedWriting.protectedLabel.provenance.raterRecords[1]!.criteria = {
  ...disputedWriting.protectedLabel.provenance.raterRecords[1]!.criteria,
  taskResponse: 7.5,
};
assert.throws(
  () =>
    parseGradingBenchmarkImport({
      ...validManifest,
      benchmarks: [disputedWriting],
    }),
  /requires adjudication/,
);

const unnecessaryAdjudication: any = structuredClone(writingBenchmark);
unnecessaryAdjudication.protectedLabel.provenance.adjudication = {
  adjudicatorKey: "examiner-adjudicator-01",
  authority: "official_examiner",
  credential: {
    proofSha256: sha256("credential:examiner-adjudicator-01"),
    verifiedAt: "2026-07-01T10:00:00.000Z",
    verifiedByKey: "credential-reviewer-01",
  },
  rubricVersion: "ielts-writing-rubric-v1",
  adjudicatedAt: "2026-08-21T10:00:00.000Z",
  method: "third_examiner",
  triggerReasons: ["declared_boundary_crossing"],
  criteria: writingCriteria,
  overallBand: 6.5,
  rationale: "No trigger exists, so this record must be rejected.",
  adjudicationLocator: "adjudication-sheet-01",
};
assert.throws(
  () =>
    parseGradingBenchmarkImport({
      ...validManifest,
      benchmarks: [unnecessaryAdjudication],
    }),
  /must be absent when no adjudication trigger exists/,
);

const adjudicationWithExtraReason: any = structuredClone(disputedWriting);
adjudicationWithExtraReason.protectedLabel.provenance.adjudication = {
  ...unnecessaryAdjudication.protectedLabel.provenance.adjudication,
  triggerReasons: [
    "criterion_disagreement_over_half",
    "overall_disagreement_over_half",
  ],
};
assert.throws(
  () =>
    parseGradingBenchmarkImport({
      ...validManifest,
      benchmarks: [adjudicationWithExtraReason],
    }),
  /trigger reasons must exactly match/,
);

const expiredRetention: any = structuredClone(writingBenchmark);
expiredRetention.protectedLabel.consent.retentionUntil =
  "2026-08-31T11:00:00.000Z";
refreshReleaseAttestation(expiredRetention);
expiredRetention.releaseAttestation.envelope.expiresAt =
  "2026-08-31T10:45:00.000Z";
assert.throws(
  () =>
    parseGradingBenchmarkImport({
      ...validManifest,
      benchmarks: [expiredRetention],
    }),
  /Consent retention expires before import/,
);

const staleWithdrawalSnapshot: any = structuredClone(writingBenchmark);
staleWithdrawalSnapshot.protectedLabel.consent.withdrawal.checkedAt =
  "2026-08-20T10:00:00.000Z";
refreshReleaseAttestation(staleWithdrawalSnapshot);
assert.throws(
  () =>
    parseGradingBenchmarkImport({
      ...validManifest,
      benchmarks: [staleWithdrawalSnapshot],
    }),
  /Withdrawal registry snapshot is older than 24 hours|Withdrawal registry check is not fresh/,
);

const { privateKey: studyLeadPrivateKey, publicKey: studyLeadPublicKey } =
  generateKeyPairSync("ed25519");
const signedAttestation = structuredClone(writingBenchmark.releaseAttestation);
signedAttestation.signatureBase64 = signPayload(
  null,
  benchmarkReleaseAttestationPayload(signedAttestation.envelope),
  studyLeadPrivateKey,
).toString("base64");
assert.equal(
  verifyBenchmarkReleaseAttestation({
    attestation: signedAttestation,
    publicKeyPem: studyLeadPublicKey.export({
      type: "spki",
      format: "pem",
    }) as string,
    now: new Date("2026-09-01T09:00:00.000Z"),
  }).envelope.benchmarkKey,
  writingBenchmark.benchmarkKey,
);
signedAttestation.envelope.grouping.candidateKey = "candidate-relabelled-01";
assert.throws(
  () =>
    verifyBenchmarkReleaseAttestation({
      attestation: signedAttestation,
      publicKeyPem: studyLeadPublicKey.export({
        type: "spki",
        format: "pem",
      }) as string,
      now: new Date("2026-09-01T09:00:00.000Z"),
    }),
  /signature is invalid/,
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
              ...writingBenchmark.protectedLabel.criteria,
              taskResponse: { band: 7, labelLocator: "wrong-final" },
            },
          },
        },
      ],
    }),
  /differs from the independent-mark mean/,
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
            consent: {
              ...writingBenchmark.protectedLabel.consent,
              participantAgeGroup: "minor",
            },
          },
        },
      ],
    }),
  /Minor participants require guardian consent and learner assent/,
);

const overRetainedMinor: any = structuredClone(writingBenchmark);
overRetainedMinor.protectedLabel.consent = {
  ...overRetainedMinor.protectedLabel.consent,
  participantAgeGroup: "minor",
  guardianConsentReceiptSha256: "7".repeat(64),
  learnerAssentReceiptSha256: "8".repeat(64),
};
refreshReleaseAttestation(overRetainedMinor);
assert.throws(
  () =>
    parseGradingBenchmarkImport({
      ...validManifest,
      benchmarks: [overRetainedMinor],
    }),
  /Minor participant retention cannot exceed one year/,
);

const mismatchedWithdrawalReceipt = structuredClone(writingBenchmark);
mismatchedWithdrawalReceipt.releaseAttestation.envelope.withdrawalRegistryReceiptSha256 =
  "f".repeat(64);
assert.throws(
  () =>
    parseGradingBenchmarkImport({
      ...validManifest,
      benchmarks: [mismatchedWithdrawalReceipt],
    }),
  /does not bind the benchmark artifact, consent, credentials, and grouping identity/,
);

const secondSource = {
  ...source,
  canonicalUrl: "https://example.org/independent-study-source-2",
  checksum: "9".repeat(64),
};
for (const groupKey of [
  "candidateKey",
  "promptFamilyKey",
  "sourceGroupKey",
  "captureSessionKey",
] as const) {
  const crossSplit: any = structuredClone(writingBenchmark);
  crossSplit.benchmarkKey = `cross-split-${groupKey}`;
  crossSplit.sourceUrl = secondSource.canonicalUrl;
  crossSplit.split = "development";
  crossSplit.protectedLabel.input.responseText = `Distinct ${groupKey} response`;
  crossSplit.protectedLabel.input.artifactSha256 = sha256(
    crossSplit.protectedLabel.input.responseText,
  );
  crossSplit.protectedLabel.input.responseLocator = `locator-${groupKey}`;
  crossSplit.metadata = {
    ...crossSplit.metadata,
    candidateKey: "candidate-cross-split-02",
    promptFamilyKey: "prompt-family-cross-split-02",
    sourceGroupKey: "source-group-cross-split-02",
    captureSessionKey: "capture-cross-split-02",
    [groupKey]: writingBenchmark.metadata[groupKey],
  };
  refreshReleaseAttestation(crossSplit);
  assert.throws(
    () =>
      parseGradingBenchmarkImport({
        ...validManifest,
        sources: [source, secondSource],
        benchmarks: [writingBenchmark, crossSplit],
      }),
    new RegExp(`${groupKey} leakage across benchmark splits`),
  );
}

const speakingCriteria = {
  fluencyCoherence: 6.5,
  lexicalResource: 6.5,
  grammaticalRangeAccuracy: 6,
  pronunciation: 6,
};
const speakingProvenance = {
  independentlyMarked: true as const,
  raterRecords: [
    examinerMark({
      raterKey: "examiner-speaking-01",
      criteria: speakingCriteria,
      overallBand: 6.5,
      rubricVersion: "ielts-speaking-rubric-v1",
    }),
    examinerMark({
      raterKey: "examiner-speaking-02",
      criteria: speakingCriteria,
      overallBand: 6.5,
      rubricVersion: "ielts-speaking-rubric-v1",
    }),
  ],
  declaredBoundaryCrossing: false,
  adjudication: null,
};
const speakingConsent = {
  ...consent,
  receiptKey: "consent-00000002",
  scopes: { ...consent.scopes, voiceProcessing: true },
};
const transcriptReview = {
  reviewVersion: 1 as const,
  reviewerKey: "transcript-reviewer-01",
  reviewedAt: "2026-08-25T10:00:00.000Z",
  status: "verified_against_audio" as const,
  transcriptVersion: 1,
  transcriptSha256: sha256(
    "I would like to describe a teacher who changed how I learn.",
  ),
};

const speakingMetadata = {
  candidateKey: "candidate-speaking-0001",
  promptFamilyKey: "prompt-family-speaking-0001",
  sourceGroupKey: "source-group-study-0001",
  captureSessionKey: "capture-speaking-0001",
  studyDesignId: "debatelab-ielts-examiner-study" as const,
  studyDesignVersion: 2 as const,
  l1Group: "vi",
  audioQualityGroup: "typical_device" as const,
};

const speakingBenchmark = {
  ...writingBenchmark,
  benchmarkKey: "official-speaking-part2-holdout-001",
  collectionSlug: "ielts.speaking" as const,
  skill: "ielts_speaking" as const,
  taskType: "speaking_part2_cuecard",
  accentGroup: "vi_north",
  protectedLabel: {
    ...writingBenchmark.protectedLabel,
    criteria: {
      fluencyCoherence: { band: 6.5, labelLocator: "mark sheet" },
      lexicalResource: { band: 6.5, labelLocator: "mark sheet" },
      grammaticalRangeAccuracy: { band: 6, labelLocator: "mark sheet" },
      pronunciation: { band: 6, labelLocator: "mark sheet" },
    },
    overallBand: 6.5,
    provenance: speakingProvenance,
    consent: speakingConsent,
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
        transcriptReview,
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
            transcriptReviewSha256:
              benchmarkTranscriptReviewSha256(transcriptReview),
            configSha256: "4".repeat(64),
            reportSha256: "5".repeat(64),
            audioStorageVersion: "storage-version-2",
            audioEtag: "etag-audio-001",
            reportStorageVersion: "report-storage-v1",
            reportEtag: "report-etag-v1",
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
  releaseAttestation: releaseAttestationFor({
    benchmarkKey: "official-speaking-part2-holdout-001",
    artifactSha256: "d".repeat(64),
    consent: speakingConsent,
    provenance: speakingProvenance,
    metadata: speakingMetadata,
  }),
  metadata: speakingMetadata,
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
                transcriptReview: {
                  ...speakingBenchmark.protectedLabel.input.audioPreprocessing
                    .transcriptReview,
                  reviewerKey: "transcript-reviewer-tampered",
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
reusedReportSpeaking.protectedLabel.input.artifactStorageVersion =
  "storage-version-3";
reusedReportSpeaking.protectedLabel.input.artifactEtag = "etag-audio-002";
reusedReportSpeaking.protectedLabel.input.responseLocator =
  "second full recording";
reusedReportSpeaking.protectedLabel.input.audioPreprocessing.audioArtifactSha256 =
  "7".repeat(64);
reusedReportSpeaking.protectedLabel.input.audioPreprocessing.stt.transcriptSha256 =
  sha256("A distinct second protected speaking response.");
reusedReportSpeaking.protectedLabel.input.audioPreprocessing.transcriptReview = {
  ...reusedReportSpeaking.protectedLabel.input.audioPreprocessing.transcriptReview,
  transcriptSha256:
    reusedReportSpeaking.protectedLabel.input.audioPreprocessing.stt
      .transcriptSha256,
};
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
reusedEnvelope.transcriptReviewSha256 = benchmarkTranscriptReviewSha256(
  reusedReportSpeaking.protectedLabel.input.audioPreprocessing.transcriptReview,
);
reusedEnvelope.audioStorageVersion = "storage-version-3";
reusedEnvelope.audioEtag = "etag-audio-002";
refreshReleaseAttestation(reusedReportSpeaking);
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
          metadata: {
            ...speakingBenchmark.metadata,
            audioQualityGroup: undefined,
          },
        },
      ],
    }),
  /requires accent, L1, and audio-quality groups/,
);

assert.throws(
  () =>
    parseGradingBenchmarkImport({
      ...validManifest,
      benchmarks: [writingBenchmark, duplicateWritingArtifact],
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
  releaseAttestation: writingBenchmark.releaseAttestation,
  metadata: writingBenchmark.metadata,
  source: storedSource,
};
const storedSpeakingBenchmark = {
  benchmarkKey: speakingBenchmark.benchmarkKey,
  skill: speakingBenchmark.skill,
  taskType: speakingBenchmark.taskType,
  accentGroup: speakingBenchmark.accentGroup,
  protectedLabel: speakingBenchmark.protectedLabel,
  releaseAttestation: speakingBenchmark.releaseAttestation,
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
assert.match(importer, /immutableBenchmarkMetadata\(existing\.metadata\)/);
assert.match(importer, /immutableBenchmarkMetadata\(row\.metadata\)/);
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
assert.match(importer, /ai_grading_benchmark_release_attestations/);
assert.match(importer, /immutableBenchmarkMetadata/);
assert.match(importer, /delete metadata\.manifestCreatedAt/);
assert.match(importer, /AI_GRADING_BENCHMARK_TRUST_SET_FILE/);
assert.match(importer, /verifyStudyLeadManifest/);
assert.ok(
  importer.indexOf("verifyStudyLeadManifest({") <
    importer.indexOf("const client = createAdminClient()"),
  "study-lead signatures must be verified before any database access",
);
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

const studyMigration = readFileSync(
  resolve(
    process.cwd(),
    "../../supabase/migrations/20260901190000_ielts_benchmark_study_integrity.sql",
  ),
  "utf8",
);
assert.match(studyMigration, /approved_for_benchmark_evaluation/);
assert.match(
  studyMigration,
  /candidateKey[\s\S]*promptFamilyKey[\s\S]*sourceGroupKey/,
);
assert.match(studyMigration, /captureSessionKey/);
assert.match(studyMigration, /Protected benchmark labels and study identity are immutable/);
assert.match(studyMigration, /Benchmark deactivation requires a withdrawal audit/);
assert.match(studyMigration, /withdraw_ai_grading_benchmark/);
assert.match(studyMigration, /ai_grading_verified_withdrawal_receipts/);
assert.match(studyMigration, /p_verified_receipt_id uuid/);
assert.doesNotMatch(studyMigration, /p_withdrawn_by uuid/);
assert.match(studyMigration, /pg_advisory_xact_lock/);
assert.match(studyMigration, /ai-benchmark-source:/);
assert.match(studyMigration, /ai-benchmark-group:/);
assert.match(
  studyMigration,
  /ai_grading_benchmark_release_attestations_deny_browser/,
);
assert.match(
  studyMigration,
  /revoke all on public\.ai_grading_benchmark_withdrawals\s+from public, anon, authenticated, service_role/,
);

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
assert.match(releaseGate, /verifyStudyLeadReleaseAttestations/);
assert.match(releaseGate, /AI_GRADING_BENCHMARK_TRUST_SET_JSON/);
assert.match(releaseGate, /verifyStudyLeadBenchmarkAttestation/);
assert.match(releaseGate, /allowUpdatedWithdrawal: true/);
assert.match(
  releaseGate,
  /verify_ai_grading_benchmark_acoustic_attestation/,
);
assert.ok(
  releaseGate.indexOf("verifyStudyLeadReleaseAttestations({") <
    releaseGate.indexOf("const coverage = validateIeltsBenchmarkCoverage"),
  "release must verify study-lead provenance before counting benchmark coverage",
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
  providerAttemptCountAtOutput:
    scenario === "provider_timeout" || scenario === "retry_exhaustion"
      ? null
      : 1,
  providerAttemptCountAtProvisional: null,
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
const provisionalOperationalEvidence = {
  runId: "preview-fault-injection-1",
  graderVersion: "provisional-v1" as const,
  corpusVersion: 1,
  environment: "preview" as const,
  deploymentId: "preview-deployment-1",
  imageDigest: `sha256:${"1".repeat(64)}`,
  startedAt: "2026-09-01T10:00:00.000Z",
  verifiedAt: "2026-09-01T10:30:00.000Z",
  expiresAt: "2026-09-08T10:30:00.000Z",
  evidenceHash: "a".repeat(64),
  scenarios: operationalScenarios,
};
assert.ok(parseOperationalSafetyEvidence(provisionalOperationalEvidence));
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
        providerAttemptCountAtOutput:
          scenario.scenario === "provider_timeout" ||
          scenario.scenario === "retry_exhaustion"
            ? null
            : calls,
        providerAttemptCountAtProvisional:
          scenario.scenario === "provider_timeout" ||
          scenario.scenario === "retry_exhaustion"
            ? null
            : 1,
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

const safeEarlierRetries = parseOperationalSafetyEvidence({
  runId: "preview-fault-injection-safe-retries",
  graderVersion: "evidence-adjudicated-v1",
  corpusVersion: 1,
  environment: "preview",
  deploymentId: "preview-deployment-1",
  imageDigest: `sha256:${"3".repeat(64)}`,
  startedAt: "2026-09-01T10:00:00.000Z",
  verifiedAt: "2026-09-01T10:30:00.000Z",
  expiresAt: "2026-09-08T10:30:00.000Z",
  evidenceHash: "b".repeat(64),
  scenarios: operationalScenarios.map((scenario) => {
    const failed =
      scenario.scenario === "provider_timeout" ||
      scenario.scenario === "retry_exhaustion";
    const calls =
      scenario.scenario === "retry_exhaustion"
        ? 3
        : scenario.scenario === "provider_timeout"
          ? 1
          : 4;
    return {
      ...scenario,
      expectedProviderCalls:
        scenario.scenario === "retry_exhaustion"
          ? 3
          : scenario.scenario === "provider_timeout"
            ? 1
            : 2,
      observedProviderCalls: calls,
      actualProviderCalls: calls,
      providerAttemptCountAtOutput: failed ? null : calls,
      providerAttemptCountAtProvisional: failed ? null : calls - 1,
    };
  }),
});
assert.ok(safeEarlierRetries);
assert.equal(countDuplicatePaidScoringAttempts(safeEarlierRetries), 0);
assert.equal(
  countDuplicatePaidScoringAttempts({
    ...safeEarlierRetries,
    scenarios: safeEarlierRetries.scenarios.map((scenario, index) =>
      index === 0
        ? {
            ...scenario,
            observedProviderCalls: scenario.observedProviderCalls + 1,
            actualProviderCalls: scenario.actualProviderCalls + 1,
          }
        : scenario,
    ),
  }),
  1,
  "only a provider attempt after the immutable output fence is duplicate spend",
);

assert.equal(
  parseOperationalSafetyEvidence({
    runId: "preview-fault-injection-old-evidence",
    graderVersion: "provisional-v1",
    corpusVersion: 1,
    environment: "preview",
    deploymentId: "preview-deployment-1",
    imageDigest: `sha256:${"4".repeat(64)}`,
    startedAt: "2026-09-01T10:00:00.000Z",
    verifiedAt: "2026-09-01T10:30:00.000Z",
    expiresAt: "2026-09-08T10:30:00.000Z",
    evidenceHash: "c".repeat(64),
    scenarios: operationalScenarios.map(
      ({
        providerAttemptCountAtOutput: _,
        providerAttemptCountAtProvisional: __,
        ...scenario
      }) => scenario,
    ),
  }),
  null,
  "old evidence without an immutable output-attempt fence must fail closed",
);

assert.equal(
  parseOperationalSafetyEvidence({
    runId: "preview-fault-injection-post-output-call",
    graderVersion: "provisional-v1",
    corpusVersion: 1,
    environment: "preview",
    deploymentId: "preview-deployment-1",
    imageDigest: `sha256:${"5".repeat(64)}`,
    startedAt: "2026-09-01T10:00:00.000Z",
    verifiedAt: "2026-09-01T10:30:00.000Z",
    expiresAt: "2026-09-08T10:30:00.000Z",
    evidenceHash: "d".repeat(64),
    scenarios: operationalScenarios.map((scenario, index) =>
      index === 0
        ? {
            ...scenario,
            observedProviderCalls: 2,
            actualProviderCalls: 2,
            providerAttemptCountAtOutput: 1,
          }
        : scenario,
    ),
  }),
  null,
  "a provider call after the validated output fence must fail closed",
);

assert.equal(
  parseOperationalSafetyEvidence({
    ...provisionalOperationalEvidence,
    runId: "preview-fault-injection-timeout-with-output",
    scenarios: operationalScenarios.map((scenario) =>
      scenario.scenario === "provider_timeout"
        ? { ...scenario, providerAttemptCountAtOutput: 1 }
        : scenario,
    ),
  }),
  null,
  "an outcome-unknown timeout cannot claim a validated output",
);

assert.equal(
  parseOperationalSafetyEvidence({
    ...provisionalOperationalEvidence,
    runId: "preview-fault-injection-over-cap",
    scenarios: operationalScenarios.map((scenario) =>
      scenario.scenario === "retry_exhaustion"
        ? {
            ...scenario,
            observedProviderCalls: 4,
            actualProviderCalls: 4,
          }
        : scenario,
    ),
  }),
  null,
  "retry exhaustion remains locked to exactly three attempts",
);

assert.match(releaseGate, /provider_attempt_count_at_output/);
assert.match(releaseGate, /provider_attempt_count_at_provisional/);
assert.match(releaseGate, /countDuplicatePaidScoringAttempts\(safety\)/);
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
