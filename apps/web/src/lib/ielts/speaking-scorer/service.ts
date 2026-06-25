import "server-only";

import { after } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getUserEntitlement } from "@/lib/entitlements";
import { parseInput } from "@/lib/api/boundary";
import { CreateSpeakingResponseSchema } from "@/lib/api/ielts/schema";
import { speakingPartNumberForQuestionType } from "@/lib/api/ielts/schema";
import { createPaymentRepository } from "@/lib/api/payments-repository";
import { meterFeature } from "@/lib/payments/meter";
import { METERED_FEATURES } from "@/lib/payments/metering";
import { createTypedAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/supabase";
import { normalizeSpeakingScore } from "@/lib/scoring/ielts-speaking/normalize";
import { transcribePracticeAudio } from "@/lib/stt/transcription";
import {
  assessPronunciation,
  azurePronunciationContentType,
} from "@/lib/ielts/pronunciation";
import { loadSpeakingExemplars } from "@/lib/corpus/ielts-speaking-exemplars";
import { recomputeAttemptSpeakingBand } from "@/lib/api/ielts/band-scores-repository";
import { maybeReplanAfterEvidence } from "@/lib/api/ielts/replan-hook";
import {
  claimSpeakingResponseForScoring,
  createSpeakingResponse,
  loadSpeakingScoringContext,
  markSpeakingScoringFailed,
  persistSpeakingScore,
} from "@/lib/api/ielts/speaking-responses-repository";
import { enqueueIeltsSpeakingScoring } from "@/lib/queues/ielts-speaking";
import {
  IELTS_SPEAKING_AUDIO_BUCKET,
  type IeltsSpeakingQueueMessage,
} from "./constants";
import { extractPronunciationSignal } from "./phoneme-contract";
import { buildSpeakingScorerPrompt } from "./prompt";
import { runSpeakingModel } from "./provider";
import {
  claimableSpeakingStatuses,
  decideSpeakingScoringAction,
  isTerminalSpeakingStatus,
} from "./status";

type TypedAdminClient = ReturnType<typeof createTypedAdminClient>;

/** Raised (HTTP 402) when the learner is over their metered scoring cap. */
export class SpeakingScoreLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SpeakingScoreLimitError";
  }
}

export interface SubmitSpeakingResponseResult {
  speakingResponseId: string;
  status: string;
  usage: { used: number; limit: number | null };
}

export function scheduleIeltsSpeakingScoringFallback(
  message: IeltsSpeakingQueueMessage,
  reason: "submit" | "poll",
): void {
  try {
    after(async () => {
      try {
        await runIeltsSpeakingScoringJob(message, { deliveryCount: 1 });
      } catch (error) {
        console.error("IELTS speaking fallback scoring failed", {
          speakingResponseId: message.speakingResponseId,
          reason,
          error,
        });
      }
    });
  } catch (error) {
    console.warn("IELTS speaking fallback could not be scheduled", {
      speakingResponseId: message.speakingResponseId,
      reason,
      error,
    });
  }
}

/**
 * Submit a recording for async scoring: meter the request (one unit per scoring
 * request, so over-cap users never queue work), persist the response via the
 * canonical create path, then enqueue the job (carrying any reported duration).
 */
export async function submitSpeakingResponseForScoring(params: {
  raw: unknown;
  userId: string;
  supabase: SupabaseClient;
}): Promise<SubmitSpeakingResponseResult> {
  // Reject a malformed body before consuming a metered unit (the canonical
  // create path re-validates + owns the authoritative parse + insert).
  const input = parseInput(CreateSpeakingResponseSchema, params.raw);

  const entitlement = await getUserEntitlement(params.supabase, params.userId);
  const usage = await meterFeature(
    createPaymentRepository(),
    params.userId,
    entitlement.planType,
    METERED_FEATURES.aiSpeakingScore,
    new Date(),
  );
  if (!usage.allowed) {
    throw new SpeakingScoreLimitError(
      `Monthly AI speaking-score limit reached (${usage.usedCount}/${usage.limitCount ?? "unlimited"}).`,
    );
  }

  const response = await createSpeakingResponse(params.raw, params.userId);
  const message = {
    speakingResponseId: response.id,
    userId: params.userId,
    durationSeconds: input.durationSeconds,
  };
  try {
    await enqueueIeltsSpeakingScoring(message);
  } catch (error) {
    scheduleIeltsSpeakingScoringFallback(message, "submit");
    console.error("IELTS speaking queue enqueue failed; fallback scheduled", {
      speakingResponseId: response.id,
      error,
    });
  }

  return {
    speakingResponseId: response.id,
    status: response.status,
    usage: { used: usage.usedCount, limit: usage.limitCount },
  };
}

function inferAudioContentType(path: string): string {
  if (/\.(m4a|mp4)$/i.test(path)) return "audio/mp4";
  if (/\.mp3$/i.test(path)) return "audio/mpeg";
  if (/\.wav$/i.test(path)) return "audio/wav";
  return "audio/webm";
}

async function downloadSpeakingAudio(
  admin: TypedAdminClient,
  audioStoragePath: string | null,
): Promise<{ audioBuffer: ArrayBuffer; contentType: string }> {
  if (!audioStoragePath) {
    throw new Error("Speaking response has no audio_storage_path to score.");
  }
  const { data, error } = await admin.storage
    .from(IELTS_SPEAKING_AUDIO_BUCKET)
    .download(audioStoragePath);
  if (error || !data) {
    throw new Error(
      `Failed to download speaking audio: ${error?.message ?? "no data"}`,
    );
  }
  return {
    audioBuffer: await data.arrayBuffer(),
    contentType: data.type || inferAudioContentType(audioStoragePath),
  };
}

/** Best-effort cue-card bullets from question metadata (Part 2). */
function extractCueCardBullets(metadata: Json): string[] | undefined {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return undefined;
  }
  const record = metadata as Record<string, Json>;
  const raw = record.cueCardBullets ?? record.bullets;
  if (!Array.isArray(raw)) return undefined;
  const bullets = raw
    .filter((item): item is string => typeof item === "string" && item.trim() !== "")
    .map((item) => item.trim());
  return bullets.length > 0 ? bullets : undefined;
}

/**
 * Score one Speaking response (async worker body). Reuses the practice-analysis
 * retry-guard for stale-reclaim + delivery caps via the typed `status` lifecycle
 * — throwing lets the queue redeliver; a terminal cap fails the response. The
 * audio is transcribed via the existing STT layer, then band-scored; nothing
 * touches the debate `analysis_jobs` path.
 */
export async function runIeltsSpeakingScoringJob(
  message: IeltsSpeakingQueueMessage,
  metadata: { deliveryCount: number },
): Promise<void> {
  const admin = createTypedAdminClient();
  const context = await loadSpeakingScoringContext(
    admin,
    message.speakingResponseId,
  );
  if (!context) return; // response gone → ack
  const { response, question } = context;
  if (isTerminalSpeakingStatus(response.status)) return; // already final

  const decision = decideSpeakingScoringAction({
    status: response.status,
    updatedAt: response.updated_at,
    queueDeliveryCount: metadata.deliveryCount,
  });
  if (decision.action === "fail") {
    await markSpeakingScoringFailed(admin, {
      speakingResponseId: response.id,
      retryable: false,
    });
    return;
  }
  if (decision.action === "skip") return;

  const claimed = await claimSpeakingResponseForScoring(admin, {
    speakingResponseId: response.id,
    allowedStatuses: claimableSpeakingStatuses(decision.allowedStatuses),
  });
  if (!claimed) return; // another worker won the claim

  try {
    const partNumber = speakingPartNumberForQuestionType(
      question.question_type,
    );
    const durationSeconds = message.durationSeconds ?? 0;
    const { audioBuffer, contentType } = await downloadSpeakingAudio(
      admin,
      response.audio_storage_path,
    );
    const transcription = await transcribePracticeAudio({
      audioBuffer,
      contentType,
      practiceLanguage: "en",
      audioBucket: IELTS_SPEAKING_AUDIO_BUCKET,
      audioStoragePath: response.audio_storage_path ?? "",
      durationSeconds,
      practiceTrack: "speaking",
    });

    // WS-3.3: generate the phoneme report from the audio + transcript. Env-gated
    // and never throws — without Azure creds it returns an EMPTY report, so the
    // Pronunciation criterion gracefully falls back to transcript-only judgement.
    // WS-5.2: capture uploads WAV PCM 16 kHz mono; map the content type to the
    // exact header Azure's REST assessment requires so a real report comes back.
    const pronunciation = await assessPronunciation({
      audio: audioBuffer,
      audioContentType: azurePronunciationContentType(contentType),
      referenceText: transcription.transcript,
      userId: response.user_id,
      speakingResponseId: response.id,
      practiceAttemptId: response.attempt_id,
    });

    const grounding = await loadSpeakingExemplars(admin, {
      questionId: question.id,
      questionType: question.question_type,
    });
    const prompt = buildSpeakingScorerPrompt({
      partNumber,
      questionType: question.question_type,
      questionPrompt: question.prompt,
      cueCardBullets: extractCueCardBullets(question.metadata),
      transcript: transcription.transcript,
      wordCount: transcription.wordCount,
      durationSeconds: durationSeconds > 0 ? durationSeconds : null,
      sttWarnings: transcription.warnings,
      feedbackLanguage: response.feedback_language === "vi" ? "vi" : "en",
      grounding,
      pronunciation: extractPronunciationSignal(pronunciation.report),
    });
    const result = await runSpeakingModel({
      prompt,
      audit: { userId: response.user_id, speakingResponseId: response.id },
    });
    await persistSpeakingScore(admin, {
      speakingResponseId: response.id,
      transcript: transcription.transcript,
      sttProvider: transcription.provider,
      score: normalizeSpeakingScore(result.output),
      providerLabel: result.providerLabel,
      modelName: result.modelName,
      phonemeReport: pronunciation.report as unknown as Json,
    });
    await recomputeAttemptSpeakingBand(
      admin,
      response.attempt_id,
      response.user_id,
    );
    // WS-6.2.4: adapt the learner's future plan to the new Speaking band
    // (best-effort; never throws, so scoring/redelivery is unaffected).
    await maybeReplanAfterEvidence({
      client: admin,
      userId: response.user_id,
      trigger: "speaking_scored",
      source: { type: "speaking_response", id: response.id },
    });
  } catch (error) {
    await markSpeakingScoringFailed(admin, {
      speakingResponseId: response.id,
      retryable: true,
    }).catch(() => {});
    throw error; // queue redelivers; retry-guard caps + fails terminally
  }
}
