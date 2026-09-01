import "server-only";

import { open, readFile } from "node:fs/promises";

import { assessContinuousPronunciation } from "../../../apps/web/src/lib/ielts/pronunciation/continuous";
import { getAzureSpeechConfig } from "../../../apps/web/src/lib/ielts/pronunciation/config";
import {
  createAcousticAssessmentReceipt,
  prepareAcousticBenchmarkEvidence,
} from "./acoustic-preprocessor";

type JsonRecord = Record<string, unknown>;

function requiredString(value: unknown, name: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${name} is required`);
  }
  return value.trim();
}

function protectedJsonBytes(value: unknown): Uint8Array {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function writeProtectedBytes(path: string, value: Uint8Array) {
  const handle = await open(path, "wx", 0o600);
  try {
    await handle.writeFile(value);
  } finally {
    await handle.close();
  }
}

async function writeProtectedJson(path: string, value: unknown) {
  await writeProtectedBytes(path, protectedJsonBytes(value));
}

async function loadInput(): Promise<JsonRecord> {
  const path = requiredString(
    process.env.AI_GRADING_ACOUSTIC_INPUT_FILE,
    "AI_GRADING_ACOUSTIC_INPUT_FILE",
  );
  const value = JSON.parse(await readFile(path, "utf8"));
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Acoustic input must be a JSON object");
  }
  return value as JsonRecord;
}

async function assess(input: JsonRecord) {
  const audioFile = requiredString(input.audioFile, "audioFile");
  const outputFile = requiredString(input.reportOutputFile, "reportOutputFile");
  const receiptOutputFile = requiredString(
    input.assessmentReceiptOutputFile,
    "assessmentReceiptOutputFile",
  );
  const locale = requiredString(input.locale, "locale");
  const config = getAzureSpeechConfig();
  if (!config) throw new Error("Azure Speech is not configured");
  const audioBytes = await readFile(audioFile);
  const report = await assessContinuousPronunciation({
    audio: audioBytes,
    config,
    locale,
  });
  const reportBytes = protectedJsonBytes(report);
  const receipt = createAcousticAssessmentReceipt({
    benchmarkKey: requiredString(input.benchmarkKey, "benchmarkKey"),
    captureId: requiredString(input.captureId, "captureId"),
    locale,
    audioBytes,
    reportBytes,
    attestationSecret: requiredString(
      process.env.AI_GRADING_BENCHMARK_ATTESTATION_SECRET,
      "AI_GRADING_BENCHMARK_ATTESTATION_SECRET",
    ),
  });
  await writeProtectedBytes(outputFile, reportBytes);
  await writeProtectedJson(receiptOutputFile, receipt);
  return {
    mode: "assess",
    outputFile,
    receiptOutputFile,
    status: report.status,
  };
}

async function attest(input: JsonRecord) {
  const review = input.transcriptReview as JsonRecord | undefined;
  if (!review) throw new Error("transcriptReview is required");
  const outputFile = requiredString(input.outputFile, "outputFile");
  const result = prepareAcousticBenchmarkEvidence({
    benchmarkKey: requiredString(input.benchmarkKey, "benchmarkKey"),
    captureId: requiredString(input.captureId, "captureId"),
    locale: requiredString(input.locale, "locale"),
    audioBytes: await readFile(requiredString(input.audioFile, "audioFile")),
    audioObjectPath: requiredString(
      input.audioObjectPath,
      "audioObjectPath",
    ),
    audioStorageVersion: requiredString(
      input.audioStorageVersion,
      "audioStorageVersion",
    ),
    audioEtag: requiredString(input.audioEtag, "audioEtag"),
    transcript: await readFile(
      requiredString(input.transcriptFile, "transcriptFile"),
      "utf8",
    ),
    sttProvider: requiredString(input.sttProvider, "sttProvider"),
    sttModel: requiredString(input.sttModel, "sttModel"),
    transcriptReview: {
      reviewVersion: 1,
      reviewerKey: requiredString(review.reviewerKey, "reviewerKey"),
      reviewedAt: requiredString(review.reviewedAt, "reviewedAt"),
      status: "verified_against_audio",
      transcriptVersion: Number(review.transcriptVersion),
    },
    reportBytes: await readFile(
      requiredString(input.reportFile, "reportFile"),
    ),
    reportObjectPath: requiredString(
      input.reportObjectPath,
      "reportObjectPath",
    ),
    reportStorageVersion: requiredString(
      input.reportStorageVersion,
      "reportStorageVersion",
    ),
    reportEtag: requiredString(input.reportEtag, "reportEtag"),
    assessmentReceiptBytes: await readFile(
      requiredString(input.assessmentReceiptFile, "assessmentReceiptFile"),
    ),
    attestationSecret: requiredString(
      process.env.AI_GRADING_BENCHMARK_ATTESTATION_SECRET,
      "AI_GRADING_BENCHMARK_ATTESTATION_SECRET",
    ),
  });
  await writeProtectedJson(outputFile, result);
  return { mode: "attest", benchmarkKey: input.benchmarkKey, outputFile };
}

async function main() {
  const mode = process.env.AI_GRADING_ACOUSTIC_MODE?.trim();
  const input = await loadInput();
  const result =
    mode === "assess"
      ? await assess(input)
      : mode === "attest"
        ? await attest(input)
        : (() => {
            throw new Error(
              "AI_GRADING_ACOUSTIC_MODE must be assess or attest",
            );
          })();
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : "Acoustic preprocessing failed"}\n`,
  );
  process.exitCode = 1;
});
