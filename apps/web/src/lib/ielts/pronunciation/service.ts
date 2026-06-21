/**
 * Azure Speech pronunciation assessment (WS-3.3) — the typed entry point the
 * Speaking scorer (WS-3.2) calls. Takes the recorded answer + reference text and
 * returns a typed {@link PhonemeReport} plus a suggested 0–9 Pronunciation band.
 *
 * Contract guarantees:
 *  - NEVER throws and is fully env-gated. When Azure creds are absent, the audio
 *    is empty, or the call fails, it returns a `skipped` / `error` outcome
 *    carrying the EMPTY report, so the caller can persist `.report`
 *    unconditionally. Phoneme detail augments the Pronunciation criterion; it is
 *    never required.
 *  - Each attempt is logged into `ai_provider_requests` as an external provider
 *    call (cost / latency). User-facing metering of the speaking-scoring feature
 *    belongs to WS-3.2 (one meter per scoring request) to avoid double-charging.
 *
 * The network / DB / clock seams are injectable so the orchestration is
 * unit-tested without hitting Azure or Supabase.
 */
import {
  recordAiProviderRequest,
  type AiProviderRequestInput,
} from "@/lib/ai/provider-requests";
import { mapAzureAssessmentToReport } from "@/lib/scoring/ielts-pronunciation/azure-assessment";
import {
  EMPTY_PHONEME_REPORT,
  type PhonemeReport,
} from "@/lib/scoring/ielts-pronunciation/phoneme-report";
import { derivePronunciationBand } from "@/lib/scoring/ielts-pronunciation/pronunciation-band";
import { getAzureSpeechConfig, type AzureSpeechConfig } from "./config";
import { buildAssessmentRequest } from "./request";
import {
  AZURE_PRONUNCIATION_MODEL,
  AZURE_PRONUNCIATION_PROVIDER,
  DEFAULT_PRONUNCIATION_LOCALE,
  PRONUNCIATION_OUTPUT_TYPE,
  PRONUNCIATION_SOURCE_ROUTE,
} from "./constants";

export interface AssessPronunciationInput {
  audio: ArrayBuffer | Uint8Array;
  /** e.g. `audio/wav; codecs=audio/pcm; samplerate=16000`. */
  audioContentType: string;
  /** Transcript or expected answer the speech is scored against. */
  referenceText: string;
  locale?: string;
  userId?: string | null;
  speakingResponseId?: string | null;
  practiceAttemptId?: string | null;
  analysisJobId?: string | null;
}

export type SkipReason = "not_configured" | "missing_audio" | "missing_reference";

export type AssessPronunciationOutcome =
  | {
      status: "ok";
      report: PhonemeReport;
      pronunciationBand: number | null;
      providerRequestId: string | null;
    }
  | { status: "skipped"; reason: SkipReason; report: PhonemeReport }
  | { status: "error"; reason: string; report: PhonemeReport };

/** Injectable seams so the orchestration is unit-tested without network/DB/clock. */
export interface AssessPronunciationDeps {
  fetchImpl: typeof fetch;
  getConfig: () => AzureSpeechConfig | null;
  recordRequest: (input: AiProviderRequestInput) => Promise<string | null>;
  now: () => number;
  logger: Pick<Console, "info" | "warn">;
}

const defaultDeps: AssessPronunciationDeps = {
  fetchImpl: (...args) => fetch(...args),
  getConfig: getAzureSpeechConfig,
  recordRequest: (input) => recordAiProviderRequest(input),
  now: () => Date.now(),
  logger: console,
};

interface LogArgs {
  input: AssessPronunciationInput;
  locale: string;
  status: "success" | "error";
  latencyMs: number;
  responseStatus?: number;
  errorCode?: string;
  errorMessage?: string;
  overall?: PhonemeReport["overall"];
  pronunciationBand?: number | null;
}

function buildLog(args: LogArgs): AiProviderRequestInput {
  const { input } = args;
  return {
    provider: AZURE_PRONUNCIATION_PROVIDER,
    model: AZURE_PRONUNCIATION_MODEL,
    status: args.status,
    sourceRoute: PRONUNCIATION_SOURCE_ROUTE,
    outputType: PRONUNCIATION_OUTPUT_TYPE,
    userId: input.userId ?? null,
    responseStatus: args.responseStatus ?? null,
    latencyMs: args.latencyMs,
    errorCode: args.errorCode ?? null,
    errorMessage: args.errorMessage ?? null,
    practiceAttemptId: input.practiceAttemptId ?? null,
    analysisJobId: input.analysisJobId ?? null,
    metadata: {
      speakingResponseId: input.speakingResponseId ?? null,
      locale: args.locale,
      audioBytes: input.audio.byteLength,
      audioContentType: input.audioContentType,
      ...(args.overall ? { overall: args.overall } : {}),
      ...(args.pronunciationBand != null
        ? { pronunciationBand: args.pronunciationBand }
        : {}),
    },
  };
}

async function safeText(response: Response): Promise<string> {
  try {
    return (await response.text()).slice(0, 1000);
  } catch {
    return "";
  }
}

function logSkip(
  logger: AssessPronunciationDeps["logger"],
  reason: SkipReason,
  input: AssessPronunciationInput,
): void {
  logger.info("IELTS pronunciation assessment skipped", {
    reason,
    speakingResponseId: input.speakingResponseId ?? null,
    practiceAttemptId: input.practiceAttemptId ?? null,
    audioBytes: input.audio?.byteLength ?? 0,
    hasReferenceText: input.referenceText.trim().length > 0,
  });
}

function skip(
  reason: SkipReason,
  input: AssessPronunciationInput,
  logger: AssessPronunciationDeps["logger"],
): AssessPronunciationOutcome {
  logSkip(logger, reason, input);
  return { status: "skipped", reason, report: EMPTY_PHONEME_REPORT };
}

/**
 * Assess pronunciation for one speaking answer. Always resolves (never rejects):
 * `ok` with the report + suggested band, `skipped` when it cannot run, or
 * `error` when Azure fails — every outcome carries a valid `report`.
 */
export async function assessPronunciation(
  input: AssessPronunciationInput,
  deps: Partial<AssessPronunciationDeps> = {},
): Promise<AssessPronunciationOutcome> {
  const { fetchImpl, getConfig, recordRequest, now, logger } = {
    ...defaultDeps,
    ...deps,
  };

  const config = getConfig();
  if (!config) return skip("not_configured", input, logger);
  if (!input.audio || input.audio.byteLength === 0) {
    return skip("missing_audio", input, logger);
  }
  const referenceText = input.referenceText.trim();
  if (!referenceText) return skip("missing_reference", input, logger);

  const locale = input.locale ?? DEFAULT_PRONUNCIATION_LOCALE;
  const request = buildAssessmentRequest({
    config,
    audio: input.audio,
    audioContentType: input.audioContentType,
    params: { referenceText, locale },
  });

  const startedAt = now();
  try {
    const response = await fetchImpl(request.url, {
      method: "POST",
      headers: request.headers,
      body: request.body as BodyInit,
    });
    const latencyMs = now() - startedAt;

    if (!response.ok) {
      await recordRequest(
        buildLog({
          input,
          locale,
          status: "error",
          latencyMs,
          responseStatus: response.status,
          errorCode: "azure_http_error",
          errorMessage: await safeText(response),
        }),
      );
      return {
        status: "error",
        reason: `azure_http_${response.status}`,
        report: EMPTY_PHONEME_REPORT,
      };
    }

    const report = mapAzureAssessmentToReport(await response.json(), {
      locale,
      provider: AZURE_PRONUNCIATION_PROVIDER,
      model: AZURE_PRONUNCIATION_MODEL,
      referenceText,
    });

    if (report.status !== "scored") {
      await recordRequest(
        buildLog({
          input,
          locale,
          status: "error",
          latencyMs,
          responseStatus: response.status,
          errorCode: "azure_no_assessment",
          errorMessage: "Azure returned no usable pronunciation assessment",
        }),
      );
      return {
        status: "error",
        reason: "azure_no_assessment",
        report: EMPTY_PHONEME_REPORT,
      };
    }

    const pronunciationBand = derivePronunciationBand(report);
    const providerRequestId = await recordRequest(
      buildLog({
        input,
        locale,
        status: "success",
        latencyMs,
        responseStatus: response.status,
        overall: report.overall,
        pronunciationBand,
      }),
    );
    return { status: "ok", report, pronunciationBand, providerRequestId };
  } catch (error) {
    logger.warn("IELTS pronunciation assessment request failed", {
      speakingResponseId: input.speakingResponseId ?? null,
      practiceAttemptId: input.practiceAttemptId ?? null,
      error: error instanceof Error ? error.message : String(error),
    });
    await recordRequest(
      buildLog({
        input,
        locale,
        status: "error",
        latencyMs: now() - startedAt,
        errorCode: "azure_request_failed",
        errorMessage: error instanceof Error ? error.message : String(error),
      }),
    ).catch(() => null);
    return {
      status: "error",
      reason: "azure_request_failed",
      report: EMPTY_PHONEME_REPORT,
    };
  }
}
