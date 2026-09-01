import "server-only";

import { createHash } from "node:crypto";

import type { AiPromptMessage, AiTask } from "@/lib/ai/core";
import { extractPronunciationSignal } from "@/lib/ielts/speaking-scorer/phoneme-contract";
import { buildSpeakingScorerPrompt } from "@/lib/ielts/speaking-scorer/prompt";
import { buildWritingScorerPrompt } from "@/lib/ielts/writing-scorer/prompt";
import type { ProtectedBenchmarkInput } from "./contracts";
import type { IeltsBenchmarkSkill } from "./evaluate";

export const CURRENT_IELTS_BENCHMARK_RUBRIC = {
  ielts_speaking: "ielts-speaking-rubric-v1",
  ielts_writing: "ielts-writing-rubric-v1",
} as const satisfies Record<IeltsBenchmarkSkill, string>;

export interface IeltsBenchmarkModelRequest {
  task: Extract<AiTask, "ielts_speaking_score" | "ielts_writing_score">;
  messages: AiPromptMessage[];
}

export interface IeltsBenchmarkRequestSource {
  skill: IeltsBenchmarkSkill;
  taskType: string;
  rubricVersion: string;
  input: ProtectedBenchmarkInput;
}

export interface IeltsBenchmarkRequestOptions {
  /** Approved, version-pinned runtime evidence. Omit for the locked base hash. */
  evidenceContext?: string;
  /** Exact private normalized Azure report bytes for an audio benchmark. */
  audioReportBytes?: Uint8Array;
}

function wordCount(value: string): number {
  const normalized = value.trim();
  return normalized ? normalized.split(/\s+/u).length : 0;
}

function scoringText(input: ProtectedBenchmarkInput): string {
  const value = input.responseText ?? input.scoringResponseText;
  if (!value?.trim()) {
    throw new Error("Benchmark scoring text is unavailable");
  }
  return value;
}

function textSha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function bytesSha256(value: Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function exactSignal(value: unknown) {
  return canonicalJson(value);
}

function assertAzureReport(
  input: ProtectedBenchmarkInput,
  reportBytes: Uint8Array,
): void {
  const preprocessing = input.audioPreprocessing!;
  const pronunciation = preprocessing.pronunciation;
  if (bytesSha256(reportBytes) !== pronunciation.reportSha256.toLowerCase()) {
    throw new Error("Benchmark Azure report checksum mismatch");
  }
  let rawReport: unknown;
  try {
    rawReport = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(reportBytes),
    );
  } catch {
    throw new Error("Benchmark Azure report is not valid UTF-8 JSON");
  }
  const report =
    rawReport && typeof rawReport === "object" && !Array.isArray(rawReport)
      ? (rawReport as Record<string, unknown>)
      : null;
  if (
    !report ||
    report.provider !== pronunciation.provider ||
    report.model !== pronunciation.model ||
    report.locale !== pronunciation.config.locale
  ) {
    throw new Error("Benchmark Azure report identity mismatch");
  }
  const expectedReferenceHash = textSha256(
    typeof report.referenceText === "string" ? report.referenceText : "",
  );
  if (
    expectedReferenceHash !==
    pronunciation.config.referenceTextSha256.toLowerCase()
  ) {
    throw new Error("Benchmark Azure reference-text checksum mismatch");
  }
  if (report.referenceText !== "") {
    throw new Error("Unscripted Azure report cannot contain reference text");
  }
  const derived = extractPronunciationSignal(
    rawReport as Parameters<typeof extractPronunciationSignal>[0],
  );
  if (!derived) throw new Error("Benchmark Azure report is not scored");
  if (
    exactSignal(derived) !== exactSignal(input.scoringContext?.pronunciation)
  ) {
    throw new Error("Benchmark Azure report signal mismatch");
  }
}

export function ieltsBenchmarkAzureConfigSha256(
  pronunciation: Pick<
    NonNullable<ProtectedBenchmarkInput["audioPreprocessing"]>["pronunciation"],
    "provider" | "model" | "apiVersion" | "assessmentMode" | "config"
  >,
): string {
  return ieltsBenchmarkValueSha256({
    provider: pronunciation.provider,
    model: pronunciation.model,
    apiVersion: pronunciation.apiVersion,
    assessmentMode: pronunciation.assessmentMode,
    config: pronunciation.config,
  });
}

function assertAudioPreprocessing(
  input: ProtectedBenchmarkInput,
  response: string,
  reportBytes?: Uint8Array,
): void {
  if (!input.audioObjectPath) return;
  const preprocessing = input.audioPreprocessing;
  const pronunciation = input.scoringContext?.pronunciation;
  if (!preprocessing || !pronunciation) {
    throw new Error(
      "Speaking audio requires complete acoustic evidence and preprocessing provenance",
    );
  }
  if (
    preprocessing.audioArtifactSha256.toLowerCase() !==
    input.artifactSha256.toLowerCase()
  ) {
    throw new Error("Benchmark audio artifact checksum mismatch");
  }
  if (
    ieltsBenchmarkAzureConfigSha256(preprocessing.pronunciation) !==
    preprocessing.pronunciation.configSha256.toLowerCase()
  ) {
    throw new Error("Benchmark Azure configuration checksum mismatch");
  }
  if (
    preprocessing.stt.transcriptSha256.toLowerCase() !== textSha256(response)
  ) {
    throw new Error("Benchmark transcript checksum mismatch");
  }
  if (
    pronunciation.completenessScore === null &&
    !preprocessing.pronunciation.completenessLimitationReason?.trim()
  ) {
    throw new Error(
      "Unscripted assessment requires an explicit completeness limitation reason",
    );
  }
  if (
    pronunciation.completenessScore !== null &&
    preprocessing.pronunciation.assessmentMode === "unscripted"
  ) {
    throw new Error("Unscripted assessment cannot claim completeness");
  }
  if (!reportBytes) {
    throw new Error("Benchmark Azure report bytes are required");
  }
  assertAzureReport(input, reportBytes);
}

function writingTaskNumber(taskType: string): 1 | 2 {
  if (
    taskType === "writing_task1_academic" ||
    taskType === "writing_task1_general"
  ) {
    return 1;
  }
  if (taskType === "writing_task2_essay") return 2;
  throw new Error("Unsupported IELTS Writing benchmark task type");
}

function speakingPart(taskType: string): 1 | 2 | 3 {
  if (taskType === "speaking_part1") return 1;
  if (taskType === "speaking_part2_cuecard") return 2;
  if (taskType === "speaking_part3") return 3;
  throw new Error("Unsupported IELTS Speaking benchmark task type");
}

/**
 * Builds the exact task/messages envelope whose hash the centralized AI core
 * records. Gold criterion labels are deliberately absent from this input.
 */
export function buildIeltsBenchmarkRequest(
  source: IeltsBenchmarkRequestSource,
  options: IeltsBenchmarkRequestOptions = {},
): IeltsBenchmarkModelRequest {
  if (source.rubricVersion !== CURRENT_IELTS_BENCHMARK_RUBRIC[source.skill]) {
    throw new Error("Benchmark rubric is not the current scoring rubric");
  }
  const response = scoringText(source.input);
  assertAudioPreprocessing(source.input, response, options.audioReportBytes);
  const part =
    source.skill === "ielts_speaking" ? speakingPart(source.taskType) : null;
  if (part === 2 && source.input.cueCardBullets.length === 0) {
    throw new Error("Speaking Part 2 benchmark requires cue-card bullets");
  }
  const prompt =
    source.skill === "ielts_writing"
      ? buildWritingScorerPrompt({
          taskNumber: writingTaskNumber(source.taskType),
          taskType: source.taskType,
          questionPrompt: source.input.prompt,
          essay: response,
          wordCount: wordCount(response),
          feedbackLanguage: "en",
          grounding: {
            questionModelAnswer: source.input.grounding.questionReferenceAnswer,
            examinerNotes: source.input.grounding.examinerNotes,
            peerModelAnswers: source.input.grounding.peerReferenceAnswers,
          },
          evidenceContext: options.evidenceContext,
        })
      : buildSpeakingScorerPrompt({
          partNumber: part!,
          questionType: source.taskType,
          questionPrompt: source.input.prompt,
          cueCardBullets: source.input.cueCardBullets,
          transcript: response,
          wordCount: wordCount(response),
          durationSeconds: source.input.scoringContext?.durationSeconds,
          sttWarnings: source.input.scoringContext?.sttWarnings,
          feedbackLanguage: "en",
          grounding: {
            questionSampleAnswer:
              source.input.grounding.questionReferenceAnswer,
            examinerNotes: source.input.grounding.examinerNotes,
            peerSampleAnswers: source.input.grounding.peerReferenceAnswers,
          },
          pronunciation: source.input.scoringContext?.pronunciation ?? null,
          evidenceContext: options.evidenceContext,
        });
  return {
    task:
      source.skill === "ielts_writing"
        ? "ielts_writing_score"
        : "ielts_speaking_score",
    messages: [{ role: "user", content: prompt }],
  };
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

/** Matches the core's canonical SHA-256 of `{task,messages}`. */
export function ieltsBenchmarkModelInputSha256(
  request: IeltsBenchmarkModelRequest,
): string {
  return createHash("sha256").update(canonicalJson(request)).digest("hex");
}

export function ieltsBenchmarkValueSha256(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

export function assertIeltsBenchmarkModelInputHash(
  source: IeltsBenchmarkRequestSource,
  options: IeltsBenchmarkRequestOptions = {},
): IeltsBenchmarkModelRequest {
  const request = buildIeltsBenchmarkRequest(source, options);
  const expected = source.input.modelInputSha256.toLowerCase();
  if (ieltsBenchmarkModelInputSha256(request) !== expected) {
    throw new Error("Benchmark model input checksum mismatch");
  }
  return request;
}
