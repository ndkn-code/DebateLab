import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";

import {
  createAcousticAssessmentReceipt,
  prepareAcousticBenchmarkEvidence,
} from "./acoustic-preprocessor";

function pcmWav(samples = 16_000): Uint8Array {
  const dataBytes = samples * 2;
  const bytes = new Uint8Array(44 + dataBytes);
  const view = new DataView(bytes.buffer);
  const text = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index));
    }
  };
  text(0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 16_000, true);
  view.setUint32(28, 32_000, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, dataBytes, true);
  return bytes;
}

function normalizedAzureReport(overrides: Record<string, unknown> = {}) {
  return new TextEncoder().encode(
    JSON.stringify({
      schemaVersion: 1,
      status: "scored",
      provider: "azure",
      model: "pronunciation-assessment",
      locale: "en-US",
      referenceText: "",
      recognizedText: "This is the reviewed transcript.",
      overall: {
        pronunciation: 81,
        accuracy: 83,
        fluency: 79,
        completeness: null,
        prosody: 77,
      },
      words: [
        {
          word: "reviewed",
          accuracy: 55,
          errorType: "Mispronunciation",
          phonemes: [],
        },
      ],
      ...overrides,
    }),
  );
}

function sha256(value: Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function validInput() {
  const input = {
    benchmarkKey: "speaking-vietnamese-band7-001",
    captureId: "2a32aa7f-9ad2-4b5c-af54-b9c2c7546605",
    locale: "en-US",
    audioBytes: pcmWav(),
    audioObjectPath:
      "ai-grading-benchmarks-private/audio/speaking-vietnamese-band7-001.wav",
    audioStorageVersion: "audio-version-1",
    audioEtag: "audio-etag-1",
    transcript: "This is the reviewed transcript.",
    sttProvider: "deepgram",
    sttModel: "nova-3",
    transcriptReview: {
      reviewVersion: 1 as const,
      reviewerKey: "reviewer-pseudonym-01",
      reviewedAt: "2026-09-01T12:00:00.000Z",
      status: "verified_against_audio" as const,
      transcriptVersion: 1,
    },
    reportBytes: normalizedAzureReport(),
    reportObjectPath:
      "ai-grading-benchmarks-private/azure/speaking-vietnamese-band7-001.json",
    reportStorageVersion: "report-version-1",
    reportEtag: "report-etag-1",
    attestationSecret: "local-test-attestation-secret",
  };
  return {
    ...input,
    assessmentReceiptBytes: new TextEncoder().encode(
      JSON.stringify(
        createAcousticAssessmentReceipt({
          benchmarkKey: input.benchmarkKey,
          captureId: input.captureId,
          locale: input.locale,
          audioBytes: input.audioBytes,
          reportBytes: input.reportBytes,
          attestationSecret: input.attestationSecret,
        }),
      ),
    ),
  };
}

test("trusted preprocessing binds exact audio, transcript review, report and storage identity", () => {
  const result = prepareAcousticBenchmarkEvidence(validInput());
  assert.equal(result.scoringContext.durationSeconds, 1);
  assert.equal(result.scoringContext.pronunciation.pronunciationScore, 81);
  assert.deepEqual(result.scoringContext.pronunciation.mispronouncedWords, [
    "reviewed",
  ]);
  assert.equal(
    result.audioPreprocessing.acousticAttestation.envelope
      .transcriptReviewSha256.length,
    64,
  );
  assert.equal(
    result.audioPreprocessing.acousticAttestation.envelope.audioStorageVersion,
    "audio-version-1",
  );
  assert.equal(
    result.audioPreprocessing.acousticAttestation.envelope.reportEtag,
    "report-etag-1",
  );
  assert.equal(
    result.audioPreprocessing.acousticAttestation.signature.length,
    64,
  );
});

test("trusted preprocessing rejects invalid audio, scripted reports and unreviewed transcripts", () => {
  assert.throws(
    () =>
      prepareAcousticBenchmarkEvidence({
        ...validInput(),
        audioBytes: new Uint8Array([1, 2, 3]),
      }),
    /WAV_TOO_SHORT/,
  );
  assert.throws(
    () =>
      prepareAcousticBenchmarkEvidence({
        ...validInput(),
        reportBytes: normalizedAzureReport({
          referenceText: "Read this scripted sentence.",
        }),
      }),
    /report identity is invalid/,
  );
  assert.throws(
    () =>
      prepareAcousticBenchmarkEvidence({
        ...validInput(),
        transcriptReview: {
          ...validInput().transcriptReview,
          reviewerKey: " ",
        },
      }),
    /reviewer key is required/i,
  );
});

test("changing any protected identity changes the signed attestation", () => {
  const original = prepareAcousticBenchmarkEvidence(validInput());
  const changed = prepareAcousticBenchmarkEvidence({
    ...validInput(),
    reportStorageVersion: "report-version-2",
  });
  assert.notEqual(
    original.audioPreprocessing.acousticAttestation.signature,
    changed.audioPreprocessing.acousticAttestation.signature,
  );
});

test("attestation rejects a valid Azure report assessed from different audio", () => {
  const original = validInput();
  const differentAudio = pcmWav(8_000);
  assert.throws(
    () =>
      prepareAcousticBenchmarkEvidence({
        ...original,
        audioBytes: differentAudio,
      }),
    /does not match the exact audio and report/,
  );
});

test("attestation rejects report substitution and forged assessment receipts", () => {
  const original = validInput();
  const changedReport = normalizedAzureReport({ recognizedText: "substituted" });
  assert.throws(
    () =>
      prepareAcousticBenchmarkEvidence({
        ...original,
        reportBytes: changedReport,
      }),
    /does not match the exact audio and report/,
  );

  const differentAudio = pcmWav(8_000);
  const receipt = JSON.parse(
    new TextDecoder().decode(original.assessmentReceiptBytes),
  ) as { envelope: { audioArtifactSha256: string }; signature: string };
  // An attacker can make the unsigned fields look consistent with audio B,
  // but cannot produce the HMAC created while Azure assessed audio A.
  receipt.envelope.audioArtifactSha256 = sha256(differentAudio);
  assert.throws(
    () =>
      prepareAcousticBenchmarkEvidence({
        ...original,
        audioBytes: differentAudio,
        assessmentReceiptBytes: new TextEncoder().encode(
          JSON.stringify(receipt),
        ),
      }),
    /receipt signature is invalid/,
  );
});
