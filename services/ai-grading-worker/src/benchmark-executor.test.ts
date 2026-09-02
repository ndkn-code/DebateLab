import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import {
  benchmarkTranscriptReviewSha256,
  protectedBenchmarkInputSchema,
  type BenchmarkTranscriptReview,
  type ProtectedBenchmarkInput,
} from "@/lib/ai/benchmarks/contracts";
import {
  buildIeltsBenchmarkRequest,
  ieltsBenchmarkAzureConfigSha256,
  ieltsBenchmarkModelInputSha256,
} from "@/lib/ai/benchmarks/request";
import {
  executeIeltsBenchmarks,
  assertBenchmarkProviderConfiguration,
  createProductionBenchmarkGenerator,
  type BenchmarkExecutionCase,
  type BenchmarkExecutorGenerator,
  type BenchmarkExecutorRepository,
  type BenchmarkPipelineStage,
  type BenchmarkProviderClaim,
  type PreparedBenchmarkRun,
  type BenchmarkRunEvidence,
  type BenchmarkRunKind,
} from "./benchmark-executor";
import { AiExecutionError } from "@/lib/ai/core";
import { getIeltsSpeakingScoringPolicy } from "@/lib/ielts/speaking-scorer/provider-policy";
import { getIeltsWritingScoringPolicy } from "@/lib/ielts/writing-scorer/provider-policy";

function sha256(value: string | Uint8Array): string {
  return createHash("sha256")
    .update(typeof value === "string" ? Buffer.from(value, "utf8") : value)
    .digest("hex");
}

const EMPTY_TEXT_SHA256 =
  "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855" as const;

const azureConfig = {
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
  referenceTextSha256: EMPTY_TEXT_SHA256,
};

const azureConfigIdentity = {
  provider: "azure" as const,
  model: "pronunciation-assessment" as const,
  apiVersion: "speech-sdk/1.51.0" as const,
  assessmentMode: "unscripted" as const,
  config: azureConfig,
};

const azureReport = {
  schemaVersion: 1,
  status: "scored",
  provider: "azure",
  model: "pronunciation-assessment",
  locale: "en-US",
  referenceText: "",
  recognizedText:
    "My science teacher helped me understand difficult experiments.",
  overall: {
    accuracy: 75,
    fluency: 70,
    completeness: null,
    prosody: 68,
    pronunciation: 72,
  },
  words: [
    {
      word: "experiments",
      accuracy: 55,
      errorType: "Mispronunciation",
      phonemes: [],
    },
  ],
};

const azureReportBytes = new Uint8Array(
  Buffer.from(JSON.stringify(azureReport), "utf8"),
);

function acousticAttestation(params: {
  benchmarkKey: string;
  audioObjectPath: string;
  audioSha256: string;
  transcriptSha256: string;
  configSha256: string;
  reportObjectPath: string;
  reportSha256: string;
  transcriptReview: BenchmarkTranscriptReview;
  audioStorageVersion: string;
  audioEtag: string;
  reportStorageVersion: string;
  reportEtag: string;
}) {
  return {
    envelope: {
      envelopeVersion: 1 as const,
      benchmarkKey: params.benchmarkKey,
      captureId: "00000000-0000-4000-8000-000000000099",
      audioObjectPath: params.audioObjectPath,
      reportObjectPath: params.reportObjectPath,
      audioArtifactSha256: params.audioSha256,
      transcriptSha256: params.transcriptSha256,
      transcriptReviewSha256: benchmarkTranscriptReviewSha256(
        params.transcriptReview,
      ),
      configSha256: params.configSha256,
      reportSha256: params.reportSha256,
      audioStorageVersion: params.audioStorageVersion,
      audioEtag: params.audioEtag,
      reportStorageVersion: params.reportStorageVersion,
      reportEtag: params.reportEtag,
      provider: "azure" as const,
      model: "pronunciation-assessment" as const,
      apiVersion: "speech-sdk/1.51.0" as const,
      assessmentMode: "unscripted" as const,
    },
    signature: "c".repeat(64),
  };
}

function reviewedTranscript(transcript: string): BenchmarkTranscriptReview {
  return {
    reviewVersion: 1,
    reviewerKey: "transcript-reviewer-001",
    reviewedAt: "2026-09-01T12:00:00.000Z",
    status: "verified_against_audio",
    transcriptVersion: 1,
    transcriptSha256: sha256(transcript),
  };
}

function stagedGenerator(
  params: {
    preflight?: (audioReportBytes?: Uint8Array) => Promise<void>;
    provisional?: (
      runKind: BenchmarkRunKind,
      claim: BenchmarkProviderClaim,
    ) => Promise<BenchmarkRunEvidence>;
    adjudication?: (
      runKind: BenchmarkRunKind,
      claim: BenchmarkProviderClaim,
    ) => Promise<BenchmarkRunEvidence>;
    prepareAdjudication?: () => Promise<void>;
  } = {},
): BenchmarkExecutorGenerator {
  return {
    async preflight({ request, audioReportBytes }) {
      await params.preflight?.(audioReportBytes);
      return {
        request,
        query: "protected query",
        skill: "writing",
        version: "1",
        baseEvidence: {},
        baseEvidenceSha256: "a".repeat(64),
        runKey: "benchmark:test",
        admin: {} as PreparedBenchmarkRun["admin"],
      };
    },
    async generateProvisional({ runKind, claim }) {
      return (
        (await params.provisional?.(runKind, claim)) ?? {
          prediction: writingPrediction,
          providerRequestId: `00000000-0000-4000-8000-0000000001${runKind === "primary" ? "01" : "02"}`,
        }
      );
    },
    async prepareAdjudication({ provisional }) {
      await params.prepareAdjudication?.();
      return {
        prompt: "adjudicate",
        evidenceSha256: "b".repeat(64),
        provisional,
      };
    },
    async generateAdjudication({ runKind, claim }) {
      return (
        (await params.adjudication?.(runKind, claim)) ?? {
          prediction: writingPrediction,
          providerRequestId: `00000000-0000-4000-8000-0000000002${runKind === "primary" ? "01" : "02"}`,
        }
      );
    },
  };
}

const writingPrediction = {
  criteria: {
    taskResponse: { band: 6.5, rationale: "Addresses the task." },
    coherenceCohesion: { band: 6, rationale: "Mostly logical." },
    lexicalResource: { band: 6.5, rationale: "Adequate range." },
    grammaticalRangeAccuracy: { band: 6, rationale: "Some errors." },
  },
  overallSummary: "A developed response with identifiable limitations.",
  inlineCorrections: [],
  paragraphFeedback: [],
  modelAnswer: "A complete stronger response for the same task.",
};

function protectedInput(
  overrides: Partial<ProtectedBenchmarkInput> = {},
): ProtectedBenchmarkInput {
  const base: ProtectedBenchmarkInput = {
    prompt: "Some people prefer cities. Discuss both views.",
    responseText:
      "Cities provide more work, while rural areas can offer a calmer life.",
    grounding: {
      questionReferenceAnswer: "A reviewed exact-question reference answer.",
      examinerNotes: ["Address both views and give a clear position."],
      peerReferenceAnswers: ["A reviewed same-task peer answer."],
    },
    cueCardBullets: [],
    artifactSha256: "a".repeat(64),
    modelInputSha256: "0".repeat(64),
    responseLocator: "candidate response 1",
    ...overrides,
  };
  const request = buildIeltsBenchmarkRequest({
    skill: "ielts_writing",
    taskType: "writing_task2_essay",
    rubricVersion: "ielts-writing-rubric-v1",
    input: base,
  });
  return {
    ...base,
    modelInputSha256: ieltsBenchmarkModelInputSha256(request),
  };
}

function benchmark(
  input: ProtectedBenchmarkInput = protectedInput(),
): BenchmarkExecutionCase {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    benchmarkKey: "protected-writing-holdout-001",
    skill: "ielts_writing",
    taskType: "writing_task2_essay",
    rubricVersion: "ielts-writing-rubric-v1",
    artifactSha256: input.artifactSha256,
    input,
  };
}

function fakeRepository(params: {
  cases?: BenchmarkExecutionCase[];
  attested?: Partial<Record<BenchmarkRunKind, BenchmarkRunEvidence>>;
  claimOutcome?: "claimed" | "lease_active" | "outcome_unknown" | "exhausted";
}) {
  let evaluationId: string | null = null;
  const recorded = new Set<BenchmarkRunKind>();
  const imported: BenchmarkRunKind[] = [];
  const repository: BenchmarkExecutorRepository = {
    async loadCases() {
      return params.cases ?? [benchmark()];
    },
    async loadAudioReport() {
      return null;
    },
    async findEvaluation() {
      return evaluationId ? { id: evaluationId } : null;
    },
    async findRecordedRunKinds() {
      return new Set(recorded);
    },
    async findAttestedRun({ runKind }) {
      return params.attested?.[runKind] ?? null;
    },
    async claimRun({ runKind }) {
      const outcome = params.claimOutcome ?? "claimed";
      return outcome === "claimed"
        ? { outcome, claimToken: `claim-${runKind}`, claimAttempt: 1 }
        : { outcome };
    },
    async startProvider() {},
    async completeProvider() {},
    async failProvider() {
      return "retryable";
    },
    async recoverProvider() {},
    async markImported() {},
    async createEvaluation() {
      evaluationId = "00000000-0000-4000-8000-000000000002";
      return { id: evaluationId };
    },
    async recordRun({ runKind }) {
      recorded.add(runKind);
      imported.push(runKind);
    },
  };
  return { repository, imported };
}

test("the shared request is deterministic and contains no protected score labels", () => {
  const input = protectedInput();
  const first = buildIeltsBenchmarkRequest({
    skill: "ielts_writing",
    taskType: "writing_task2_essay",
    rubricVersion: "ielts-writing-rubric-v1",
    input,
  });
  const second = buildIeltsBenchmarkRequest({
    skill: "ielts_writing",
    taskType: "writing_task2_essay",
    rubricVersion: "ielts-writing-rubric-v1",
    input,
  });
  assert.deepEqual(first, second);
  assert.equal(ieltsBenchmarkModelInputSha256(first), input.modelInputSha256);
  assert.match(first.messages[0]!.content, /Cities provide more work/);
  assert.doesNotMatch(
    first.messages[0]!.content,
    /exact-question reference answer|Address both views/,
  );
  assert.doesNotMatch(first.messages[0]!.content, /labelLocator|expectedBand/);
  assert.throws(
    () =>
      buildIeltsBenchmarkRequest({
        skill: "ielts_writing",
        taskType: "writing_task2_essay",
        rubricVersion: "stale-rubric",
        input,
      }),
    /current scoring rubric/,
  );
});

test("benchmark-adjacent examiner rationale never enters the model request", () => {
  const input = protectedInput();
  input.grounding.examinerNotes = [
    "Band 7 because the response develops a position but has occasional lapses.",
  ];
  input.grounding.questionReferenceAnswer =
    "This protected reference was authored beside the scored artifact.";
  const request = buildIeltsBenchmarkRequest({
    skill: "ielts_writing",
    taskType: "writing_task2_essay",
    rubricVersion: "ielts-writing-rubric-v1",
    input,
  });
  assert.doesNotMatch(
    request.messages[0]!.content,
    /Band 7|protected reference|occasional lapses/,
  );
});

test("a Speaking request binds and carries locked acoustic evidence into preflight", async () => {
  const transcript =
    "My science teacher helped me understand difficult experiments.";
  const input: ProtectedBenchmarkInput = {
    prompt: "Describe a person who helped you learn something.",
    audioObjectPath: "ai-grading-benchmarks-private/speaking/response.wav",
    scoringResponseText: transcript,
    scoringContext: {
      durationSeconds: 48,
      sttWarnings: ["low confidence on one proper noun"],
      pronunciation: {
        pronunciationScore: 72,
        accuracyScore: 75,
        fluencyScore: 70,
        completenessScore: null,
        prosodyScore: 68,
        mispronouncedWords: ["experiments"],
      },
    },
    grounding: {
      questionReferenceAnswer: "A reviewed answer about a helpful teacher.",
      examinerNotes: ["Sustain the long turn and cover each bullet."],
      peerReferenceAnswers: ["A reviewed Part 2 peer answer."],
    },
    cueCardBullets: [
      "who the person was",
      "what they taught you",
      "why the help mattered",
    ],
    audioPreprocessing: {
      audioArtifactSha256: "b".repeat(64),
      stt: {
        provider: "deepgram",
        model: "nova-3",
        transcriptSha256: sha256(transcript),
      },
      transcriptReview: reviewedTranscript(transcript),
      pronunciation: {
        ...azureConfigIdentity,
        configSha256: ieltsBenchmarkAzureConfigSha256(azureConfigIdentity),
        reportObjectPath: "ai-grading-benchmarks-private/azure/report-001.json",
        reportStorageVersion: "report-v1",
        reportEtag: "report-etag-v1",
        reportSha256: sha256(azureReportBytes),
        completenessLimitationReason:
          "Unscripted continuous assessment does not report completeness.",
      },
      acousticAttestation: acousticAttestation({
        benchmarkKey: "protected-speaking-holdout-001",
        audioObjectPath: "ai-grading-benchmarks-private/speaking/response.wav",
        audioSha256: "b".repeat(64),
        transcriptSha256: sha256(transcript),
        configSha256: ieltsBenchmarkAzureConfigSha256(azureConfigIdentity),
        reportObjectPath: "ai-grading-benchmarks-private/azure/report-001.json",
        reportSha256: sha256(azureReportBytes),
        transcriptReview: reviewedTranscript(transcript),
        audioStorageVersion: "audio-v1",
        audioEtag: "audio-etag-v1",
        reportStorageVersion: "report-v1",
        reportEtag: "report-etag-v1",
      }),
    },
    artifactSha256: "b".repeat(64),
    modelInputSha256: "0".repeat(64),
    artifactContentType: "audio/wav",
    artifactStorageVersion: "audio-v1",
    artifactEtag: "audio-etag-v1",
    responseLocator: "full recording",
  };
  const request = buildIeltsBenchmarkRequest(
    {
      skill: "ielts_speaking",
      taskType: "speaking_part2_cuecard",
      rubricVersion: "ielts-speaking-rubric-v1",
      input,
    },
    { audioReportBytes: azureReportBytes },
  );
  assert.equal(request.task, "ielts_speaking_score");
  assert.match(request.messages[0]!.content, /48s/);
  assert.match(request.messages[0]!.content, /overall 72\/100/);
  assert.match(request.messages[0]!.content, /experiments/);
  assert.match(request.messages[0]!.content, /who the person was/);
  assert.doesNotMatch(request.messages[0]!.content, /helpful teacher/);

  const lockedInput = {
    ...input,
    modelInputSha256: ieltsBenchmarkModelInputSha256(request),
  };
  const fake = fakeRepository({
    cases: [
      {
        id: "00000000-0000-4000-8000-000000000003",
        benchmarkKey: "protected-speaking-holdout-001",
        skill: "ielts_speaking",
        taskType: "speaking_part2_cuecard",
        rubricVersion: "ielts-speaking-rubric-v1",
        artifactSha256: lockedInput.artifactSha256,
        input: lockedInput,
      },
    ],
  });
  fake.repository.loadAudioReport = async () => azureReportBytes;
  await assert.rejects(
    () =>
      executeIeltsBenchmarks(
        {
          graderVersion: "evidence-adjudicated-v1",
          corpusVersion: 1,
          split: "holdout",
        },
        {
          repository: fake.repository,
          generator: stagedGenerator({
            async preflight(reportBytes) {
              assert.deepEqual(reportBytes, azureReportBytes);
              throw new Error("preflight evidence handoff verified");
            },
          }),
        },
      ),
    /preflight evidence handoff verified/,
  );
});

test("Speaking audio fails closed without complete acoustic provenance", () => {
  const parsed = protectedBenchmarkInputSchema.safeParse({
    prompt: "Describe a person who helped you.",
    audioObjectPath: "ai-grading-benchmarks-private/speaking/response.wav",
    scoringResponseText: "A locked transcript.",
    scoringContext: { durationSeconds: 30 },
    grounding: {
      questionReferenceAnswer: null,
      examinerNotes: [],
      peerReferenceAnswers: [],
    },
    cueCardBullets: ["who the person was"],
    artifactSha256: "a".repeat(64),
    modelInputSha256: "b".repeat(64),
    artifactContentType: "audio/wav",
    artifactStorageVersion: "v1",
    artifactEtag: "etag",
    responseLocator: "full recording",
  });
  assert.equal(parsed.success, false);
  assert.match(
    parsed.error?.issues.map((issue) => issue.message).join(" ") ?? "",
    /complete acoustic evidence and preprocessing provenance/,
  );
});

test("Speaking request rejects audio and transcript provenance mismatches", () => {
  const transcript = "A locked transcript.";
  const base: ProtectedBenchmarkInput = {
    prompt: "Describe a person who helped you.",
    audioObjectPath: "ai-grading-benchmarks-private/speaking/response.wav",
    scoringResponseText: transcript,
    scoringContext: {
      pronunciation: {
        pronunciationScore: 70,
        accuracyScore: 71,
        fluencyScore: 69,
        completenessScore: 72,
        prosodyScore: 68,
        mispronouncedWords: [],
      },
    },
    grounding: {
      questionReferenceAnswer: null,
      examinerNotes: [],
      peerReferenceAnswers: [],
    },
    cueCardBullets: ["who the person was"],
    audioPreprocessing: {
      audioArtifactSha256: "b".repeat(64),
      stt: {
        provider: "deepgram",
        model: "nova-3",
        transcriptSha256: sha256(transcript),
      },
      transcriptReview: reviewedTranscript(transcript),
      pronunciation: {
        ...azureConfigIdentity,
        configSha256: ieltsBenchmarkAzureConfigSha256(azureConfigIdentity),
        reportObjectPath: "ai-grading-benchmarks-private/azure/report-001.json",
        reportStorageVersion: "report-v1",
        reportEtag: "report-etag-v1",
        reportSha256: sha256(azureReportBytes),
        completenessLimitationReason: null,
      },
      acousticAttestation: acousticAttestation({
        benchmarkKey: "protected-speaking-holdout-001",
        audioObjectPath: "ai-grading-benchmarks-private/speaking/response.wav",
        audioSha256: "b".repeat(64),
        transcriptSha256: sha256(transcript),
        configSha256: ieltsBenchmarkAzureConfigSha256(azureConfigIdentity),
        reportObjectPath: "ai-grading-benchmarks-private/azure/report-001.json",
        reportSha256: sha256(azureReportBytes),
        transcriptReview: reviewedTranscript(transcript),
        audioStorageVersion: "v1",
        audioEtag: "etag",
        reportStorageVersion: "report-v1",
        reportEtag: "report-etag-v1",
      }),
    },
    artifactSha256: "b".repeat(64),
    modelInputSha256: "0".repeat(64),
    artifactContentType: "audio/wav",
    artifactStorageVersion: "v1",
    artifactEtag: "etag",
    responseLocator: "full recording",
  };
  const source = {
    skill: "ielts_speaking" as const,
    taskType: "speaking_part2_cuecard",
    rubricVersion: "ielts-speaking-rubric-v1",
    input: base,
  };
  assert.throws(
    () =>
      buildIeltsBenchmarkRequest(
        {
          ...source,
          input: {
            ...base,
            audioPreprocessing: {
              ...base.audioPreprocessing!,
              audioArtifactSha256: "f".repeat(64),
            },
          },
        },
        { audioReportBytes: azureReportBytes },
      ),
    /audio artifact checksum mismatch/,
  );
  assert.throws(
    () =>
      buildIeltsBenchmarkRequest(
        {
          ...source,
          input: {
            ...base,
            audioPreprocessing: {
              ...base.audioPreprocessing!,
              stt: {
                ...base.audioPreprocessing!.stt,
                transcriptSha256: "e".repeat(64),
              },
            },
          },
        },
        { audioReportBytes: azureReportBytes },
      ),
    /transcript checksum mismatch/,
  );
});

test("Speaking request rejects Azure config, report, and derived-score tampering", () => {
  const transcript = azureReport.recognizedText;
  const pronunciation = {
    ...azureConfigIdentity,
    configSha256: ieltsBenchmarkAzureConfigSha256(azureConfigIdentity),
    reportObjectPath: "ai-grading-benchmarks-private/azure/report-001.json",
    reportStorageVersion: "report-v1",
    reportEtag: "report-etag-v1",
    reportSha256: sha256(azureReportBytes),
    completenessLimitationReason:
      "Unscripted continuous assessment does not report completeness.",
  };
  const input: ProtectedBenchmarkInput = {
    prompt: "Describe a teacher.",
    audioObjectPath: "ai-grading-benchmarks-private/speaking/response.wav",
    scoringResponseText: transcript,
    scoringContext: {
      pronunciation: {
        pronunciationScore: 72,
        accuracyScore: 75,
        fluencyScore: 70,
        completenessScore: null,
        prosodyScore: 68,
        mispronouncedWords: ["experiments"],
      },
    },
    grounding: {
      questionReferenceAnswer: null,
      examinerNotes: [],
      peerReferenceAnswers: [],
    },
    cueCardBullets: ["who the teacher was"],
    audioPreprocessing: {
      audioArtifactSha256: "b".repeat(64),
      stt: {
        provider: "deepgram",
        model: "nova-3",
        transcriptSha256: sha256(transcript),
      },
      transcriptReview: reviewedTranscript(transcript),
      pronunciation,
      acousticAttestation: acousticAttestation({
        benchmarkKey: "protected-speaking-holdout-001",
        audioObjectPath: "ai-grading-benchmarks-private/speaking/response.wav",
        audioSha256: "b".repeat(64),
        transcriptSha256: sha256(transcript),
        configSha256: pronunciation.configSha256,
        reportObjectPath: pronunciation.reportObjectPath,
        reportSha256: pronunciation.reportSha256,
        transcriptReview: reviewedTranscript(transcript),
        audioStorageVersion: "audio-v1",
        audioEtag: "audio-etag-v1",
        reportStorageVersion: pronunciation.reportStorageVersion,
        reportEtag: pronunciation.reportEtag,
      }),
    },
    artifactSha256: "b".repeat(64),
    modelInputSha256: "0".repeat(64),
    artifactContentType: "audio/wav",
    artifactStorageVersion: "audio-v1",
    artifactEtag: "audio-etag-v1",
    responseLocator: "full recording",
  };
  const build = (
    candidate: ProtectedBenchmarkInput,
    bytes = azureReportBytes,
  ) =>
    buildIeltsBenchmarkRequest(
      {
        skill: "ielts_speaking",
        taskType: "speaking_part2_cuecard",
        rubricVersion: "ielts-speaking-rubric-v1",
        input: candidate,
      },
      { audioReportBytes: bytes },
    );
  assert.throws(
    () =>
      build({
        ...input,
        audioPreprocessing: {
          ...input.audioPreprocessing!,
          pronunciation: {
            ...pronunciation,
            configSha256: "f".repeat(64),
          },
        },
      }),
    /configuration checksum mismatch/,
  );
  assert.throws(
    () =>
      build({
        ...input,
        audioPreprocessing: {
          ...input.audioPreprocessing!,
          pronunciation: {
            ...pronunciation,
            reportSha256: "f".repeat(64),
          },
        },
      }),
    /report checksum mismatch/,
  );
  assert.throws(
    () =>
      build({
        ...input,
        scoringContext: {
          pronunciation: {
            ...input.scoringContext!.pronunciation!,
            pronunciationScore: 99,
          },
        },
      }),
    /report signal mismatch/,
  );
  const scripted = protectedBenchmarkInputSchema.safeParse({
    ...input,
    audioPreprocessing: {
      ...input.audioPreprocessing!,
      pronunciation: {
        ...pronunciation,
        assessmentMode: "scripted",
      },
    },
  });
  assert.equal(scripted.success, false);
  assert.match(
    scripted.error?.issues.map((issue) => issue.message).join(" ") ?? "",
    /unscripted|Invalid literal|Invalid input/i,
  );
  const nonEmptyReference = {
    ...azureReport,
    referenceText: "This must never be used for IELTS benchmark coverage.",
  };
  const nonEmptyReferenceBytes = new Uint8Array(
    Buffer.from(JSON.stringify(nonEmptyReference), "utf8"),
  );
  assert.throws(
    () =>
      build(
        {
          ...input,
          audioPreprocessing: {
            ...input.audioPreprocessing!,
            pronunciation: {
              ...pronunciation,
              reportSha256: sha256(nonEmptyReferenceBytes),
            },
          },
        },
        nonEmptyReferenceBytes,
      ),
    /reference-text checksum mismatch|cannot contain reference text/,
  );
});

test("live and benchmark stages share the locked IELTS scoring policies", () => {
  const original = {
    speaking: process.env.GROQ_IELTS_SPEAKING_MODEL,
    writing: process.env.GROQ_IELTS_WRITING_MODEL,
    fallback: process.env.GROQ_IELTS_SCORING_FALLBACK_MODEL,
  };
  process.env.GROQ_IELTS_SPEAKING_MODEL = "test/speaking-primary";
  process.env.GROQ_IELTS_WRITING_MODEL = "test/writing-primary";
  process.env.GROQ_IELTS_SCORING_FALLBACK_MODEL = "test/fast-fallback";
  try {
    const speakingProvisional = getIeltsSpeakingScoringPolicy("provisional");
    const speakingAdjudicated = getIeltsSpeakingScoringPolicy("adjudicated");
    const writingProvisional = getIeltsWritingScoringPolicy("provisional");
    const writingAdjudicated = getIeltsWritingScoringPolicy("adjudicated");
    assert.deepEqual(speakingProvisional.candidates, [
      { provider: "groq", model: "test/speaking-primary" },
      { provider: "groq", model: "test/fast-fallback" },
    ]);
    assert.deepEqual(
      speakingAdjudicated.candidates,
      speakingProvisional.candidates,
    );
    assert.equal(speakingProvisional.maxOutputTokens, 3_072);
    assert.equal(speakingProvisional.temperature, 0.2);
    assert.equal(speakingAdjudicated.temperature, 0);
    assert.deepEqual(writingProvisional.candidates, [
      { provider: "groq", model: "test/writing-primary" },
      { provider: "groq", model: "test/fast-fallback" },
    ]);
    assert.deepEqual(
      writingAdjudicated.candidates,
      writingProvisional.candidates,
    );
    assert.equal(writingProvisional.maxOutputTokens, 4_096);
    assert.equal(writingProvisional.temperature, 0.2);
    assert.equal(writingAdjudicated.temperature, 0);
  } finally {
    if (original.speaking === undefined)
      delete process.env.GROQ_IELTS_SPEAKING_MODEL;
    else process.env.GROQ_IELTS_SPEAKING_MODEL = original.speaking;
    if (original.writing === undefined)
      delete process.env.GROQ_IELTS_WRITING_MODEL;
    else process.env.GROQ_IELTS_WRITING_MODEL = original.writing;
    if (original.fallback === undefined)
      delete process.env.GROQ_IELTS_SCORING_FALLBACK_MODEL;
    else process.env.GROQ_IELTS_SCORING_FALLBACK_MODEL = original.fallback;
  }
});

test("benchmark provider preflight rejects an unsupported selected model", () => {
  const original = {
    key: process.env.GROQ_API_KEY,
    speaking: process.env.GROQ_IELTS_SPEAKING_MODEL,
    fallback: process.env.GROQ_IELTS_SCORING_FALLBACK_MODEL,
    supported: process.env.GROQ_IELTS_SUPPORTED_MODELS,
  };
  try {
    process.env.GROQ_API_KEY = "configured-for-contract-test";
    process.env.GROQ_IELTS_SPEAKING_MODEL = "unknown/model";
    process.env.GROQ_IELTS_SCORING_FALLBACK_MODEL = "openai/gpt-oss-20b";
    delete process.env.GROQ_IELTS_SUPPORTED_MODELS;
    assert.throws(
      () => assertBenchmarkProviderConfiguration("ielts_speaking"),
      /Unsupported IELTS benchmark provider candidate/,
    );
    process.env.GROQ_IELTS_SUPPORTED_MODELS = "unknown/model";
    assert.doesNotThrow(() =>
      assertBenchmarkProviderConfiguration("ielts_speaking"),
    );
  } finally {
    if (original.key === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = original.key;
    if (original.speaking === undefined)
      delete process.env.GROQ_IELTS_SPEAKING_MODEL;
    else process.env.GROQ_IELTS_SPEAKING_MODEL = original.speaking;
    if (original.fallback === undefined)
      delete process.env.GROQ_IELTS_SCORING_FALLBACK_MODEL;
    else process.env.GROQ_IELTS_SCORING_FALLBACK_MODEL = original.fallback;
    if (original.supported === undefined)
      delete process.env.GROQ_IELTS_SUPPORTED_MODELS;
    else process.env.GROQ_IELTS_SUPPORTED_MODELS = original.supported;
  }
});

test("primary and repeat runs are independently generated and imported", async () => {
  const fake = fakeRepository({});
  const generated: BenchmarkRunKind[] = [];
  const summary = await executeIeltsBenchmarks(
    {
      graderVersion: "evidence-adjudicated-v1",
      corpusVersion: 1,
      split: "holdout",
    },
    {
      repository: fake.repository,
      generator: stagedGenerator({
        async adjudication(runKind) {
          generated.push(runKind);
          return {
            prediction: writingPrediction,
            providerRequestId:
              runKind === "primary"
                ? "00000000-0000-4000-8000-000000000011"
                : "00000000-0000-4000-8000-000000000012",
          };
        },
      }),
    },
  );
  assert.deepEqual(generated, ["primary", "repeat"]);
  assert.deepEqual(fake.imported, ["primary", "repeat"]);
  assert.deepEqual(summary, {
    benchmarkCount: 1,
    providerCalls: 4,
    recoveredAttestedRuns: 0,
    alreadyRecordedRuns: 0,
    importedRuns: 2,
  });

  const rerun = await executeIeltsBenchmarks(
    {
      graderVersion: "evidence-adjudicated-v1",
      corpusVersion: 1,
      split: "holdout",
    },
    {
      repository: fake.repository,
      generator: stagedGenerator({
        async adjudication() {
          throw new Error("provider must not be called on an idempotent rerun");
        },
      }),
    },
  );
  assert.equal(rerun.providerCalls, 0);
  assert.equal(rerun.alreadyRecordedRuns, 2);
});

test("a signed provider audit is recovered after a crash before RPC import", async () => {
  const fake = fakeRepository({
    attested: {
      primary: {
        prediction: writingPrediction,
        providerRequestId: "00000000-0000-4000-8000-000000000021",
      },
    },
  });
  const generated: BenchmarkRunKind[] = [];
  const result = await executeIeltsBenchmarks(
    {
      graderVersion: "evidence-adjudicated-v1",
      corpusVersion: 1,
      split: "holdout",
    },
    {
      repository: fake.repository,
      generator: stagedGenerator({
        async adjudication(runKind) {
          generated.push(runKind);
          return {
            prediction: writingPrediction,
            providerRequestId: "00000000-0000-4000-8000-000000000022",
          };
        },
      }),
    },
  );
  assert.deepEqual(generated, ["repeat"]);
  assert.equal(result.recoveredAttestedRuns, 1);
  assert.equal(result.providerCalls, 2);
  assert.deepEqual(fake.imported, ["primary", "repeat"]);
});

test("a stale model-input hash fails before any provider call", async () => {
  const stale = benchmark({
    ...protectedInput(),
    modelInputSha256: "f".repeat(64),
  });
  const fake = fakeRepository({ cases: [stale] });
  let calls = 0;
  await assert.rejects(
    () =>
      executeIeltsBenchmarks(
        {
          graderVersion: "evidence-adjudicated-v1",
          corpusVersion: 1,
          split: "holdout",
        },
        {
          repository: fake.repository,
          generator: stagedGenerator({
            async adjudication() {
              calls += 1;
              return {
                prediction: writingPrediction,
                providerRequestId: "00000000-0000-4000-8000-000000000031",
              };
            },
          }),
        },
      ),
    /checksum mismatch/,
  );
  assert.equal(calls, 0);
});

test("an invalid model output is never imported", async () => {
  const fake = fakeRepository({});
  await assert.rejects(
    () =>
      executeIeltsBenchmarks(
        {
          graderVersion: "evidence-adjudicated-v1",
          corpusVersion: 1,
          split: "holdout",
        },
        {
          repository: fake.repository,
          generator: stagedGenerator({
            async adjudication() {
              return {
                prediction: { criteria: { taskResponse: { band: 6 } } },
                providerRequestId: "00000000-0000-4000-8000-000000000041",
              };
            },
          }),
        },
      ),
    /failed the scoring contract/,
  );
  assert.deepEqual(fake.imported, []);
});

test("an arbitrary provisional grader version cannot certify a release", async () => {
  const fake = fakeRepository({});
  await assert.rejects(
    () =>
      executeIeltsBenchmarks(
        {
          graderVersion: "provisional-v1",
          corpusVersion: 1,
          split: "holdout",
        },
        {
          repository: fake.repository,
          generator: stagedGenerator({
            async adjudication() {
              throw new Error("must not run");
            },
          }),
        },
      ),
    /locked benchmark grader/,
  );
});

test("an outcome-unknown claim never crosses the paid provider boundary", async () => {
  const fake = fakeRepository({ claimOutcome: "outcome_unknown" });
  let providerCalls = 0;
  await assert.rejects(
    () =>
      executeIeltsBenchmarks(
        {
          graderVersion: "evidence-adjudicated-v1",
          corpusVersion: 1,
          split: "holdout",
        },
        {
          repository: fake.repository,
          generator: stagedGenerator({
            async provisional() {
              providerCalls += 1;
              return {
                prediction: writingPrediction,
                providerRequestId: "00000000-0000-4000-8000-000000000051",
              };
            },
          }),
        },
      ),
    /outcome_unknown/,
  );
  assert.equal(providerCalls, 0);
});

test("audited 429 and 5xx failures release the stage for a bounded retry", async () => {
  for (const [index, responseStatus] of [429, 503].entries()) {
    const fake = fakeRepository({});
    const released: string[][] = [];
    fake.repository.failProvider = async ({ providerRequestIds }) => {
      released.push(providerRequestIds);
      return "retryable";
    };
    const providerRequestId = `00000000-0000-4000-8000-${String(700 + index).padStart(12, "0")}`;
    await assert.rejects(() =>
      executeIeltsBenchmarks(
        {
          graderVersion: "evidence-adjudicated-v1",
          corpusVersion: 1,
          split: "holdout",
        },
        {
          repository: fake.repository,
          generator: stagedGenerator({
            async provisional() {
              throw new AiExecutionError({
                message: `HTTP ${responseStatus}`,
                kind:
                  responseStatus === 429
                    ? "rate_limited"
                    : "provider_unavailable",
                attempts: [
                  {
                    provider: "groq",
                    model: "openai/gpt-oss-120b",
                    status: "error",
                    latencyMs: 5,
                    failureKind:
                      responseStatus === 429
                        ? "rate_limited"
                        : "provider_unavailable",
                    responseStatus,
                    providerRequestId,
                  },
                ],
              });
            },
          }),
        },
      ),
    );
    assert.deepEqual(released, [[providerRequestId]]);
  }
});

test("the exact database claim identity reaches provider audit metadata", async () => {
  const fake = fakeRepository({});
  const claim = {
    claimToken: "00000000-0000-4000-8000-000000000777",
    claimAttempt: 2,
  };
  fake.repository.claimRun = async () => ({ outcome: "claimed", ...claim });
  await assert.rejects(
    () =>
      executeIeltsBenchmarks(
        {
          graderVersion: "evidence-adjudicated-v1",
          corpusVersion: 1,
          split: "holdout",
        },
        {
          repository: fake.repository,
          generator: stagedGenerator({
            async provisional(_runKind, receivedClaim) {
              assert.deepEqual(receivedClaim, claim);
              throw new Error("claim identity observed");
            },
          }),
        },
      ),
    /claim identity observed/,
  );
});

test("the third definite failure exhausts without a fourth provider call", async () => {
  const fake = fakeRepository({});
  let claims = 0;
  let providerCalls = 0;
  let releases = 0;
  fake.repository.claimRun = async () => {
    if (claims >= 3) return { outcome: "exhausted" };
    claims += 1;
    return {
      outcome: "claimed",
      claimToken: `claim-${claims}`,
      claimAttempt: claims,
    };
  };
  fake.repository.failProvider = async () => {
    releases += 1;
    return releases >= 3 ? "exhausted" : "retryable";
  };
  const generator = stagedGenerator({
    async provisional() {
      providerCalls += 1;
      throw new AiExecutionError({
        message: "HTTP 503",
        kind: "provider_unavailable",
        attempts: [
          {
            provider: "groq",
            model: "openai/gpt-oss-120b",
            status: "error",
            latencyMs: 5,
            failureKind: "provider_unavailable",
            responseStatus: 503,
            providerRequestId: `00000000-0000-4000-8000-${String(800 + providerCalls).padStart(12, "0")}`,
          },
        ],
      });
    },
  });
  const run = {
    graderVersion: "evidence-adjudicated-v1",
    corpusVersion: 1,
    split: "holdout" as const,
  };
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await assert.rejects(() =>
      executeIeltsBenchmarks(run, {
        repository: fake.repository,
        generator,
      }),
    );
  }
  await assert.rejects(
    () =>
      executeIeltsBenchmarks(run, {
        repository: fake.repository,
        generator,
      }),
    /exhausted/,
  );
  assert.equal(providerCalls, 3);
  assert.equal(releases, 3);
});

test("a timeout after provider start remains outcome-unknown and is not repaid", async () => {
  const fake = fakeRepository({});
  let claims = 0;
  let providerCalls = 0;
  let releases = 0;
  fake.repository.claimRun = async () => {
    claims += 1;
    return claims === 1
      ? {
          outcome: "claimed",
          claimToken: "claim-timeout",
          claimAttempt: 1,
        }
      : { outcome: "outcome_unknown" };
  };
  fake.repository.failProvider = async () => {
    releases += 1;
    return "retryable";
  };
  const generator = stagedGenerator({
    async provisional() {
      providerCalls += 1;
      throw new AiExecutionError({
        message: "client deadline exceeded",
        kind: "deadline_exceeded",
        attempts: [
          {
            provider: "groq",
            model: "openai/gpt-oss-120b",
            status: "error",
            latencyMs: 35_000,
            failureKind: "deadline_exceeded",
            providerRequestId: "00000000-0000-4000-8000-000000000901",
          },
        ],
      });
    },
  });
  const run = {
    graderVersion: "evidence-adjudicated-v1",
    corpusVersion: 1,
    split: "holdout" as const,
  };
  await assert.rejects(() =>
    executeIeltsBenchmarks(run, {
      repository: fake.repository,
      generator,
    }),
  );
  await assert.rejects(
    () =>
      executeIeltsBenchmarks(run, {
        repository: fake.repository,
        generator,
      }),
    /outcome_unknown/,
  );
  assert.equal(providerCalls, 1);
  assert.equal(releases, 0);
});

test("concurrent executors cannot both cross the paid provider boundary", async () => {
  const fake = fakeRepository({});
  const held = new Set<string>();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const originalClaim = fake.repository.claimRun;
  fake.repository.claimRun = async (params) => {
    const key = `${params.runKind}:${params.pipelineStage}`;
    if (held.has(key)) return { outcome: "lease_active" };
    held.add(key);
    return originalClaim(params);
  };
  fake.repository.completeProvider = async ({ runKind, pipelineStage }) => {
    held.delete(`${runKind}:${pipelineStage}`);
  };
  let providerCalls = 0;
  const dependencies = {
    repository: fake.repository,
    generator: stagedGenerator({
      async provisional(runKind) {
        providerCalls += 1;
        if (runKind === "primary") await gate;
        return {
          prediction: writingPrediction,
          providerRequestId:
            runKind === "primary"
              ? "00000000-0000-4000-8000-000000000061"
              : "00000000-0000-4000-8000-000000000062",
        };
      },
    }),
  };
  const run = {
    graderVersion: "evidence-adjudicated-v1",
    corpusVersion: 1,
    split: "holdout" as const,
  };
  const first = executeIeltsBenchmarks(run, dependencies);
  await new Promise((resolve) => setImmediate(resolve));
  await assert.rejects(
    () => executeIeltsBenchmarks(run, dependencies),
    /lease_active/,
  );
  assert.equal(providerCalls, 1);
  release();
  await first;
});

test("secret or retrieval preflight failure happens before a stage is started", async () => {
  const fake = fakeRepository({});
  let starts = 0;
  fake.repository.startProvider = async () => {
    starts += 1;
  };
  await assert.rejects(
    () =>
      executeIeltsBenchmarks(
        {
          graderVersion: "evidence-adjudicated-v1",
          corpusVersion: 1,
          split: "holdout",
        },
        {
          repository: fake.repository,
          generator: stagedGenerator({
            async preflight() {
              throw new Error("Benchmark attestation is not configured");
            },
          }),
        },
      ),
    /attestation is not configured/,
  );
  assert.equal(starts, 0);
});

test("unconfigured production provider fails before a stage is started", async () => {
  const originalKey = process.env.GROQ_API_KEY;
  const fake = fakeRepository({});
  let starts = 0;
  fake.repository.startProvider = async () => {
    starts += 1;
  };
  try {
    delete process.env.GROQ_API_KEY;
    await assert.rejects(
      () =>
        executeIeltsBenchmarks(
          {
            graderVersion: "evidence-adjudicated-v1",
            corpusVersion: 1,
            split: "holdout",
          },
          {
            repository: fake.repository,
            generator: createProductionBenchmarkGenerator(),
          },
        ),
      /GROQ_API_KEY is not configured/,
    );
    assert.equal(starts, 0);
  } finally {
    if (originalKey === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = originalKey;
  }
});

test("a crash after provisional recovery resumes only adjudication", async () => {
  const fake = fakeRepository({});
  let provisionalEvidence: BenchmarkRunEvidence | null = null;
  let crash = true;
  let provisionalCalls = 0;
  let adjudicationCalls = 0;
  const originalFind = fake.repository.findAttestedRun;
  fake.repository.findAttestedRun = async (params) => {
    if (
      params.runKind === "primary" &&
      params.pipelineStage === "provisional" &&
      provisionalEvidence
    ) {
      return provisionalEvidence;
    }
    return originalFind(params);
  };
  fake.repository.completeProvider = async (params) => {
    if (
      params.runKind === "primary" &&
      params.pipelineStage === "provisional"
    ) {
      provisionalEvidence = {
        prediction: writingPrediction,
        providerRequestId: params.providerRequestId,
      };
    }
  };
  const generator = stagedGenerator({
    async provisional(runKind) {
      provisionalCalls += 1;
      return {
        prediction: writingPrediction,
        providerRequestId: `provisional-${runKind}`,
      };
    },
    async prepareAdjudication() {
      if (crash) {
        crash = false;
        throw new Error("simulated crash after provisional checkpoint");
      }
    },
    async adjudication(runKind) {
      adjudicationCalls += 1;
      return {
        prediction: writingPrediction,
        providerRequestId: `adjudicated-${runKind}`,
      };
    },
  });
  const run = {
    graderVersion: "evidence-adjudicated-v1",
    corpusVersion: 1,
    split: "holdout" as const,
  };
  await assert.rejects(
    () =>
      executeIeltsBenchmarks(run, {
        repository: fake.repository,
        generator,
      }),
    /simulated crash/,
  );
  await executeIeltsBenchmarks(run, {
    repository: fake.repository,
    generator,
  });
  // Primary provisional is recovered; only repeat pays for a new provisional.
  assert.equal(provisionalCalls, 2);
  assert.equal(adjudicationCalls, 2);
});

test("stage claims exclude only the concurrent matching pipeline stage", async () => {
  const fake = fakeRepository({});
  const active = new Set<string>();
  const claimed: string[] = [];
  fake.repository.claimRun = async ({ runKind, pipelineStage }) => {
    const key = `${runKind}:${pipelineStage}`;
    if (active.has(key)) return { outcome: "lease_active" };
    active.add(key);
    claimed.push(key);
    return { outcome: "claimed", claimToken: key, claimAttempt: 1 };
  };
  fake.repository.completeProvider = async ({ runKind, pipelineStage }) => {
    active.delete(`${runKind}:${pipelineStage}`);
  };
  await executeIeltsBenchmarks(
    {
      graderVersion: "evidence-adjudicated-v1",
      corpusVersion: 1,
      split: "holdout",
    },
    { repository: fake.repository, generator: stagedGenerator() },
  );
  assert.deepEqual(claimed, [
    "primary:provisional",
    "primary:adjudicated",
    "repeat:provisional",
    "repeat:adjudicated",
  ] satisfies Array<`${BenchmarkRunKind}:${BenchmarkPipelineStage}`>);
});
