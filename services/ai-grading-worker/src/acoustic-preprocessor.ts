import "server-only";

import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import {
  benchmarkAcousticAttestationEnvelopeSchema,
  type BenchmarkAcousticAttestationEnvelope,
} from "../../../apps/web/src/lib/ai/benchmarks/contracts";
import {
  ieltsBenchmarkAzureConfigSha256,
  ieltsBenchmarkValueSha256,
} from "../../../apps/web/src/lib/ai/benchmarks/request";
import { parsePronunciationWav } from "../../../apps/web/src/lib/ielts/pronunciation/continuous";
import { extractPronunciationSignal } from "../../../apps/web/src/lib/ielts/speaking-scorer/phoneme-contract";
import { signAcousticAttestationForTrustedPreprocessor } from "./acoustic-attestation";

const EMPTY_TEXT_SHA256 =
  "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855" as const;

function sha256(value: string | Uint8Array): string {
  return createHash("sha256")
    .update(typeof value === "string" ? Buffer.from(value, "utf8") : value)
    .digest("hex");
}

function protectedObjectPath(value: string): string {
  if (
    !value.startsWith("ai-grading-benchmarks-private/") ||
    value.includes("//") ||
    value.split("/").some((part) => part === "." || part === "..")
  ) {
    throw new Error("Acoustic object must use the private benchmark bucket");
  }
  return value;
}

function nonempty(value: string, name: string): string {
  const result = value.trim();
  if (!result) throw new Error(`${name} is required`);
  return result;
}

export interface AcousticTranscriptReview {
  reviewVersion: 1;
  reviewerKey: string;
  reviewedAt: string;
  status: "verified_against_audio";
  transcriptVersion: number;
  transcriptSha256: string;
}

export interface PrepareAcousticEvidenceInput {
  benchmarkKey: string;
  captureId: string;
  locale: string;
  audioBytes: Uint8Array;
  audioObjectPath: string;
  audioStorageVersion: string;
  audioEtag: string;
  transcript: string;
  sttProvider: string;
  sttModel: string;
  transcriptReview: Omit<AcousticTranscriptReview, "transcriptSha256">;
  reportBytes: Uint8Array;
  reportObjectPath: string;
  reportStorageVersion: string;
  reportEtag: string;
  assessmentReceiptBytes: Uint8Array;
  attestationSecret: string;
}

export interface AcousticAssessmentReceiptEnvelope {
  receiptVersion: 1;
  benchmarkKey: string;
  captureId: string;
  locale: string;
  audioArtifactSha256: string;
  reportSha256: string;
  provider: "azure";
  model: "pronunciation-assessment";
  assessmentMode: "unscripted";
}

export interface AcousticAssessmentReceipt {
  envelope: AcousticAssessmentReceiptEnvelope;
  signature: string;
}

export interface PreparedAcousticEvidence {
  artifactSha256: string;
  artifactContentType: "audio/wav";
  artifactStorageVersion: string;
  artifactEtag: string;
  scoringResponseText: string;
  scoringContext: {
    durationSeconds: number;
    pronunciation: NonNullable<
      ReturnType<typeof extractPronunciationSignal>
    >;
  };
  audioPreprocessing: {
    audioArtifactSha256: string;
    stt: {
      provider: string;
      model: string;
      transcriptSha256: string;
    };
    transcriptReview: AcousticTranscriptReview;
    pronunciation: {
      provider: "azure";
      model: "pronunciation-assessment";
      apiVersion: "speech-sdk/1.51.0";
      assessmentMode: "unscripted";
      config: {
        locale: string;
        gradingSystem: "HundredMark";
        granularity: "Phoneme";
        dimension: "Comprehensive";
        phonemeAlphabet: "IPA";
        enableProsodyAssessment: true;
        enableMiscue: false;
        audioFormat: {
          container: "wav";
          encoding: "pcm_s16le";
          sampleRateHertz: 16_000;
          bitsPerSample: 16;
          channels: 1;
        };
        referenceTextSha256: typeof EMPTY_TEXT_SHA256;
      };
      configSha256: string;
      reportObjectPath: string;
      reportStorageVersion: string;
      reportEtag: string;
      reportSha256: string;
      completenessLimitationReason: string;
    };
    acousticAttestation: {
      envelope: BenchmarkAcousticAttestationEnvelope;
      signature: string;
    };
  };
}

function parseNormalizedAzureReport(
  bytes: Uint8Array,
  locale: string,
): NonNullable<ReturnType<typeof extractPronunciationSignal>> {
  let raw: unknown;
  try {
    raw = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new Error("Azure pronunciation report must be UTF-8 JSON");
  }
  const report =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : null;
  if (
    !report ||
    report.provider !== "azure" ||
    report.model !== "pronunciation-assessment" ||
    report.locale !== locale ||
    report.referenceText !== ""
  ) {
    throw new Error("Azure pronunciation report identity is invalid");
  }
  const signal = extractPronunciationSignal(
    raw as Parameters<typeof extractPronunciationSignal>[0],
  );
  if (!signal) throw new Error("Azure pronunciation report is not scored");
  if (signal.completenessScore !== null) {
    throw new Error("Unscripted pronunciation cannot claim completeness");
  }
  return signal;
}

const ASSESSMENT_RECEIPT_DOMAIN =
  "ielts-benchmark-acoustic-assessment-receipt-v1\n";

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function signAssessmentReceipt(
  envelope: AcousticAssessmentReceiptEnvelope,
  secret: string,
): string {
  if (!secret.trim()) throw new Error("Acoustic attestation secret is required");
  return createHmac("sha256", secret)
    .update(ASSESSMENT_RECEIPT_DOMAIN, "utf8")
    .update(canonicalJson(envelope), "utf8")
    .digest("hex");
}

/**
 * Produces the cryptographic hand-off between Azure assessment and later
 * human-review attestation. The receipt binds the normalized report bytes to
 * the exact WAV bytes, benchmark, capture and locale assessed by this trusted
 * process.
 */
export function createAcousticAssessmentReceipt(input: {
  benchmarkKey: string;
  captureId: string;
  locale: string;
  audioBytes: Uint8Array;
  reportBytes: Uint8Array;
  attestationSecret: string;
}): AcousticAssessmentReceipt {
  const wav = parsePronunciationWav(input.audioBytes);
  if (!(wav.durationSeconds > 0)) throw new Error("Audio is empty");
  parseNormalizedAzureReport(input.reportBytes, input.locale);
  const envelope: AcousticAssessmentReceiptEnvelope = {
    receiptVersion: 1,
    benchmarkKey: nonempty(input.benchmarkKey, "Benchmark key"),
    captureId: nonempty(input.captureId, "Capture ID"),
    locale: nonempty(input.locale, "Locale"),
    audioArtifactSha256: sha256(input.audioBytes),
    reportSha256: sha256(input.reportBytes),
    provider: "azure",
    model: "pronunciation-assessment",
    assessmentMode: "unscripted",
  };
  return {
    envelope,
    signature: signAssessmentReceipt(envelope, input.attestationSecret),
  };
}

function verifiedAssessmentReceipt(
  bytes: Uint8Array,
  expected: Omit<AcousticAssessmentReceiptEnvelope, "receiptVersion">,
  secret: string,
): AcousticAssessmentReceipt {
  let raw: unknown;
  try {
    raw = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new Error("Acoustic assessment receipt must be UTF-8 JSON");
  }
  const receipt = raw as Partial<AcousticAssessmentReceipt> | null;
  const envelope = receipt?.envelope as
    | Partial<AcousticAssessmentReceiptEnvelope>
    | undefined;
  if (
    !receipt ||
    !envelope ||
    envelope.receiptVersion !== 1 ||
    envelope.benchmarkKey !== expected.benchmarkKey ||
    envelope.captureId !== expected.captureId ||
    envelope.locale !== expected.locale ||
    envelope.audioArtifactSha256 !== expected.audioArtifactSha256 ||
    envelope.reportSha256 !== expected.reportSha256 ||
    envelope.provider !== expected.provider ||
    envelope.model !== expected.model ||
    envelope.assessmentMode !== expected.assessmentMode
  ) {
    throw new Error(
      "Acoustic assessment receipt does not match the exact audio and report",
    );
  }
  if (
    typeof receipt.signature !== "string" ||
    !/^[a-f0-9]{64}$/u.test(receipt.signature)
  ) {
    throw new Error("Acoustic assessment receipt signature is invalid");
  }
  const trustedEnvelope = envelope as AcousticAssessmentReceiptEnvelope;
  const expectedSignature = signAssessmentReceipt(trustedEnvelope, secret);
  if (
    !timingSafeEqual(
      Buffer.from(receipt.signature, "hex"),
      Buffer.from(expectedSignature, "hex"),
    )
  ) {
    throw new Error("Acoustic assessment receipt signature is invalid");
  }
  return { envelope: trustedEnvelope, signature: receipt.signature };
}

/**
 * Produces the protected benchmark fragment after Azure assessment, storage,
 * and an independent human transcript review. It never uploads or mutates data.
 */
export function prepareAcousticBenchmarkEvidence(
  input: PrepareAcousticEvidenceInput,
): PreparedAcousticEvidence {
  const wav = parsePronunciationWav(input.audioBytes);
  if (!(wav.durationSeconds > 0)) throw new Error("Audio is empty");
  const transcript = nonempty(input.transcript, "Reviewed transcript");
  const reviewedAt = new Date(input.transcriptReview.reviewedAt);
  if (Number.isNaN(reviewedAt.valueOf())) {
    throw new Error("Transcript review timestamp is invalid");
  }
  if (reviewedAt.valueOf() > Date.now() + 60_000) {
    throw new Error("Transcript review timestamp is in the future");
  }
  if (
    !Number.isInteger(input.transcriptReview.transcriptVersion) ||
    input.transcriptReview.transcriptVersion < 1
  ) {
    throw new Error("Transcript version must be a positive integer");
  }

  const audioArtifactSha256 = sha256(input.audioBytes);
  const transcriptSha256 = sha256(transcript);
  const reportSha256 = sha256(input.reportBytes);
  const pronunciationSignal = parseNormalizedAzureReport(
    input.reportBytes,
    input.locale,
  );
  verifiedAssessmentReceipt(
    input.assessmentReceiptBytes,
    {
      benchmarkKey: nonempty(input.benchmarkKey, "Benchmark key"),
      captureId: nonempty(input.captureId, "Capture ID"),
      locale: nonempty(input.locale, "Locale"),
      audioArtifactSha256,
      reportSha256,
      provider: "azure",
      model: "pronunciation-assessment",
      assessmentMode: "unscripted",
    },
    input.attestationSecret,
  );
  const transcriptReview: AcousticTranscriptReview = {
    ...input.transcriptReview,
    reviewerKey: nonempty(
      input.transcriptReview.reviewerKey,
      "Transcript reviewer key",
    ),
    transcriptSha256,
  };
  const transcriptReviewSha256 =
    ieltsBenchmarkValueSha256(transcriptReview);
  const pronunciation = {
    provider: "azure" as const,
    model: "pronunciation-assessment" as const,
    apiVersion: "speech-sdk/1.51.0" as const,
    assessmentMode: "unscripted" as const,
    config: {
      locale: nonempty(input.locale, "Locale"),
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
      referenceTextSha256: EMPTY_TEXT_SHA256,
    },
    configSha256: "",
    reportObjectPath: protectedObjectPath(input.reportObjectPath),
    reportStorageVersion: nonempty(
      input.reportStorageVersion,
      "Report storage version",
    ),
    reportEtag: nonempty(input.reportEtag, "Report ETag"),
    reportSha256,
    completenessLimitationReason:
      "Completeness is not valid for unscripted continuous assessment.",
  };
  pronunciation.configSha256 = ieltsBenchmarkAzureConfigSha256(pronunciation);

  const envelope = benchmarkAcousticAttestationEnvelopeSchema.parse({
    envelopeVersion: 1,
    benchmarkKey: nonempty(input.benchmarkKey, "Benchmark key"),
    captureId: input.captureId,
    audioObjectPath: protectedObjectPath(input.audioObjectPath),
    reportObjectPath: pronunciation.reportObjectPath,
    audioArtifactSha256,
    transcriptSha256,
    transcriptReviewSha256,
    configSha256: pronunciation.configSha256,
    reportSha256,
    audioStorageVersion: nonempty(
      input.audioStorageVersion,
      "Audio storage version",
    ),
    audioEtag: nonempty(input.audioEtag, "Audio ETag"),
    reportStorageVersion: pronunciation.reportStorageVersion,
    reportEtag: pronunciation.reportEtag,
    provider: pronunciation.provider,
    model: pronunciation.model,
    apiVersion: pronunciation.apiVersion,
    assessmentMode: pronunciation.assessmentMode,
  });
  return {
    artifactSha256: audioArtifactSha256,
    artifactContentType: "audio/wav",
    artifactStorageVersion: envelope.audioStorageVersion,
    artifactEtag: envelope.audioEtag,
    scoringResponseText: transcript,
    scoringContext: {
      durationSeconds: wav.durationSeconds,
      pronunciation: pronunciationSignal,
    },
    audioPreprocessing: {
      audioArtifactSha256,
      stt: {
        provider: nonempty(input.sttProvider, "STT provider"),
        model: nonempty(input.sttModel, "STT model"),
        transcriptSha256,
      },
      transcriptReview,
      pronunciation,
      acousticAttestation: {
        envelope,
        signature: signAcousticAttestationForTrustedPreprocessor(
          envelope,
          input.attestationSecret,
        ),
      },
    },
  };
}
