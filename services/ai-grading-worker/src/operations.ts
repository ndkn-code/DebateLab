import type { Json } from "@/types/supabase";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  AiGradingFatalError,
  adjudicateIeltsSpeakingScore,
  adjudicateIeltsWritingScore,
  claimIeltsSpeakingScore,
  claimIeltsWritingScore,
  claimPracticeAnalysis,
  generateIeltsSpeakingScore,
  generateIeltsWritingScore,
  generatePracticeAnalysis,
  markPracticeWorkflowFailure,
  markSpeakingWorkflowFailure,
  markWritingWorkflowFailure,
  persistIeltsSpeakingScore,
  persistIeltsWritingScore,
  persistPracticeAnalysis,
  prepareIeltsSpeakingScore,
  prepareIeltsWritingScore,
  preparePracticeAnalysis,
  recomputeSpeakingAttempt,
  recomputeWritingAttempt,
  replanSpeakingAttempt,
  replanWritingAttempt,
} from "@/lib/ai/grading/steps";
import {
  buildSpeakingCriterionEvidence,
  buildWritingCriterionEvidence,
  IELTS_PROVISIONAL_EVIDENCE_VERSION,
} from "@/lib/ielts/criterion-evidence-contract";
import {
  createStagedGradingMetadata,
  IELTS_GRADING_VERSION,
  isIeltsEvidenceAdjudicationEnabled,
} from "@/lib/ielts/scoring-adjudication";
import { normalizeSpeakingScore } from "@/lib/scoring/ielts-speaking/normalize";
import { normalizeWritingScore } from "@/lib/scoring/ielts-writing/normalize";
import type { AiGradingJob } from "@/lib/ai/grading/contracts";
import type { AiGradingOperations, SourceClaim } from "./processor";

type PreparedPractice = Extract<
  Awaited<ReturnType<typeof preparePracticeAnalysis>>,
  { status: "prepared" }
>;
type PreparedSpeaking = Awaited<ReturnType<typeof prepareIeltsSpeakingScore>>;
type PreparedWriting = Awaited<ReturnType<typeof prepareIeltsWritingScore>>;
type SpeakingFinal = Awaited<ReturnType<typeof generateIeltsSpeakingScore>> & {
  gradingMetadata?: Json;
};
type WritingFinal = Awaited<ReturnType<typeof generateIeltsWritingScore>> & {
  gradingMetadata?: Json;
};

type PracticeOutput = {
  kind: "practice_analysis";
  feedback: Awaited<ReturnType<typeof generatePracticeAnalysis>>;
};

type SpeakingOutput = {
  kind: "ielts_speaking_score";
  final: SpeakingFinal;
  criterionEvidence: ReturnType<typeof buildSpeakingCriterionEvidence>;
};

type WritingOutput = {
  kind: "ielts_writing_score";
  final: WritingFinal;
  criterionEvidence: ReturnType<typeof buildWritingCriterionEvidence>;
};

function assertKind<T extends AiGradingJob["kind"]>(
  job: AiGradingJob,
  kind: T,
): asserts job is AiGradingJob & { kind: T } {
  if (job.kind !== kind)
    throw new AiGradingFatalError("AI grading kind mismatch");
}

async function practiceAttemptId(jobId: string): Promise<string> {
  const { data, error } = await createAdminClient()
    .from("analysis_jobs")
    .select("attempt_id")
    .eq("id", jobId)
    .maybeSingle();
  if (error) throw new Error(`load practice analysis source: ${error.message}`);
  if (!data?.attempt_id)
    throw new AiGradingFatalError("Practice analysis source no longer exists");
  return data.attempt_id;
}

function requirePrepared<T extends { status: string }>(value: T): T {
  if (value.status !== "prepared")
    throw new AiGradingFatalError(`AI grading preparation is ${value.status}`);
  return value;
}

function commonEvidenceContext(params: {
  job: AiGradingJob;
  workflowAttempt: number;
  result: {
    traceId: string;
    provider: string;
    model: string;
    attempts: unknown[];
    output: unknown;
  };
  stage: "provisional" | "adjudicated";
  gradingVersion: string;
  rubricVersion: string;
  promptVersion: string;
  confidence: number;
}) {
  return {
    stage: params.stage,
    gradingVersion: params.gradingVersion,
    traceId: params.result.traceId,
    runId: params.job.workflowRunId,
    provider: params.result.provider,
    model: params.result.model,
    rubricVersion: params.rubricVersion,
    promptVersion: params.promptVersion,
    confidence: params.confidence,
    workflowAttempt: params.workflowAttempt,
    providerAttempt: Math.max(1, params.result.attempts.length),
    validatedOutputSnapshot: params.result.output as Json,
  } as const;
}

export function createProductionOperations(): AiGradingOperations {
  return {
    runtimeIdentity(job, prepared) {
      const value = prepared as { baseCorpusVersion?: unknown };
      const corpusVersion = Number(value.baseCorpusVersion ?? 1);
      if (!Number.isInteger(corpusVersion) || corpusVersion <= 0) {
        throw new AiGradingFatalError("AI grading corpus version is invalid");
      }
      const runtimeRevision = process.env.K_REVISION?.trim();
      const imageDigest = process.env.AI_GRADING_IMAGE_DIGEST?.trim();
      if (!runtimeRevision || !/^[a-z][a-z0-9-]{0,62}$/.test(runtimeRevision)) {
        throw new AiGradingFatalError(
          "Operational grading requires a valid Cloud Run K_REVISION",
        );
      }
      if (!imageDigest || !/^sha256:[a-f0-9]{64}$/.test(imageDigest)) {
        throw new AiGradingFatalError(
          "Operational grading requires the deployed image SHA-256 digest",
        );
      }
      return {
        runtimeRevision,
        imageDigest,
        graderVersion:
          job.kind === "practice_analysis"
            ? "practice-grading-v1"
            : isIeltsEvidenceAdjudicationEnabled()
              ? IELTS_GRADING_VERSION
              : IELTS_PROVISIONAL_EVIDENCE_VERSION,
        corpusVersion,
      };
    },
    async claimSource(job): Promise<SourceClaim> {
      if (job.kind === "practice_analysis") {
        const result = await claimPracticeAnalysis({
          analysisJobId: job.sourceId,
          practiceAttemptId: await practiceAttemptId(job.sourceId),
        });
        if (result.status === "already_completed") return "already_completed";
        if (result.status === "terminal") return "terminal";
        return "claimed";
      }
      if (job.kind === "ielts_speaking_score") {
        const result = await claimIeltsSpeakingScore({
          speakingResponseId: job.sourceId,
        });
        return result.status === "already_scored"
          ? "already_completed"
          : "claimed";
      }
      const result = await claimIeltsWritingScore({
        writingResponseId: job.sourceId,
      });
      return result.status === "already_scored"
        ? "already_completed"
        : "claimed";
    },

    async prepare(job) {
      if (job.kind === "practice_analysis") {
        return requirePrepared(
          await preparePracticeAnalysis({
            workflowRunId: job.workflowRunId,
            analysisJobId: job.sourceId,
            practiceAttemptId: await practiceAttemptId(job.sourceId),
          }),
        );
      }
      if (job.kind === "ielts_speaking_score") {
        return prepareIeltsSpeakingScore({
          workflowRunId: job.workflowRunId,
          speakingResponseId: job.sourceId,
        });
      }
      return prepareIeltsWritingScore({
        workflowRunId: job.workflowRunId,
        writingResponseId: job.sourceId,
      });
    },

    async generate(job, prepared, context) {
      if (job.kind === "practice_analysis") {
        const value = prepared as PreparedPractice;
        assertKind(job, "practice_analysis");
        return {
          kind: "practice_analysis",
          feedback: await generatePracticeAnalysis({
            input: value.input,
            userId: value.userId,
          }),
        } satisfies PracticeOutput;
      }
      if (job.kind === "ielts_speaking_score") {
        const value = prepared as PreparedSpeaking;
        const provisional = await generateIeltsSpeakingScore({
          workflowRunId: job.workflowRunId,
          speakingResponseId: job.sourceId,
          userId: value.userId,
          prompt: value.prompt,
        });
        const final = isIeltsEvidenceAdjudicationEnabled()
          ? await adjudicateIeltsSpeakingScore({
              workflowRunId: job.workflowRunId,
              speakingResponseId: job.sourceId,
              userId: value.userId,
              questionId: value.questionId,
              questionType: value.questionType,
              retrievalQuery: value.retrievalQuery,
              prompt: value.prompt,
              provisionalOutput: provisional.output,
              provisionalTraceId: provisional.traceId,
              baseEvidence: value.baseEvidence,
              baseCorpusVersion: value.baseCorpusVersion,
              acousticEvidenceAvailable: value.acousticEvidenceAvailable,
            })
          : {
              ...provisional,
              gradingMetadata: createStagedGradingMetadata({
                evidence: value.baseEvidence,
                gradingVersion: IELTS_PROVISIONAL_EVIDENCE_VERSION,
                runId: job.workflowRunId,
                corpusVersion: value.baseCorpusVersion,
                provisionalTraceId: provisional.traceId,
                adjudicationTraceId: provisional.traceId,
                acousticEvidenceAvailable: value.acousticEvidenceAvailable,
                retrievalSkippedReason: "adjacent_band_adjudication_disabled",
              }) as unknown as Json,
            };
        const criterionEvidence = buildSpeakingCriterionEvidence({
          score: normalizeSpeakingScore(provisional.output),
          context: commonEvidenceContext({
            job,
            workflowAttempt: context.workflowAttempt,
            result: provisional,
            stage: "provisional",
            gradingVersion: IELTS_PROVISIONAL_EVIDENCE_VERSION,
            rubricVersion: "ielts-speaking-rubric-v1",
            promptVersion: "ielts_speaking_scorer@1",
            confidence: 0.5,
          }),
        });
        if (final.traceId !== provisional.traceId) {
          criterionEvidence.push(
            ...buildSpeakingCriterionEvidence({
              score: normalizeSpeakingScore(final.output),
              context: commonEvidenceContext({
                job,
                workflowAttempt: context.workflowAttempt,
                result: final,
                stage: "adjudicated",
                gradingVersion: IELTS_GRADING_VERSION,
                rubricVersion: "ielts-speaking-rubric-v1",
                promptVersion: "ielts_speaking_adjudication@1",
                confidence: 0.7,
              }),
            }),
          );
        }
        return {
          kind: "ielts_speaking_score",
          final,
          criterionEvidence,
        } satisfies SpeakingOutput;
      }

      const value = prepared as PreparedWriting;
      const provisional = await generateIeltsWritingScore({
        workflowRunId: job.workflowRunId,
        writingResponseId: job.sourceId,
        userId: value.userId,
        prompt: value.prompt,
      });
      const final = isIeltsEvidenceAdjudicationEnabled()
        ? await adjudicateIeltsWritingScore({
            workflowRunId: job.workflowRunId,
            writingResponseId: job.sourceId,
            userId: value.userId,
            questionId: value.questionId,
            questionType: value.questionType,
            retrievalQuery: value.retrievalQuery,
            prompt: value.prompt,
            provisionalOutput: provisional.output,
            provisionalTraceId: provisional.traceId,
            baseEvidence: value.baseEvidence,
            baseCorpusVersion: value.baseCorpusVersion,
          })
        : {
            ...provisional,
            gradingMetadata: createStagedGradingMetadata({
              evidence: value.baseEvidence,
              gradingVersion: IELTS_PROVISIONAL_EVIDENCE_VERSION,
              runId: job.workflowRunId,
              corpusVersion: value.baseCorpusVersion,
              provisionalTraceId: provisional.traceId,
              adjudicationTraceId: provisional.traceId,
              retrievalSkippedReason: "adjacent_band_adjudication_disabled",
            }) as unknown as Json,
          };
      const criterionEvidence = buildWritingCriterionEvidence({
        score: normalizeWritingScore(provisional.output),
        context: commonEvidenceContext({
          job,
          workflowAttempt: context.workflowAttempt,
          result: provisional,
          stage: "provisional",
          gradingVersion: IELTS_PROVISIONAL_EVIDENCE_VERSION,
          rubricVersion: "ielts-writing-rubric-v1",
          promptVersion: "ielts_writing_scorer@1",
          confidence: 0.5,
        }),
      });
      if (final.traceId !== provisional.traceId) {
        criterionEvidence.push(
          ...buildWritingCriterionEvidence({
            score: normalizeWritingScore(final.output),
            context: commonEvidenceContext({
              job,
              workflowAttempt: context.workflowAttempt,
              result: final,
              stage: "adjudicated",
              gradingVersion: IELTS_GRADING_VERSION,
              rubricVersion: "ielts-writing-rubric-v1",
              promptVersion: "ielts_writing_adjudication@1",
              confidence: 0.7,
            }),
          }),
        );
      }
      return {
        kind: "ielts_writing_score",
        final,
        criterionEvidence,
      } satisfies WritingOutput;
    },

    async persist(job, prepared, output) {
      if (job.kind === "practice_analysis") {
        const value = prepared as PreparedPractice;
        const generated = output as PracticeOutput;
        await persistPracticeAnalysis({
          workflowRunId: job.workflowRunId,
          jobId: value.jobId,
          attemptId: value.attemptId,
          feedback: generated.feedback,
        });
        return;
      }
      if (job.kind === "ielts_speaking_score") {
        const value = prepared as PreparedSpeaking;
        const generated = output as SpeakingOutput;
        await persistIeltsSpeakingScore({
          speakingResponseId: job.sourceId,
          attemptId: value.attemptId,
          userId: value.userId,
          transcript: value.transcript,
          sttProvider: value.sttProvider,
          phonemeReport: value.phonemeReport,
          output: generated.final.output,
          provider: generated.final.provider,
          model: generated.final.model,
          gradingMetadata: generated.final.gradingMetadata,
          criterionEvidence: generated.criterionEvidence,
        });
        return;
      }
      const value = prepared as PreparedWriting;
      const generated = output as WritingOutput;
      await persistIeltsWritingScore({
        writingResponseId: job.sourceId,
        attemptId: value.attemptId,
        userId: value.userId,
        output: generated.final.output,
        provider: generated.final.provider,
        model: generated.final.model,
        gradingMetadata: generated.final.gradingMetadata,
        criterionEvidence: generated.criterionEvidence,
      });
    },

    async afterPersist(job, prepared) {
      if (job.kind === "ielts_speaking_score") {
        const value = prepared as PreparedSpeaking;
        await recomputeSpeakingAttempt(value.attemptId, value.userId);
      } else if (job.kind === "ielts_writing_score") {
        const value = prepared as PreparedWriting;
        await recomputeWritingAttempt(value.attemptId, value.userId);
      }
    },

    async afterComplete(job, prepared) {
      if (job.kind === "ielts_speaking_score") {
        const value = prepared as PreparedSpeaking;
        await replanSpeakingAttempt({
          userId: value.userId,
          speakingResponseId: job.sourceId,
        });
      } else if (job.kind === "ielts_writing_score") {
        const value = prepared as PreparedWriting;
        await replanWritingAttempt({
          userId: value.userId,
          writingResponseId: job.sourceId,
        });
      }
    },

    async failSource(job, retryable, message) {
      if (job.kind === "practice_analysis") {
        if (!retryable) {
          await markPracticeWorkflowFailure({
            analysisJobId: job.sourceId,
            practiceAttemptId: await practiceAttemptId(job.sourceId),
            errorMessage: message,
          });
        }
      } else if (job.kind === "ielts_speaking_score") {
        await markSpeakingWorkflowFailure({
          speakingResponseId: job.sourceId,
          retryable,
        });
      } else {
        await markWritingWorkflowFailure({
          writingResponseId: job.sourceId,
          retryable,
        });
      }
    },
  };
}

export function isFatalAiGradingError(error: unknown): boolean {
  return error instanceof AiGradingFatalError;
}
