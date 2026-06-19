import { createHash } from "node:crypto";
import type {
  DebateArgumentBreakdown,
  DebateClashLink,
  DebateScore,
  NoteTakingFeedback,
  PracticeActionStep,
  ShadowExample,
  TranscriptAnnotation,
} from "@/types/feedback";
import type {
  DebateMemory,
  DebateDuelJudgment,
  DebateRound,
  MotionBrief,
  PracticeLanguage,
  PracticeTrack,
} from "@/types";
import {
  getDuelJudgeProvider,
  getPracticeFeedbackProvider,
  getPracticeJudgeFallbackProvider,
  getProviderLabel,
} from "@/lib/ai/provider-selection";
import type { AiQualityTelemetry } from "@/lib/ai/quality-model";
import type { PracticeTranscriptionArtifact } from "@thinkfy/shared/practice";
import { buildAnalysisPrompt, buildDuelJudgmentPrompt } from "./prompts";
import { recordAiProviderRequest } from "./ai/provider-requests";
import {
  buildFuzzyEvidenceHintBlock,
  buildTruongTeenJudgingPromptAddendum,
  shouldUseTruongTeenPrompt,
} from "./truong-teen/debate-dna";
import { normalizeDebateDuelClashLinks } from "./debate-duels/clash-links";
import {
  getRoundSpeaker,
  getRoundText,
  normalizeDebateClashLinks,
  normalizeDebateVerdict,
} from "./feedback/debate-review";
import { normalizeTranscriptAnnotationsForFeedback } from "./feedback/annotations";
import {
  getDebateFeedbackDepthTarget,
  isFeedbackBelowDepthTarget,
  normalizeScoreRationale,
} from "./feedback/depth";
import { truncateNotesForPrompt } from "./practice-notes";
import { needsVietnameseProseRepair } from "./feedback/language-repair";
import {
  classifyGeminiError,
  getGeminiClientForSlot,
  getGeminiKeyCountForTelemetry,
  getGeminiKeyCooldowns,
  runWithGeminiKeyPool,
  selectGeminiKeyAttempts,
} from "./gemini/key-pool";
import { getPostHogServer } from "./posthog-server";
import { buildSttJudgeGuardrailBlock } from "./stt/prompt";

function getGeminiClient() {
  const [attempt] = selectGeminiKeyAttempts("legacy-gemini-client");
  return getGeminiClientForSlot(attempt.slot);
}

async function loadDeepSeekChatCompletion() {
  return (await import("@/lib/ai/deepseek")).createDeepSeekChatCompletion;
}

type DeepSeekAnalysisPromptParams = {
  transcript: string;
  topic: string;
  side: "proposition" | "opposition";
  speechType: string;
  timeLimit: number;
  actualDuration: number;
  practiceTrack?: PracticeTrack;
  practiceLanguage?: PracticeLanguage;
  isFullRound?: boolean;
  rounds?: DebateRound[];
  motionBrief?: MotionBrief;
  debateMemory?: DebateMemory | null;
  corpusContext?: string;
  transcription?: PracticeTranscriptionArtifact | null;
  prepNotes?: string | null;
};

function buildDeepSeekAnalysisPromptPrefix(
  params: DeepSeekAnalysisPromptParams
) {
  if (params.practiceTrack === "speaking") {
    return buildAnalysisPrompt(params);
  }

  const language =
    params.practiceLanguage === "vi"
      ? "Write all user-facing prose in natural Vietnamese with diacritics. Keep JSON keys and enum literals in English."
      : "Write all user-facing prose in natural English. Keep JSON keys and enum literals in English.";
  const useTruongTeenPrompt = shouldUseTruongTeenPrompt({
    practiceLanguage: params.practiceLanguage,
    practiceTrack: params.practiceTrack ?? "debate",
  });
  const truongTeenJudgingContext = useTruongTeenPrompt
    ? buildTruongTeenJudgingPromptAddendum()
    : "";

  return `You are Thinkfy's strict debate feedback engine.

## Task
Judge the student's debate performance and return one valid JSON object only.
Practice format: Trường Teen-style 1v1 practice debate. Use WSDC-style principles for clash, mechanism, weighing, and impact.
${language}
${truongTeenJudgingContext}

## Scoring Calibration
- Score the student/user only. The AI may win the debate while the student still receives a fair skill score.
- If the student loses because of repetition, weak evidence, unclear structure, or failure to answer the main clash, totalScore should usually be below 65.
- Content above 25/40 requires mechanisms, examples, and weighing.
- Structure above 17/25 requires clear development across speeches, not repeated claims.
- Language above 18/25 requires mostly clear wording despite speech-to-text errors.
- Persuasion above 7/10 requires direct comparison of worlds and why the student's side wins.
- Do not reward sympathy for the student's side unless the speech proves it.
- If a Judge Verdict draft is provided, preserve its winner, confidence, totalScore, category score totals, and deciding logic unless it violates the numeric schema.

## Required JSON Shape
{
  "content": {"score": 0-40, "claimClarity": 0-10, "evidenceSupport": 0-10, "logicCoherence": 0-10, "counterArgument": 0-10},
  "structure": {"score": 0-25, "introduction": 0-8, "bodyOrganization": 0-9, "conclusion": 0-8},
  "language": {"score": 0-25, "vocabulary": 0-8, "grammar": 0-8, "fluency": 0-9},
  "persuasion": {"score": 0-10, "audienceAwareness": 0-5, "impactfulness": 0-5},
  "totalScore": sum of the four category scores,
  "overallBand": "Novice" | "Developing" | "Competent" | "Proficient" | "Expert",
  "summary": "2-4 sentence judge summary",
  "strengths": ["3 specific strengths"],
  "improvements": ["3 specific improvements"],
  "sampleArguments": ["2 improved argument examples"],
  "noteTakingFeedback": null | {"summary": "how notes helped", "whatHelped": ["2 specifics"], "missedOpportunities": ["1-3 missed note targets"], "nextSessionTemplate": ["2-4 note template lines"]},
  "improvementPlan": [{"title": "beginner drill", "whyItMatters": "why", "howToPractice": "specific next action", "shadowExample": "sentence to shadow", "timeBoxSeconds": 90}],
  "shadowExamples": [{"label": "short label", "before": "optional weak version", "after": "stronger sentence to shadow", "why": "why it works"}],
  "practiceTrack": "debate",
  "practiceLanguage": "${params.practiceLanguage ?? "en"}",
  "caseSummary": "student case in one sentence",
  "stanceFeedback": "stance and burden feedback",
  "argumentBreakdowns": [
    {"name": "argument/clash name", "summary": "what happened", "whatWorked": "specific", "missingLayer": "specific", "betterVersion": "stronger version"}
  ],
  "missingLayers": ["3 missing layers"],
  "weighingFeedback": "how the student weighed or failed to weigh",
  "clashFeedback": "how the student handled direct clash",
  "strongerRebuilds": ["2 stronger rebuilds"],
  "transcriptAnnotations": [
    {"quote": "exact short quote from transcript", "roundNumber": 1, "speaker": "user" | "ai", "tag": "stance|clarity|mechanism|evidence|logic|rebuttal|clash|weighing|impact|structure|delivery", "severity": "strength|improvement|warning", "feedback": "judge read", "suggestion": "specific next step"}
  ],
  "debateVerdict": {"winner": "user" | "ai" | "tie", "confidence": 0-1, "summary": "why", "decidingReasons": ["3 reasons"], "nextMove": "next drill"},
  "clashLinks": [
    {"id": "clash-1", "sourceRoundNumber": 1, "sourceSpeaker": "user" | "ai", "responseRoundNumber": 2 or null, "responseSpeaker": "user" | "ai" or null, "sourceQuote": "exact quote", "responseQuote": "exact quote or null", "outcome": "answered|dropped|misanswered|turned|weighed", "judgeRead": "what the judge thinks", "suggestion": "how to improve", "tag": "clash|rebuttal|weighing|logic|evidence"}
  ],
  "scoreRationale": {
    "overall": "strict rationale",
    "content": {"score": 0-40, "maxScore": 40, "rationale": "why", "whyNotHigher": "cap reason", "nextStep": "next action"},
    "structure": {"score": 0-25, "maxScore": 25, "rationale": "why", "whyNotHigher": "cap reason", "nextStep": "next action"},
    "language": {"score": 0-25, "maxScore": 25, "rationale": "why", "whyNotHigher": "cap reason", "nextStep": "next action"},
    "persuasion": {"score": 0-10, "maxScore": 10, "rationale": "why", "whyNotHigher": "cap reason", "nextStep": "next action"}
  },
  "detailedFeedback": {"contentFeedback": "specific", "structureFeedback": "specific", "languageFeedback": "specific", "persuasionFeedback": "specific"}
}

For full rounds, include at least 3 argumentBreakdowns, 4 transcriptAnnotations, and 3 clashLinks.
Always include 2-3 beginner-friendly improvementPlan items and 2-3 shadowExamples.
If Prep Notes are provided in the dynamic context, fill noteTakingFeedback by comparing notes to the transcript. If no notes are provided, set noteTakingFeedback to null.
Annotation rules:
- transcriptAnnotations.quote must be an exact short quote from the supplied transcript.
- Never use the motion title, greetings, filler, or a generic opening as an annotation quote.
- Anchor feedback about a concept to a quote that contains that concept or its immediate argumentative context.
- If feedback discusses survival bias, anchor to a sentence containing "ngụy biện kẻ sống sót", "survival bias", or the equivalent idea.
- If you cannot find a faithful quote, omit that annotation instead of inventing one.
JSON only.`;
}

function buildDeepSeekAnalysisDynamicContext(
  params: DeepSeekAnalysisPromptParams,
  verdictDraft?: unknown
) {
  const useTruongTeenPrompt = shouldUseTruongTeenPrompt({
    practiceLanguage: params.practiceLanguage,
    practiceTrack: params.practiceTrack ?? "debate",
  });
  const rounds = params.rounds?.length
    ? params.rounds
        .map((round) => {
          const speaker = round.type === "ai-rebuttal" ? "ai" : "user";
          const text = round.transcript || round.aiResponse || "";
          return `[${round.roundNumber}. ${round.label} | ${speaker}]\n${text}`;
        })
        .join("\n\n")
    : params.transcript;
  const evidenceHintContext = useTruongTeenPrompt
    ? buildFuzzyEvidenceHintBlock([
        params.transcript,
        ...(params.rounds?.map(
          (round) => round.transcript || round.aiResponse || ""
        ) ?? []),
      ])
    : "";
  const motionBrief = params.motionBrief
    ? `Key terms: ${params.motionBrief.keyTerms.join("; ")}
Scope: ${params.motionBrief.scope}
Proposition burden: ${params.motionBrief.propositionBurden}
Opposition burden: ${params.motionBrief.oppositionBurden}
Model note: ${params.motionBrief.modelClarification}`
    : "No motion brief provided.";
  const debateMemory = params.debateMemory
    ? `AI side: ${params.debateMemory.aiSide}
Student side: ${params.debateMemory.studentSide}
AI model/policy: ${params.debateMemory.policyModel}
Prior AI claims: ${params.debateMemory.priorAiClaims.join("; ") || "none"}
Active clashes: ${params.debateMemory.activeClashes.join("; ") || "none"}
Dropped claims: ${params.debateMemory.droppedClaims.join("; ") || "none"}`
    : "No debate memory provided.";
  const sttGuardrail = buildSttJudgeGuardrailBlock(params.transcription);
  const prepNotes = truncateNotesForPrompt(params.prepNotes);
  const prepNotesContext = prepNotes
    ? `Prep Notes:\n${prepNotes}`
    : "Prep Notes: none saved. Set noteTakingFeedback to null.";

  return `## Dynamic Debate Context
Motion: ${params.topic}
Student side: ${params.side}
Speech type: ${params.speechType}
Full round: ${Boolean(params.isFullRound)}
Time setting: ${params.timeLimit} minutes
Actual duration: ${params.actualDuration} seconds
${prepNotesContext}
${sttGuardrail}
${params.corpusContext ?? ""}

## Motion Brief
${motionBrief}

## Debate Memory
${debateMemory}

## Transcript
${rounds}
${evidenceHintContext}

## Judge Verdict To Preserve
${verdictDraft ? JSON.stringify(verdictDraft) : "No prior verdict draft."}`;
}

function buildCompactDeepSeekAnalysisPrompt(
  params: DeepSeekAnalysisPromptParams,
  verdictDraft?: unknown
) {
  return `${buildDeepSeekAnalysisPromptPrefix(params)}

${buildDeepSeekAnalysisDynamicContext(params, verdictDraft)}`;
}

function buildDeepSeekAnalysisMessages(
  params: DeepSeekAnalysisPromptParams,
  verdictDraft?: unknown
) {
  const prefix = buildDeepSeekAnalysisPromptPrefix(params);
  const messages = [
    {
      role: "system" as const,
      content:
        "You are Thinkfy's AI feedback engine. Return only valid JSON matching the requested schema.",
    },
    { role: "user" as const, content: prefix },
    {
      role: "user" as const,
      content: buildDeepSeekAnalysisDynamicContext(params, verdictDraft),
    },
  ];
  return {
    messages,
    promptPrefixHash: createHash("sha256")
      .update(`${messages[0].content}\n\n${messages[1].content}`)
      .digest("hex"),
  };
}

type AnalyzeDebateParams = {
  transcript: string;
  topic: string;
  side: "proposition" | "opposition";
  speechType: string;
  timeLimit: number;
  actualDuration: number;
  practiceTrack?: PracticeTrack;
  practiceLanguage?: PracticeLanguage;
  isFullRound?: boolean;
  rounds?: DebateRound[];
  motionBrief?: MotionBrief;
  debateMemory?: DebateMemory | null;
  corpusContext?: string;
  transcription?: PracticeTranscriptionArtifact | null;
  prepNotes?: string | null;
  providerAudit?: {
    sourceRoute?: string;
    practiceAttemptId?: string;
    analysisJobId?: string;
    metadata?: Record<string, unknown>;
    stagedGeminiCache?: StagedGeminiCache;
    onStagedGeminiCacheEntry?: (
      entry: StagedGeminiCacheEntry
    ) => void | Promise<void>;
  };
};

type AiTelemetryCallback = (telemetry: AiQualityTelemetry) => void | Promise<void>;

type GeminiUsageMetadata = {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  totalTokenCount?: number;
};

type GeminiStageResult = {
  stage: string;
  text: string;
  latencyMs: number;
  usage?: GeminiUsageMetadata;
  keySlot?: number;
  keyFallbackCount?: number;
  providerRequestId?: string | null;
  cacheHit?: boolean;
};

export type StagedGeminiStageName =
  | "speech_map"
  | "verdict_feedback"
  | "annotation_anchor";

export type StagedGeminiCacheEntry = {
  schemaVersion: 1;
  stage: StagedGeminiStageName;
  modelName: string;
  promptHash: string;
  text: string;
  latencyMs: number;
  usage?: GeminiUsageMetadata;
  keySlot?: number | null;
  keyFallbackCount?: number | null;
  providerRequestId?: string | null;
  createdAt: string;
};

export type StagedGeminiCache = Partial<
  Record<StagedGeminiStageName, StagedGeminiCacheEntry>
>;

type StagedDebateSpeechMap = {
  speechMap?: Array<{
    roundNumber: number;
    label: string;
    speaker: "user" | "ai";
    mainClaims: string[];
    responses: string[];
    evidence: string[];
    strategicNotes: string;
  }>;
  macroClashes?: Array<{
    id: string;
    name: string;
    studentPosition: string;
    aiPosition: string;
    judgeRead: string;
    studentMissingResponse?: string;
  }>;
  judgingFocus?: string[];
};

type StagedAnnotationPayload = {
  transcriptAnnotations?: TranscriptAnnotation[];
};

function shouldUseStagedFullRoundJudge(params: AnalyzeDebateParams) {
  return (
    process.env.PRACTICE_FULL_ROUND_STAGED_JUDGE_ENABLED !== "false" &&
    params.practiceTrack !== "speaking" &&
    Boolean(params.isFullRound)
  );
}

function shouldFallbackPracticeJudgeToDeepSeek(error: unknown) {
  if (getPracticeJudgeFallbackProvider() !== "deepseek") {
    return false;
  }

  const kind = classifyGeminiError(error);
  if (
    kind === "rate_limit" ||
    kind === "service_unavailable" ||
    kind === "access_denied"
  ) {
    return true;
  }

  const message = error instanceof Error ? error.message : String(error);
  return (
    /timeout|timed out|network|fetch failed|socket|connection|econnreset/i.test(
      message
    ) ||
    /invalid response structure from gemini|gemini returned malformed json|could not find json in gemini output/i.test(
      message
    )
  );
}

function getStagedFullRoundJudgeModelName() {
  return (
    process.env.GEMINI_FULL_ROUND_JUDGE_MODEL ||
    process.env.GEMINI_FLASH_LITE_MODEL ||
    "gemini-3.1-flash-lite"
  );
}

function getPracticeDeepSeekTimeoutMs(fallbackFromGemini: boolean) {
  const configured = Number(
    fallbackFromGemini
      ? process.env.PRACTICE_DEEPSEEK_FALLBACK_TIMEOUT_MS
      : process.env.PRACTICE_DEEPSEEK_TIMEOUT_MS
  );
  if (Number.isFinite(configured) && configured >= 5_000) {
    return Math.min(configured, 60_000);
  }
  return fallbackFromGemini ? 45_000 : 30_000;
}

async function emitAiTelemetry(
  onTelemetry: AiTelemetryCallback | undefined,
  telemetry: AiQualityTelemetry
) {
  if (!onTelemetry) return;
  await onTelemetry(telemetry);
}

async function recordGeminiProviderRequest(params: {
  model: string;
  status: "success" | "error";
  sourceRoute?: string | null;
  outputType?: string | null;
  userId?: string | null;
  latencyMs?: number | null;
  usage?: GeminiUsageMetadata | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  practiceAttemptId?: string | null;
  analysisJobId?: string | null;
  debateSessionId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  return recordAiProviderRequest({
    provider: "google",
    model: params.model,
    status: params.status,
    sourceRoute: params.sourceRoute,
    outputType: params.outputType,
    userId: params.userId,
    latencyMs: params.latencyMs,
    usage: {
      inputTokens: params.usage?.promptTokenCount,
      outputTokens: params.usage?.candidatesTokenCount,
      totalTokens: params.usage?.totalTokenCount,
    },
    errorCode: params.errorCode,
    errorMessage: params.errorMessage,
    practiceAttemptId: params.practiceAttemptId,
    analysisJobId: params.analysisJobId,
    debateSessionId: params.debateSessionId,
    metadata: params.metadata,
  });
}

export async function analyzeDebate(
  params: AnalyzeDebateParams,
  userId?: string,
  onTelemetry?: AiTelemetryCallback
): Promise<DebateScore> {
  if (shouldUseStagedFullRoundJudge(params)) {
    return analyzeFullRoundDebateWithStagedGemini(params, userId, onTelemetry);
  }

  try {
    return await analyzeDebateWithGemini(params, userId, onTelemetry);
  } catch (error) {
    if (!shouldFallbackPracticeJudgeToDeepSeek(error)) {
      throw error;
    }

    if (process.env.NODE_ENV === "development") {
      console.warn(
        "Gemini practice judge failed; falling back to DeepSeek:",
        error instanceof Error ? error.message : error
      );
    }
  }

  return analyzeDebateWithDeepSeek(params, userId, onTelemetry, {
    fallbackFromGemini: true,
  });
}

function parseJsonObject<T>(text: string, sourceLabel: string): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error(`Invalid response: could not find JSON in ${sourceLabel}`);
    }
    return JSON.parse(jsonMatch[0]) as T;
  }
}

async function generateGeminiStage(params: {
  modelName: string;
  stage: string;
  prompt: string;
  maxOutputTokens: number;
  temperature?: number;
  keySeed?: string;
  audit?: {
    userId?: string | null;
    sourceRoute?: string | null;
    outputType?: string | null;
    practiceAttemptId?: string | null;
    analysisJobId?: string | null;
    debateSessionId?: string | null;
    metadata?: Record<string, unknown>;
  };
}): Promise<GeminiStageResult> {
  const seed = params.keySeed ?? `${params.modelName}:${params.stage}`;
  return runWithGeminiKeyPool({
    seed,
    run: async (attempt) => {
      const model = getGeminiClientForSlot(attempt.slot).getGenerativeModel({
        model: params.modelName,
        generationConfig: {
          responseMimeType: "application/json",
          temperature: params.temperature ?? 0.25,
          maxOutputTokens: params.maxOutputTokens,
        },
      });
      const startTime = Date.now();
      const result = await model.generateContent(params.prompt);
      const latencyMs = Date.now() - startTime;
      const providerRequestId = await recordGeminiProviderRequest({
        model: params.modelName,
        status: "success",
        sourceRoute: params.audit?.sourceRoute,
        outputType: params.audit?.outputType,
        userId: params.audit?.userId,
        latencyMs,
        usage: result.response.usageMetadata,
        practiceAttemptId: params.audit?.practiceAttemptId,
        analysisJobId: params.audit?.analysisJobId,
        debateSessionId: params.audit?.debateSessionId,
        metadata: {
          stage: params.stage,
          keySlot: attempt.slot,
          keyFallbackCount: attempt.fallbackCount,
          keyCooldownSkippedCount: attempt.skippedCooldownCount,
          keyCooldownSkippedSlots: attempt.skippedCooldownSlots,
          maxOutputTokens: params.maxOutputTokens,
          temperature: params.temperature ?? 0.25,
          ...(params.audit?.metadata ?? {}),
        },
      });
      return {
        stage: params.stage,
        text: result.response.text(),
        latencyMs,
        usage: result.response.usageMetadata,
        keySlot: attempt.slot,
        keyFallbackCount: attempt.fallbackCount,
        providerRequestId,
      };
    },
    onError: async (error, attempt, cooldown) => {
      await recordGeminiProviderRequest({
        model: params.modelName,
        status: "error",
        sourceRoute: params.audit?.sourceRoute,
        outputType: params.audit?.outputType,
        userId: params.audit?.userId,
        latencyMs: null,
        errorCode: (() => {
          const kind = classifyGeminiError(error);
          if (kind === "rate_limit") return "RATE_LIMIT_OR_QUOTA";
          if (kind === "service_unavailable") return "GEMINI_SERVICE_UNAVAILABLE";
          if (kind === "access_denied") return "GEMINI_ACCESS_DENIED";
          return "GEMINI_REQUEST_FAILED";
        })(),
        errorMessage: error instanceof Error ? error.message : String(error),
        practiceAttemptId: params.audit?.practiceAttemptId,
        analysisJobId: params.audit?.analysisJobId,
        debateSessionId: params.audit?.debateSessionId,
        metadata: {
          stage: params.stage,
          keySlot: attempt.slot,
          keyFallbackCount: attempt.fallbackCount,
          keyCooldownSkippedCount: attempt.skippedCooldownCount,
          keyCooldownSkippedSlots: attempt.skippedCooldownSlots,
          geminiErrorKind: classifyGeminiError(error),
          keyCooldownUntil: cooldown?.until ?? null,
          activeKeyCooldowns: getGeminiKeyCooldowns().map((item) => ({
            slot: item.slot,
            reason: item.reason,
            until: item.until,
            failureCount: item.failureCount,
          })),
          maxOutputTokens: params.maxOutputTokens,
          temperature: params.temperature ?? 0.25,
          ...(params.audit?.metadata ?? {}),
        },
      });
    },
  });
}

function summarizeGeminiStages(stages: GeminiStageResult[]) {
  return {
    latencyMs: stages.reduce((sum, stage) => sum + stage.latencyMs, 0),
    inputTokens: stages.reduce(
      (sum, stage) => sum + (stage.usage?.promptTokenCount ?? 0),
      0
    ),
    outputTokens: stages.reduce(
      (sum, stage) => sum + (stage.usage?.candidatesTokenCount ?? 0),
      0
    ),
    totalTokens: stages.reduce(
      (sum, stage) => sum + (stage.usage?.totalTokenCount ?? 0),
      0
    ),
    stageLatencies: Object.fromEntries(
      stages.map((stage) => [stage.stage, stage.latencyMs])
    ),
    stageUsage: Object.fromEntries(
      stages.map((stage) => [
        stage.stage,
        {
          inputTokens: stage.usage?.promptTokenCount ?? null,
          outputTokens: stage.usage?.candidatesTokenCount ?? null,
          totalTokens: stage.usage?.totalTokenCount ?? null,
        },
      ])
    ),
    stageKeySlots: Object.fromEntries(
      stages.map((stage) => [
        stage.stage,
        {
          keySlot: stage.keySlot ?? null,
          keyFallbackCount: stage.keyFallbackCount ?? 0,
        },
      ])
    ),
    stageCacheHits: Object.fromEntries(
      stages.map((stage) => [stage.stage, Boolean(stage.cacheHit)])
    ),
  };
}

function readCachedGeminiStage(params: {
  cache?: StagedGeminiCache;
  stage: StagedGeminiStageName;
  modelName: string;
  promptHash: string;
}): GeminiStageResult | null {
  const cached = params.cache?.[params.stage];
  if (
    !cached ||
    cached.schemaVersion !== 1 ||
    cached.stage !== params.stage ||
    cached.modelName !== params.modelName ||
    cached.promptHash !== params.promptHash ||
    !cached.text
  ) {
    return null;
  }

  return {
    stage: cached.stage,
    text: cached.text,
    latencyMs: cached.latencyMs,
    usage: cached.usage,
    keySlot: cached.keySlot ?? undefined,
    keyFallbackCount: cached.keyFallbackCount ?? undefined,
    providerRequestId: cached.providerRequestId,
    cacheHit: true,
  };
}

async function generateCachedGeminiStage(params: {
  modelName: string;
  stage: StagedGeminiStageName;
  prompt: string;
  promptHash: string;
  maxOutputTokens: number;
  temperature?: number;
  keySeed?: string;
  cache?: StagedGeminiCache;
  onCacheEntry?: (entry: StagedGeminiCacheEntry) => void | Promise<void>;
  audit?: Parameters<typeof generateGeminiStage>[0]["audit"];
}) {
  const cached = readCachedGeminiStage({
    cache: params.cache,
    stage: params.stage,
    modelName: params.modelName,
    promptHash: params.promptHash,
  });
  if (cached) return cached;

  const stageResult = await generateGeminiStage({
    modelName: params.modelName,
    stage: params.stage,
    prompt: params.prompt,
    maxOutputTokens: params.maxOutputTokens,
    temperature: params.temperature,
    keySeed: params.keySeed,
    audit: params.audit,
  });
  const cacheEntry: StagedGeminiCacheEntry = {
    schemaVersion: 1,
    stage: params.stage,
    modelName: params.modelName,
    promptHash: params.promptHash,
    text: stageResult.text,
    latencyMs: stageResult.latencyMs,
    usage: stageResult.usage,
    keySlot: stageResult.keySlot ?? null,
    keyFallbackCount: stageResult.keyFallbackCount ?? null,
    providerRequestId: stageResult.providerRequestId ?? null,
    createdAt: new Date().toISOString(),
  };
  await params.onCacheEntry?.(cacheEntry);
  return stageResult;
}

function buildStagedFullRoundBaseContext(
  params: AnalyzeDebateParams,
  options: {
    includeCorpus?: boolean;
    includeTruongTeenRubric?: boolean;
    includeSttGuardrail?: boolean;
  } = {}
) {
  const language =
    params.practiceLanguage === "vi"
      ? "Write all user-facing coaching prose in natural Vietnamese with diacritics. Keep JSON keys and enum literals in English."
      : "Write all user-facing coaching prose in natural English. Keep JSON keys and enum literals in English.";
  const useTruongTeenPrompt = shouldUseTruongTeenPrompt({
    practiceLanguage: params.practiceLanguage,
    practiceTrack: params.practiceTrack ?? "debate",
  });
  const truongTeenJudgingContext = useTruongTeenPrompt
    ? buildTruongTeenJudgingPromptAddendum()
    : "";
  const scopedParams: AnalyzeDebateParams = {
    ...params,
    corpusContext: options.includeCorpus ? params.corpusContext : "",
    transcription: options.includeSttGuardrail === false ? null : params.transcription,
  };
  return `You are Thinkfy's staged full-round debate judge.
${language}
Judge only the student's/user's skill and whether the user beat the AI opponent in this practice round.
Be strict about mechanism, clash, weighing, and strategic adaptation.
Do not penalize likely speech-to-text spelling artifacts unless the meaning remains unclear after context.
${options.includeTruongTeenRubric === false ? "" : truongTeenJudgingContext}

${buildDeepSeekAnalysisDynamicContext(scopedParams)}`;
}

function buildSpeechMapPrompt(params: AnalyzeDebateParams) {
  return `${buildStagedFullRoundBaseContext(params, {
    includeCorpus: false,
    includeTruongTeenRubric: false,
  })}

## Stage 1 Task: Speech Map And Clash Extraction
Extract the debate structure before judging. Do not score yet.

Return JSON only:
{
  "speechMap": [
    {
      "roundNumber": 1,
      "label": "round label",
      "speaker": "user" | "ai",
      "mainClaims": ["claim names with short mechanisms"],
      "responses": ["direct responses/rebuttals made in this round"],
      "evidence": ["evidence/examples/statistics mentioned"],
      "strategicNotes": "what this speech changes in the debate"
    }
  ],
  "macroClashes": [
    {
      "id": "clash-1",
      "name": "short clash name",
      "studentPosition": "student's side on this clash",
      "aiPosition": "AI/opponent side on this clash",
      "judgeRead": "who is ahead and why",
      "studentMissingResponse": "what the student failed to answer, or empty string"
    }
  ],
  "judgingFocus": ["2-5 issues the final judge must prioritize"]
}`;
}

function buildStagedVerdictPrompt(
  params: AnalyzeDebateParams,
  speechMap: StagedDebateSpeechMap
) {
  return `${buildStagedFullRoundBaseContext(params, {
    includeCorpus: true,
    includeTruongTeenRubric: true,
  })}

## Stage 1 Output To Use
${JSON.stringify(speechMap)}

## Stage 2 Task: Verdict, Scores, And Coaching
Use the speech map and transcript to produce the full Thinkfy debate feedback JSON.

Important:
- Decide debateVerdict.winner as "user", "ai", or "tie".
- Include 3-5 argumentBreakdowns and 3-5 clashLinks.
- Set transcriptAnnotations to [] in this stage. A separate quote-anchoring stage will fill them.
- Keep scores strict and internally consistent. totalScore must equal the four category scores.
- Include noteTakingFeedback when prep notes are present; otherwise set it to null.
- Include 2-3 beginner-friendly improvementPlan items and 2-3 shadowExamples.
- Preserve Vietnamese user-facing prose when practiceLanguage is vi.

Return this JSON shape only:
{
  "content": {"claimClarity": 0, "evidenceSupport": 0, "logicCoherence": 0, "counterArgument": 0, "score": 0},
  "structure": {"introduction": 0, "bodyOrganization": 0, "conclusion": 0, "score": 0},
  "language": {"vocabulary": 0, "grammar": 0, "fluency": 0, "score": 0},
  "persuasion": {"audienceAwareness": 0, "impactfulness": 0, "score": 0},
  "totalScore": 0,
  "overallBand": "Novice" | "Developing" | "Competent" | "Proficient" | "Expert",
  "practiceTrack": "debate",
  "practiceLanguage": "${params.practiceLanguage ?? "en"}",
  "summary": "2-4 sentence judge summary",
  "strengths": ["3 specific strengths"],
  "improvements": ["3 specific improvements"],
  "sampleArguments": ["2-3 stronger argument examples"],
  "noteTakingFeedback": null | {"summary": "how notes helped", "whatHelped": ["2 specifics"], "missedOpportunities": ["1-3 missed note targets"], "nextSessionTemplate": ["2-4 note template lines"]},
  "improvementPlan": [{"title": "beginner drill", "whyItMatters": "why", "howToPractice": "specific next action", "shadowExample": "sentence to shadow", "timeBoxSeconds": 90}],
  "shadowExamples": [{"label": "short label", "before": "optional weak version", "after": "stronger sentence to shadow", "why": "why it works"}],
  "caseSummary": "student case in one sentence",
  "stanceFeedback": "burden and stance feedback",
  "argumentBreakdowns": [
    {"name": "argument/clash name", "summary": "what happened", "whatWorked": "specific", "missingLayer": "specific", "betterVersion": "stronger version"}
  ],
  "missingLayers": ["3 missing layers"],
  "weighingFeedback": "how the student weighed or failed to weigh",
  "clashFeedback": "how the student handled direct clash",
  "strongerRebuilds": ["2-3 stronger rebuilds"],
  "transcriptAnnotations": [],
  "debateVerdict": {"winner": "user" | "ai" | "tie", "confidence": 0.0, "summary": "why", "decidingReasons": ["3 reasons"], "nextMove": "next drill"},
  "clashLinks": [
    {"id": "clash-1", "sourceRoundNumber": 1, "sourceSpeaker": "user" | "ai", "responseRoundNumber": 2, "responseSpeaker": "user" | "ai", "sourceQuote": "exact quote", "responseQuote": "exact quote or null", "outcome": "answered" | "dropped" | "misanswered" | "turned" | "weighed", "judgeRead": "judge read", "suggestion": "next step", "tag": "clash" | "rebuttal" | "weighing" | "logic" | "evidence"}
  ],
  "scoreRationale": {
    "overall": "strict rationale",
    "content": {"score": 0, "maxScore": 40, "rationale": "why", "whyNotHigher": "cap reason", "nextStep": "next action"},
    "structure": {"score": 0, "maxScore": 25, "rationale": "why", "whyNotHigher": "cap reason", "nextStep": "next action"},
    "language": {"score": 0, "maxScore": 25, "rationale": "why", "whyNotHigher": "cap reason", "nextStep": "next action"},
    "persuasion": {"score": 0, "maxScore": 10, "rationale": "why", "whyNotHigher": "cap reason", "nextStep": "next action"}
  },
  "detailedFeedback": {"contentFeedback": "specific", "structureFeedback": "specific", "languageFeedback": "specific", "persuasionFeedback": "specific"}
}`;
}

function buildStagedAnnotationPrompt(
  params: AnalyzeDebateParams,
  speechMap: StagedDebateSpeechMap,
  feedback: DebateScore
) {
  const depthTarget = getDebateFeedbackDepthTarget({
    isFullRound: params.isFullRound,
    actualDuration: params.actualDuration,
    roundCount: params.rounds?.length ?? 0,
  });
  const annotationRange =
    params.isFullRound && depthTarget.minAnnotations >= 10
      ? "8-10"
      : params.isFullRound
        ? "6-8"
        : "4-6";
  const annotationTargets = {
    debateVerdict: feedback.debateVerdict,
    argumentBreakdowns: feedback.argumentBreakdowns,
    clashLinks: feedback.clashLinks,
    scoreRationale: feedback.scoreRationale,
    improvements: feedback.improvements,
  };
  return `${buildStagedFullRoundBaseContext(params, {
    includeCorpus: false,
    includeTruongTeenRubric: false,
    includeSttGuardrail: true,
  })}

## Stage 1 Speech Map
${JSON.stringify(speechMap)}

## Stage 2 Feedback To Anchor
${JSON.stringify(annotationTargets)}

## Stage 3 Task: Transcript Annotation Anchoring
Find exact transcript quotes that support the most important feedback.

Rules:
- Return ${annotationRange} high-signal annotations.
- quote must be an exact contiguous quote copied from the transcript or a round.
- Never use the motion title, greetings, filler, or generic opening as the quote.
- If feedback talks about a specific flaw, quote the sentence containing that flaw or its immediate context.
- Do not duplicate the same sentence or anchor multiple cards on the same generic claim.
- Do not truncate quotes mid-sentence; choose a shorter exact phrase from the same sentence if needed.
- Prefer user quotes; include AI quotes only when showing a dropped/misanswered clash.
- If exact matching is hard, choose a shorter exact quote.

Return JSON only:
{
  "transcriptAnnotations": [
    {
      "quote": "exact short quote",
      "roundNumber": 1,
      "speaker": "user" | "ai",
      "tag": "stance" | "clarity" | "mechanism" | "evidence" | "logic" | "rebuttal" | "clash" | "weighing" | "impact" | "structure" | "delivery",
      "severity": "strength" | "improvement" | "warning",
      "feedback": "why this quote matters to a judge",
      "suggestion": "specific rewrite or next step"
    }
  ]
}`;
}

type DepthCompletionMetadata = {
  used: boolean;
  argumentBreakdownsBefore: number;
  argumentBreakdownsAfter: number;
  clashLinksBefore: number;
  clashLinksAfter: number;
  scoreCapApplied: boolean;
  scoreBefore: number;
  scoreAfter: number;
  scoreCapReasons: string[];
};

function splitRoundSentences(text: string) {
  return Array.from(text.matchAll(/[^.!?。！？\n]+[.!?。！？]?/g))
    .map((match) => match[0].replace(/\s+/g, " ").trim())
    .filter((sentence) => sentence.split(/\s+/).length >= 5)
    .filter((sentence) => sentence.length <= 280);
}

function pickQuoteFromRound(
  round: DebateRound | undefined,
  hints: string[] = []
) {
  if (!round) return "";
  const text = getRoundText(round);
  const normalizedHints = hints
    .join(" ")
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length >= 4);
  const scored = splitRoundSentences(text)
    .map((sentence) => {
      const normalized = sentence.toLowerCase();
      const hintScore = normalizedHints.reduce(
        (score, hint) => score + (normalized.includes(hint) ? 2 : 0),
        0
      );
      const signalScore =
        /(cơ chế|tác động|bằng chứng|phản biện|clash|so sánh|weigh|vì sao|dẫn đến|\d|%)/i.test(
          sentence
        )
          ? 2
          : 0;
      return {
        sentence,
        score: hintScore + signalScore + (sentence.length >= 45 ? 1 : 0),
      };
    })
    .sort((left, right) => right.score - left.score);
  return scored[0]?.sentence ?? "";
}

function getRoundBySpeaker(
  rounds: DebateRound[] | undefined,
  speaker: "user" | "ai",
  startAfterRound = 0
) {
  return rounds?.find(
    (round) =>
      getRoundSpeaker(round) === speaker && round.roundNumber > startAfterRound
  );
}

function createFallbackArgumentBreakdown(
  clash: NonNullable<StagedDebateSpeechMap["macroClashes"]>[number],
  params: AnalyzeDebateParams,
  index: number
): DebateArgumentBreakdown {
  const vi = params.practiceLanguage === "vi";
  return {
    name: clash.name?.trim() || (vi ? `Trục va chạm ${index + 1}` : `Clash ${index + 1}`),
    summary:
      clash.judgeRead?.trim() ||
      (vi
        ? `Hai bên va chạm quanh ${clash.studentPosition || "một điểm tranh chấp chính"}.`
        : `Both sides clashed over ${clash.studentPosition || "a core issue"}.`),
    whatWorked:
      clash.studentPosition?.trim() ||
      (vi
        ? "Bạn có đặt được một hướng phản hồi có liên quan đến trục chính."
        : "You did engage a relevant part of the main clash."),
    missingLayer:
      clash.studentMissingResponse?.trim() ||
      (vi
        ? "Phần này vẫn cần thêm cơ chế và cân tác động trực tiếp với phản biện của AI."
        : "This still needs clearer mechanism and direct weighing against the AI response."),
    betterVersion: vi
      ? "Chốt lại trục này bằng ba bước: đối tượng bị tác động, cơ chế gây ra tác động, rồi vì sao tác động đó lớn hơn hoặc khó đảo ngược hơn thế giới đối phương."
      : "Close this clash in three steps: affected group, mechanism of harm/benefit, then why that impact is larger or harder to reverse than the opponent's world.",
  };
}

function createFallbackClashLink(
  clash: NonNullable<StagedDebateSpeechMap["macroClashes"]>[number],
  params: AnalyzeDebateParams,
  index: number
): DebateClashLink | null {
  const rounds = params.rounds ?? [];
  const sourceRound =
    getRoundBySpeaker(rounds, "ai") ?? getRoundBySpeaker(rounds, "user");
  if (!sourceRound) return null;
  const responseRound =
    getRoundBySpeaker(rounds, "user", sourceRound.roundNumber) ??
    getRoundBySpeaker(rounds, "user");
  const hints = [
    clash.name,
    clash.studentPosition,
    clash.aiPosition,
    clash.studentMissingResponse,
  ].filter(Boolean) as string[];
  const sourceQuote = pickQuoteFromRound(sourceRound, hints);
  if (!sourceQuote) return null;
  const responseQuote =
    responseRound && responseRound.roundNumber !== sourceRound.roundNumber
      ? pickQuoteFromRound(responseRound, hints)
      : "";
  const vi = params.practiceLanguage === "vi";
  const sourceSpeaker = getRoundSpeaker(sourceRound);
  const responseSpeaker = responseRound ? getRoundSpeaker(responseRound) : null;

  return {
    id: `deterministic-clash-${index + 1}`,
    sourceRoundNumber: sourceRound.roundNumber,
    sourceSpeaker,
    responseRoundNumber: responseQuote && responseRound ? responseRound.roundNumber : null,
    responseSpeaker: responseQuote ? responseSpeaker : null,
    sourceQuote,
    responseQuote: responseQuote || null,
    outcome: responseQuote
      ? clash.studentMissingResponse
        ? "misanswered"
        : "answered"
      : "dropped",
    judgeRead:
      clash.judgeRead?.trim() ||
      (vi
        ? "Đây là trục va chạm cần được xử lý rõ hơn trong phần chốt trận."
        : "This clash needed clearer treatment in the final weighing."),
    suggestion:
      clash.studentMissingResponse?.trim() ||
      (vi
        ? "Hãy trả lời trực tiếp cơ chế của đối phương trước khi mở rộng tác động của phe mình."
        : "Answer the opponent's mechanism directly before extending your own impact."),
    tag: "clash",
  };
}

function distributeScore(total: number, maxes: number[]) {
  const maxTotal = maxes.reduce((sum, max) => sum + max, 0);
  let remaining = Math.max(0, Math.min(total, maxTotal));
  return maxes.map((max, index) => {
    if (index === maxes.length - 1) return Math.min(max, remaining);
    const value = Math.min(max, Math.round((total * max) / maxTotal));
    remaining -= value;
    return value;
  });
}

function bandForScore(score: number): DebateScore["overallBand"] {
  if (score >= 90) return "Expert";
  if (score >= 80) return "Proficient";
  if (score >= 65) return "Competent";
  if (score >= 50) return "Developing";
  return "Novice";
}

function applyScoreCap(
  feedback: DebateScore,
  cap: number,
  reasons: string[],
  params: { practiceLanguage?: PracticeLanguage }
) {
  if (feedback.totalScore <= cap) return false;
  const scoreBefore = feedback.totalScore;
  const [content, structure, language, persuasion] = distributeScore(cap, [
    40,
    25,
    25,
    10,
  ]);
  const [claimClarity, evidenceSupport, logicCoherence, counterArgument] =
    distributeScore(content, [10, 10, 10, 10]);
  const [introduction, bodyOrganization, conclusion] = distributeScore(
    structure,
    [8, 9, 8]
  );
  const [vocabulary, grammar, fluency] = distributeScore(language, [8, 8, 9]);
  const [audienceAwareness, impactfulness] = distributeScore(persuasion, [5, 5]);

  feedback.content = {
    score: content,
    claimClarity,
    evidenceSupport,
    logicCoherence,
    counterArgument,
  };
  feedback.structure = { score: structure, introduction, bodyOrganization, conclusion };
  feedback.language = { score: language, vocabulary, grammar, fluency };
  feedback.persuasion = { score: persuasion, audienceAwareness, impactfulness };
  feedback.totalScore = content + structure + language + persuasion;
  feedback.overallBand = bandForScore(feedback.totalScore);

  const vi = params.practiceLanguage === "vi";
  const readableReasons = reasons.map((reason) => {
    if (!vi) return reason;
    return (
      {
        "fewer than 3 model-produced clash links":
          "phản hồi ban đầu có dưới 3 liên kết va chạm do mô hình tự tạo",
        "fewer than 3 model-produced argument breakdowns":
          "phản hồi ban đầu có dưới 3 phần bóc tách luận điểm do mô hình tự tạo",
        "annotation fallback was needed":
          "hệ thống phải tự bổ sung một phần chú thích vì mô hình neo dẫn chứng chưa đủ chắc",
        "stt uncertainty remains in judge transcript":
          "bản chép lời vẫn có tín hiệu không chắc chắn từ STT",
        "missing impact weighing":
          "bài nói chưa cân tác động đủ rõ",
        "missing clash response coverage":
          "bài nói chưa trả lời đủ trực tiếp các trục va chạm",
        "shallow argument coverage":
          "phần bóc tách luận điểm còn mỏng",
      }[reason] ?? reason
    );
  });
  const capNote = vi
    ? `Điểm được giới hạn mềm vì: ${readableReasons.join("; ")}.`
    : `Score softly capped because: ${readableReasons.join("; ")}.`;
  feedback.scoreRationale = {
    overall: `${feedback.scoreRationale?.overall ?? feedback.summary} ${capNote}`.trim(),
    content: {
      score: content,
      maxScore: 40,
      rationale: feedback.scoreRationale?.content?.rationale ?? feedback.detailedFeedback.contentFeedback,
      whyNotHigher: feedback.scoreRationale?.content?.whyNotHigher ?? capNote,
      nextStep: feedback.scoreRationale?.content?.nextStep ?? (vi ? "Đào sâu cơ chế và bằng chứng cho từng trục chính." : "Deepen mechanism and evidence for each main clash."),
    },
    structure: {
      score: structure,
      maxScore: 25,
      rationale: feedback.scoreRationale?.structure?.rationale ?? feedback.detailedFeedback.structureFeedback,
      whyNotHigher: feedback.scoreRationale?.structure?.whyNotHigher ?? capNote,
      nextStep: feedback.scoreRationale?.structure?.nextStep ?? (vi ? "Gom bài nói thành các trục va chạm rõ ràng hơn." : "Group the speech around clearer clash axes."),
    },
    language: {
      score: language,
      maxScore: 25,
      rationale: feedback.scoreRationale?.language?.rationale ?? feedback.detailedFeedback.languageFeedback,
      whyNotHigher: feedback.scoreRationale?.language?.whyNotHigher ?? capNote,
      nextStep: feedback.scoreRationale?.language?.nextStep ?? (vi ? "Giữ câu ngắn, rõ chủ thể và động từ." : "Keep sentences shorter with clear subjects and verbs."),
    },
    persuasion: {
      score: persuasion,
      maxScore: 10,
      rationale: feedback.scoreRationale?.persuasion?.rationale ?? feedback.detailedFeedback.persuasionFeedback,
      whyNotHigher: feedback.scoreRationale?.persuasion?.whyNotHigher ?? capNote,
      nextStep: feedback.scoreRationale?.persuasion?.nextStep ?? (vi ? "Chốt vì sao thế giới của bạn thắng trên xác suất, quy mô và mức độ nghiêm trọng." : "Close why your world wins on probability, scale, and severity."),
    },
  };

  const previousCalibration = feedback.scoreCalibrationMetadata;
  const mergedReasons = Array.from(
    new Set([...(previousCalibration?.scoreCapReasons ?? []), ...reasons])
  );
  const originalScoreBefore = previousCalibration?.scoreBefore ?? scoreBefore;
  feedback.scoreCalibrationMetadata = {
    scoreCapApplied: true,
    scoreBefore: originalScoreBefore,
    scoreAfter: feedback.totalScore,
    scoreDelta: feedback.totalScore - originalScoreBefore,
    scoreCapReasons: mergedReasons,
  };

  return true;
}

function hasImpactWeighingSignal(feedback: DebateScore) {
  const prose = [
    feedback.weighingFeedback,
    feedback.clashFeedback,
    feedback.scoreRationale?.persuasion?.rationale,
    feedback.scoreRationale?.persuasion?.whyNotHigher,
    ...(feedback.improvements ?? []),
    ...(feedback.missingLayers ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const annotationSignal = (feedback.transcriptAnnotations ?? []).some(
    (annotation) => annotation.tag === "impact" || annotation.tag === "weighing"
  );
  const clashSignal = (feedback.clashLinks ?? []).some(
    (clash) => clash.outcome === "weighed" || clash.tag === "weighing"
  );
  return (
    annotationSignal ||
    clashSignal ||
    /(impact|weigh|weighing|tác động|cân|so sánh|quy mô|xác suất|mức độ nghiêm trọng)/i.test(
      prose
    )
  );
}

function hasClashResponseCoverage(feedback: DebateScore) {
  const clashLinks = feedback.clashLinks ?? [];
  if (clashLinks.length === 0) return false;
  return clashLinks.some((clash) =>
    ["answered", "turned", "weighed"].includes(clash.outcome)
  );
}

function applyVietnameseDebateSoftCaps(
  feedback: DebateScore,
  params: {
    practiceTrack?: PracticeTrack;
    practiceLanguage?: PracticeLanguage;
    transcription?: PracticeTranscriptionArtifact | null;
  }
) {
  if (params.practiceTrack === "speaking" || params.practiceLanguage !== "vi") {
    return;
  }

  const warnings = new Set<string>(params.transcription?.warnings ?? []);
  const reasons: string[] = [];
  let scoreCap = 100;

  if (
    [
      "low_confidence",
      "possible_stt_artifacts",
      "fallback_transcript_used",
      "provider_disagreement",
      "repair_uncertain",
      "repair_hallucination_risk",
    ].some((warning) => warnings.has(warning))
  ) {
    scoreCap = Math.min(scoreCap, 76);
    reasons.push("stt uncertainty remains in judge transcript");
  }

  if (
    feedback.persuasion.impactfulness <= 3 ||
    (feedback.persuasion.score <= 6 && !hasImpactWeighingSignal(feedback))
  ) {
    scoreCap = Math.min(scoreCap, 72);
    reasons.push("missing impact weighing");
  }

  if (
    feedback.content.counterArgument <= 6 &&
    !hasClashResponseCoverage(feedback)
  ) {
    scoreCap = Math.min(scoreCap, 74);
    reasons.push("missing clash response coverage");
  }

  if (
    (feedback.argumentBreakdowns?.length ?? 0) < 2 &&
    (feedback.transcriptAnnotations?.length ?? 0) < 2
  ) {
    scoreCap = Math.min(scoreCap, 74);
    reasons.push("shallow argument coverage");
  }

  if (reasons.length > 0) {
    applyScoreCap(feedback, scoreCap, reasons, params);
  }
}

function completeStagedFeedbackDepth(
  feedback: DebateScore,
  speechMap: StagedDebateSpeechMap,
  params: AnalyzeDebateParams
): { feedback: DebateScore; metadata: DepthCompletionMetadata } {
  const target = getDebateFeedbackDepthTarget({
    isFullRound: true,
    actualDuration: params.actualDuration,
    roundCount: params.rounds?.length,
  });
  const beforeArgs = feedback.argumentBreakdowns?.length ?? 0;
  const beforeClashes = feedback.clashLinks?.length ?? 0;
  const beforeScore = feedback.totalScore;
  const macroClashes = speechMap.macroClashes ?? [];
  const argumentBreakdowns = [...(feedback.argumentBreakdowns ?? [])];

  for (const clash of macroClashes) {
    if (argumentBreakdowns.length >= target.minArgumentBreakdowns) break;
    argumentBreakdowns.push(
      createFallbackArgumentBreakdown(clash, params, argumentBreakdowns.length)
    );
  }
  if (argumentBreakdowns.length === 0) {
    argumentBreakdowns.push(
      createFallbackArgumentBreakdown(
        {
          id: "fallback-main-clash",
          name: params.practiceLanguage === "vi" ? "Trục chính của trận" : "Main clash",
          studentPosition: feedback.caseSummary ?? "",
          aiPosition: "",
          judgeRead: feedback.clashFeedback ?? feedback.summary,
          studentMissingResponse: feedback.improvements?.[0],
        },
        params,
        0
      )
    );
  }

  const clashLinks = [...(feedback.clashLinks ?? [])];
  for (const clash of macroClashes) {
    if (clashLinks.length >= target.minClashLinks) break;
    const link = createFallbackClashLink(clash, params, clashLinks.length);
    if (link) clashLinks.push(link);
  }

  feedback.argumentBreakdowns = argumentBreakdowns.slice(0, target.maxArgumentBreakdowns);
  feedback.clashLinks = normalizeDebateClashLinks(clashLinks).slice(
    0,
    target.maxClashLinks
  );

  const reasons: string[] = [];
  let scoreCap = 100;
  if (beforeClashes < 3) {
    scoreCap = Math.min(scoreCap, 78);
    reasons.push("fewer than 3 model-produced clash links");
  }
  if (beforeArgs < 3) {
    scoreCap = Math.min(scoreCap, 80);
    reasons.push("fewer than 3 model-produced argument breakdowns");
  }
  if (feedback.annotationMetadata?.fallbackUsed) {
    scoreCap = Math.min(scoreCap, 84);
    reasons.push("annotation fallback was needed");
  }

  const scoreCapApplied =
    reasons.length > 0 && applyScoreCap(feedback, scoreCap, reasons, params);

  return {
    feedback,
    metadata: {
      used:
        beforeArgs !== (feedback.argumentBreakdowns?.length ?? 0) ||
        beforeClashes !== (feedback.clashLinks?.length ?? 0) ||
        scoreCapApplied,
      argumentBreakdownsBefore: beforeArgs,
      argumentBreakdownsAfter: feedback.argumentBreakdowns?.length ?? 0,
      clashLinksBefore: beforeClashes,
      clashLinksAfter: feedback.clashLinks?.length ?? 0,
      scoreCapApplied,
      scoreBefore: beforeScore,
      scoreAfter: feedback.totalScore,
      scoreCapReasons: reasons,
    },
  };
}

async function analyzeFullRoundDebateWithStagedGemini(
  params: AnalyzeDebateParams,
  userId?: string,
  onTelemetry?: AiTelemetryCallback
): Promise<DebateScore> {
  const modelName = getStagedFullRoundJudgeModelName();
  const stages: GeminiStageResult[] = [];
  const stagePromptHashes: Record<string, string> = {};
  const stageCache = params.providerAudit?.stagedGeminiCache;
  const onStageCacheEntry = params.providerAudit?.onStagedGeminiCacheEntry;
  const stageAudit = {
    userId,
    sourceRoute: params.providerAudit?.sourceRoute ?? "/api/analyze",
    outputType: "practice_judging",
    practiceAttemptId: params.providerAudit?.practiceAttemptId,
    analysisJobId: params.providerAudit?.analysisJobId,
    metadata: {
      judgePipeline: "staged_full_round_gemini",
      isFullRound: params.isFullRound ?? false,
      ...(params.providerAudit?.metadata ?? {}),
    },
  };

  const speechMapPrompt = buildSpeechMapPrompt(params);
  stagePromptHashes.speech_map = createHash("sha256")
    .update(speechMapPrompt)
    .digest("hex");
  const speechMapStage = await generateCachedGeminiStage({
    modelName,
    stage: "speech_map",
    prompt: speechMapPrompt,
    promptHash: stagePromptHashes.speech_map,
    maxOutputTokens: 4096,
    temperature: 0.2,
    keySeed: `${userId ?? "anonymous"}:${params.topic}:speech_map`,
    cache: stageCache,
    onCacheEntry: onStageCacheEntry,
    audit: stageAudit,
  });
  stages.push(speechMapStage);
  const speechMap = parseJsonObject<StagedDebateSpeechMap>(
    speechMapStage.text,
    "Gemini staged speech map"
  );

  const verdictPrompt = buildStagedVerdictPrompt(params, speechMap);
  stagePromptHashes.verdict_feedback = createHash("sha256")
    .update(verdictPrompt)
    .digest("hex");
  const verdictStage = await generateCachedGeminiStage({
    modelName,
    stage: "verdict_feedback",
    prompt: verdictPrompt,
    promptHash: stagePromptHashes.verdict_feedback,
    maxOutputTokens: 8192,
    temperature: 0.25,
    keySeed: `${userId ?? "anonymous"}:${params.topic}:verdict_feedback`,
    cache: stageCache,
    onCacheEntry: onStageCacheEntry,
    audit: stageAudit,
  });
  stages.push(verdictStage);
  let parsed = parseGeminiFeedback(verdictStage.text);

  if (
    typeof parsed.totalScore !== "number" ||
    !parsed.overallBand ||
    !parsed.content ||
    !parsed.structure ||
    !parsed.language ||
    !parsed.persuasion
  ) {
    throw new Error("Invalid response structure from staged Gemini verdict");
  }

  let annotationPayload: StagedAnnotationPayload = { transcriptAnnotations: [] };
  let annotationStageError: string | null = null;
  let languageRepairStageError: string | null = null;
  try {
    const annotationPrompt = buildStagedAnnotationPrompt(
      params,
      speechMap,
      parsed
    );
    stagePromptHashes.annotation_anchor = createHash("sha256")
      .update(annotationPrompt)
      .digest("hex");
    const annotationStage = await generateCachedGeminiStage({
      modelName,
      stage: "annotation_anchor",
      prompt: annotationPrompt,
      promptHash: stagePromptHashes.annotation_anchor,
      maxOutputTokens: 4096,
      temperature: 0.15,
      keySeed: `${userId ?? "anonymous"}:${params.topic}:annotation_anchor`,
      cache: stageCache,
      onCacheEntry: onStageCacheEntry,
      audit: stageAudit,
    });
    stages.push(annotationStage);
    annotationPayload = parseJsonObject<StagedAnnotationPayload>(
      annotationStage.text,
      "Gemini staged annotations"
    );
  } catch (error) {
    annotationStageError =
      error instanceof Error ? error.message : String(error);
  }

  parsed.transcriptAnnotations = annotationPayload.transcriptAnnotations ?? [];
  parsed = normalizeDebateScore(parsed, params);

  const depthCompletion = completeStagedFeedbackDepth(parsed, speechMap, params);
  parsed = depthCompletion.feedback;

  if (params.practiceLanguage === "vi" && needsVietnameseProseRepair(parsed)) {
    try {
      const languageRepairPrompt = `${buildStagedFullRoundBaseContext(params, {
        includeCorpus: true,
        includeTruongTeenRubric: true,
        includeSttGuardrail: true,
      })}

## Previous JSON With Language Violation
${JSON.stringify(parsed)}

## Vietnamese Repair Instruction
The previous JSON used English in user-facing prose even though the practice language is Vietnamese. Return the full JSON schema again.

Hard rules:
- Keep every schema key and enum literal in English exactly as specified.
- Keep numeric scores, round numbers, winner, confidence, tags, severities, speakers, outcomes, and ids unchanged unless a score is outside its allowed range.
- Keep exact transcript quote fields unchanged: quote, sourceQuote, and responseQuote must remain exact copied text.
- Rewrite every user-facing explanation in natural Vietnamese: summary, strengths, improvements, sampleArguments, noteTakingFeedback, improvementPlan, shadowExamples, case feedback, argumentBreakdowns text, missingLayers, weighingFeedback, clashFeedback, strongerRebuilds, detailedFeedback, debateVerdict prose, clashLinks judgeRead/suggestion, transcriptAnnotations feedback/suggestion, and scoreRationale prose.
- JSON only.`;
      stagePromptHashes.language_repair = createHash("sha256")
        .update(languageRepairPrompt)
        .digest("hex");
      const languageRepairStage = await generateGeminiStage({
        modelName,
        stage: "language_repair",
        prompt: languageRepairPrompt,
        maxOutputTokens: 8192,
        temperature: 0.15,
        keySeed: `${userId ?? "anonymous"}:${params.topic}:language_repair`,
        audit: stageAudit,
      });
      stages.push(languageRepairStage);
      parsed = normalizeDebateScore(
        parseGeminiFeedback(languageRepairStage.text),
        params
      );
    } catch (error) {
      languageRepairStageError =
        error instanceof Error ? error.message : String(error);
    }
  }

  const summary = summarizeGeminiStages(stages);
  if (userId) {
    getPostHogServer().capture({
      distinctId: userId,
      event: "$ai_generation",
      properties: {
        $ai_provider: "google",
        $ai_model: modelName,
        $ai_input_tokens: summary.inputTokens,
        $ai_output_tokens: summary.outputTokens,
        $ai_latency: summary.latencyMs,
        $ai_is_error: false,
        $ai_trace_id: crypto.randomUUID(),
        route: "/api/analyze",
        judge_pipeline: "staged_full_round",
        judge_stage_count: stages.length,
      },
    });
  }
  await emitAiTelemetry(onTelemetry, {
    provider: "google",
    requestedProvider: getProviderLabel(
      getPracticeFeedbackProvider(params.practiceTrack ?? "debate")
    ),
    model: modelName,
    latencyMs: summary.latencyMs,
    providerRequestIds: stages
      .map((stage) => stage.providerRequestId)
      .filter((id): id is string => Boolean(id)),
    metadata: {
      judgePipeline: "staged_full_round_gemini",
      judgeStageCount: stages.length,
      judgeStageLatenciesMs: summary.stageLatencies,
      judgeStageUsage: summary.stageUsage,
      judgeStageKeySlots: summary.stageKeySlots,
      judgeStageCacheHits: summary.stageCacheHits,
      judgeStageCacheHitCount: stages.filter((stage) => stage.cacheHit).length,
      geminiKeyPoolSize: getGeminiKeyCountForTelemetry(),
      judgeStagePromptHashes: stagePromptHashes,
      annotationStageError,
      languageRepairStageError,
      depthCompletion: depthCompletion.metadata,
    },
    usage: {
      inputTokens: summary.inputTokens || undefined,
      outputTokens: summary.outputTokens || undefined,
      totalTokens: summary.totalTokens || undefined,
    },
  });

  return parsed;
}

async function analyzeDebateWithGemini(
  params: AnalyzeDebateParams,
  userId?: string,
  onTelemetry?: AiTelemetryCallback,
  fallbackUsed = false
): Promise<DebateScore> {
  const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const model = getGeminiClient().getGenerativeModel({
    model: modelName,
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.3,
      maxOutputTokens:
        params.practiceTrack !== "speaking" && params.isFullRound ? 12000 : 6144,
    },
  });

  const prompt = buildAnalysisPrompt(params);
  const startTime = Date.now();
  const providerRequestIds: string[] = [];
  let result;
  try {
    result = await model.generateContent(prompt);
    const providerRequestId = await recordGeminiProviderRequest({
      model: modelName,
      status: "success",
      sourceRoute: params.providerAudit?.sourceRoute ?? "/api/analyze",
      outputType: "practice_judging",
      userId,
      latencyMs: Date.now() - startTime,
      usage: result.response.usageMetadata,
      practiceAttemptId: params.providerAudit?.practiceAttemptId,
      analysisJobId: params.providerAudit?.analysisJobId,
      metadata: {
        phase: "primary",
        fallbackUsed,
        ...(params.providerAudit?.metadata ?? {}),
      },
    });
    if (providerRequestId) providerRequestIds.push(providerRequestId);
  } catch (error) {
    await recordGeminiProviderRequest({
      model: modelName,
      status: "error",
      sourceRoute: params.providerAudit?.sourceRoute ?? "/api/analyze",
      outputType: "practice_judging",
      userId,
      latencyMs: Date.now() - startTime,
      errorCode: "GEMINI_ANALYSIS_FAILED",
      errorMessage: error instanceof Error ? error.message : String(error),
      practiceAttemptId: params.providerAudit?.practiceAttemptId,
      analysisJobId: params.providerAudit?.analysisJobId,
      metadata: {
        phase: "primary",
        fallbackUsed,
        ...(params.providerAudit?.metadata ?? {}),
      },
    });
    throw error;
  }
  const latency = Date.now() - startTime;
  const text = result.response.text();

  if (userId) {
    const usage = result.response.usageMetadata;
    getPostHogServer().capture({
      distinctId: userId,
      event: "$ai_generation",
      properties: {
        $ai_provider: "google",
        $ai_model: modelName,
        $ai_input_tokens: usage?.promptTokenCount,
        $ai_output_tokens: usage?.candidatesTokenCount,
        $ai_latency: latency,
        $ai_is_error: false,
        $ai_trace_id: crypto.randomUUID(),
        route: "/api/analyze",
      },
    });
  }
  await emitAiTelemetry(onTelemetry, {
    provider: "google",
    requestedProvider: getProviderLabel(getPracticeFeedbackProvider(params.practiceTrack ?? "debate")),
    model: modelName,
    latencyMs: latency,
    fallbackUsed,
    providerRequestIds,
    usage: {
      inputTokens: result.response.usageMetadata?.promptTokenCount,
      outputTokens: result.response.usageMetadata?.candidatesTokenCount,
    },
  });

  let parsed = await parseGeminiFeedbackWithRetry(model, prompt, text, {
    modelName,
    userId,
    sourceRoute: params.providerAudit?.sourceRoute ?? "/api/analyze",
    outputType: "practice_judging",
    practiceAttemptId: params.providerAudit?.practiceAttemptId,
    analysisJobId: params.providerAudit?.analysisJobId,
    providerRequestIds,
    metadata: params.providerAudit?.metadata,
  });

  // Validate essential fields exist
  if (
    typeof parsed.totalScore !== "number" ||
    !parsed.overallBand ||
    !parsed.content ||
    !parsed.structure ||
    !parsed.language ||
    !parsed.persuasion
  ) {
    throw new Error("Invalid response structure from Gemini");
  }

  parsed = normalizeDebateScore(parsed, params);

  const depthTarget = getDebateFeedbackDepthTarget({
    isFullRound: params.practiceTrack !== "speaking" && params.isFullRound,
    actualDuration: params.actualDuration,
    roundCount: params.rounds?.length,
  });

  if (
    params.practiceTrack !== "speaking" &&
    params.isFullRound &&
    isFeedbackBelowDepthTarget(parsed, depthTarget)
  ) {
    const repairPrompt = `${prompt}

## Existing Feedback To Repair
${JSON.stringify(parsed)}

## Repair Instruction
The existing feedback is too shallow for a full-round debate. Return the full JSON schema again, preserving valid scores when reasonable, but expand coverage to at least ${depthTarget.minArgumentBreakdowns} argumentBreakdowns, ${depthTarget.minAnnotations} transcriptAnnotations, ${depthTarget.minClashLinks} clashLinks, and a complete scoreRationale. Do not invent transcript quotes; use exact quotes from the transcript above.`;
    const repairStartTime = Date.now();
    const repairResult = await model.generateContent(repairPrompt);
    const repairProviderRequestId = await recordGeminiProviderRequest({
      model: modelName,
      status: "success",
      sourceRoute: params.providerAudit?.sourceRoute ?? "/api/analyze",
      outputType: "practice_judging",
      userId,
      latencyMs: Date.now() - repairStartTime,
      usage: repairResult.response.usageMetadata,
      practiceAttemptId: params.providerAudit?.practiceAttemptId,
      analysisJobId: params.providerAudit?.analysisJobId,
      metadata: {
        phase: "depth_repair",
        ...(params.providerAudit?.metadata ?? {}),
      },
    });
    if (repairProviderRequestId) providerRequestIds.push(repairProviderRequestId);
    parsed = normalizeDebateScore(
      await parseGeminiFeedbackWithRetry(
        model,
        repairPrompt,
        repairResult.response.text(),
        {
          modelName,
          userId,
          sourceRoute: params.providerAudit?.sourceRoute ?? "/api/analyze",
          outputType: "practice_judging",
          practiceAttemptId: params.providerAudit?.practiceAttemptId,
          analysisJobId: params.providerAudit?.analysisJobId,
          providerRequestIds,
          metadata: params.providerAudit?.metadata,
        }
      ),
      params
    );
  }

  if (
    params.practiceLanguage === "vi" &&
    needsVietnameseProseRepair(parsed)
  ) {
    const languageRepairPrompt = `${prompt}

## Previous JSON With Language Violation
${JSON.stringify(parsed)}

## Vietnamese Repair Instruction
The previous JSON used English in user-facing prose even though the practice language is Vietnamese. Return the full JSON schema again.

Hard rules:
- Keep every schema key and enum literal in English exactly as specified.
- Keep numeric scores, round numbers, winner, confidence, tags, severities, speakers, outcomes, and ids unchanged unless a score is outside its allowed range.
- Keep exact transcript quote fields unchanged: quote, sourceQuote, and responseQuote must remain exact copied text.
- Rewrite every user-facing explanation in natural Vietnamese: summary, strengths, improvements, sampleArguments, noteTakingFeedback, improvementPlan, shadowExamples, case feedback, argumentBreakdowns text, missingLayers, weighingFeedback, clashFeedback, strongerRebuilds, detailedFeedback, debateVerdict prose, clashLinks judgeRead/suggestion, transcriptAnnotations feedback/suggestion, and scoreRationale prose.
- JSON only.`;
    const languageRepairStartTime = Date.now();
    const languageRepairResult = await model.generateContent(languageRepairPrompt);
    const languageRepairProviderRequestId = await recordGeminiProviderRequest({
      model: modelName,
      status: "success",
      sourceRoute: params.providerAudit?.sourceRoute ?? "/api/analyze",
      outputType: "practice_judging",
      userId,
      latencyMs: Date.now() - languageRepairStartTime,
      usage: languageRepairResult.response.usageMetadata,
      practiceAttemptId: params.providerAudit?.practiceAttemptId,
      analysisJobId: params.providerAudit?.analysisJobId,
      metadata: {
        phase: "language_repair",
        ...(params.providerAudit?.metadata ?? {}),
      },
    });
    if (languageRepairProviderRequestId) {
      providerRequestIds.push(languageRepairProviderRequestId);
    }
    parsed = normalizeDebateScore(
      await parseGeminiFeedbackWithRetry(
        model,
        languageRepairPrompt,
        languageRepairResult.response.text(),
        {
          modelName,
          userId,
          sourceRoute: params.providerAudit?.sourceRoute ?? "/api/analyze",
          outputType: "practice_judging",
          practiceAttemptId: params.providerAudit?.practiceAttemptId,
          analysisJobId: params.providerAudit?.analysisJobId,
          providerRequestIds,
          metadata: params.providerAudit?.metadata,
        }
      ),
      params
    );
  }

  return parsed;
}

async function analyzeDebateWithDeepSeek(
  params: AnalyzeDebateParams,
  userId?: string,
  onTelemetry?: AiTelemetryCallback,
  options: {
    fallbackFromGemini?: boolean;
  } = {}
): Promise<DebateScore> {
  const createDeepSeekChatCompletion = await loadDeepSeekChatCompletion();
  const verdictDraft: Record<string, unknown> | null = null;
  const providerRequestIds: string[] = [];

  const prompt = buildCompactDeepSeekAnalysisPrompt(params, verdictDraft);
  const { messages, promptPrefixHash } = buildDeepSeekAnalysisMessages(
    params,
    verdictDraft
  );
  const maxTokens =
    params.practiceTrack !== "speaking" && params.isFullRound ? 7000 : 5000;
  const timeoutMs = getPracticeDeepSeekTimeoutMs(
    options.fallbackFromGemini ?? false
  );
  const thinking = { type: "disabled" } as const;
  const generateText = async (nextPrompt: string) => {
    const retryResult = await createDeepSeekChatCompletion({
      messages: [
        messages[0],
        messages[1],
        { role: "user", content: nextPrompt },
      ],
      thinking: { type: "disabled" },
      responseFormat: "json_object",
      maxTokens,
      userId,
      timeoutMs,
      sourceRoute: params.providerAudit?.sourceRoute ?? "/api/analyze",
      outputType: "practice_judging",
      practiceAttemptId: params.providerAudit?.practiceAttemptId,
      analysisJobId: params.providerAudit?.analysisJobId,
      metadata: {
        phase: "json_regeneration_or_repair",
        fallbackFromGemini: options.fallbackFromGemini ?? false,
        timeoutMs,
        ...(params.providerAudit?.metadata ?? {}),
      },
    });
    if (retryResult.providerRequestId) {
      providerRequestIds.push(retryResult.providerRequestId);
    }
    return retryResult.content;
  };

  const startTime = Date.now();
  let internalRetryUsed = false;
  let result;
  try {
    result = await createDeepSeekChatCompletion({
      messages,
      thinking,
      responseFormat: "json_object",
      maxTokens,
      userId,
      timeoutMs,
      sourceRoute: params.providerAudit?.sourceRoute ?? "/api/analyze",
      outputType: "practice_judging",
      practiceAttemptId: params.providerAudit?.practiceAttemptId,
      analysisJobId: params.providerAudit?.analysisJobId,
      metadata: {
        phase: "primary",
        isFullRound: params.isFullRound ?? false,
        fallbackFromGemini: options.fallbackFromGemini ?? false,
        timeoutMs,
        ...(params.providerAudit?.metadata ?? {}),
      },
    });
    if (result.providerRequestId) {
      providerRequestIds.push(result.providerRequestId);
    }
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith("DeepSeek returned an empty response") &&
      process.env.DEEPSEEK_EMPTY_RESPONSE_INTERNAL_RETRY === "true"
    ) {
      internalRetryUsed = true;
      result = await createDeepSeekChatCompletion({
        messages,
        thinking,
        responseFormat: "json_object",
        maxTokens,
        userId,
        timeoutMs,
        sourceRoute: params.providerAudit?.sourceRoute ?? "/api/analyze",
        outputType: "practice_judging",
        practiceAttemptId: params.providerAudit?.practiceAttemptId,
        analysisJobId: params.providerAudit?.analysisJobId,
        metadata: {
          phase: "empty_response_internal_retry",
          isFullRound: params.isFullRound ?? false,
          fallbackFromGemini: options.fallbackFromGemini ?? false,
          timeoutMs,
          ...(params.providerAudit?.metadata ?? {}),
        },
      });
      if (result.providerRequestId) {
        providerRequestIds.push(result.providerRequestId);
      }
    } else {
      throw error;
    }
  }
  const latency = Date.now() - startTime;

  if (userId) {
    const usage = result.usage;
    getPostHogServer().capture({
      distinctId: userId,
      event: "$ai_generation",
      properties: {
        $ai_provider: getProviderLabel("deepseek"),
        $ai_model: result.model,
        $ai_input_tokens: usage?.prompt_tokens,
        $ai_output_tokens: usage?.completion_tokens,
        $ai_cache_hit_tokens: usage?.prompt_cache_hit_tokens,
        $ai_cache_miss_tokens: usage?.prompt_cache_miss_tokens,
        $ai_reasoning_tokens: usage?.completion_tokens_details?.reasoning_tokens,
        $ai_latency: latency,
        $ai_is_error: false,
        $ai_trace_id: crypto.randomUUID(),
        route: "/api/analyze",
      },
    });
  }
  await emitAiTelemetry(onTelemetry, {
    provider: getProviderLabel("deepseek"),
    requestedProvider: getProviderLabel(
      options.fallbackFromGemini ? "gemini" : "deepseek"
    ),
    model: result.model,
    latencyMs: latency,
    fallbackUsed: options.fallbackFromGemini ?? false,
    providerRequestIds,
    metadata: {
      deepSeekPromptPrefixHash: promptPrefixHash,
      deepSeekInternalRetryUsed: internalRetryUsed,
      fallbackFromGemini: options.fallbackFromGemini ?? false,
    },
    usage: {
      inputTokens: result.usage?.prompt_tokens,
      outputTokens: result.usage?.completion_tokens,
      totalTokens: result.usage?.total_tokens,
      cacheHitTokens: result.usage?.prompt_cache_hit_tokens,
      cacheMissTokens: result.usage?.prompt_cache_miss_tokens,
      reasoningTokens: result.usage?.completion_tokens_details?.reasoning_tokens,
    },
  });

  let parsed = await parseDeepSeekFeedbackWithRetry(
    generateText,
    prompt,
    result.content
  );

  if (
    typeof parsed.totalScore !== "number" ||
    !parsed.overallBand ||
    !parsed.content ||
    !parsed.structure ||
    !parsed.language ||
    !parsed.persuasion
  ) {
    throw new Error("Invalid response structure from DeepSeek");
  }

  parsed = normalizeDebateScore(parsed, params);

  const depthTarget = getDebateFeedbackDepthTarget({
    isFullRound: params.practiceTrack !== "speaking" && params.isFullRound,
    actualDuration: params.actualDuration,
    roundCount: params.rounds?.length,
  });

  const allowRepairPasses =
    process.env.DEEPSEEK_ENABLE_FEEDBACK_REPAIR === "true";

  if (
    allowRepairPasses &&
    params.practiceTrack !== "speaking" &&
    params.isFullRound &&
    isFeedbackBelowDepthTarget(parsed, depthTarget)
  ) {
    const repairPrompt = `${prompt}

## Existing Feedback To Repair
${JSON.stringify(parsed)}

## Repair Instruction
The existing feedback is too shallow for a full-round debate. Return the full JSON schema again, preserving valid scores when reasonable, but expand coverage to at least ${depthTarget.minArgumentBreakdowns} argumentBreakdowns, ${depthTarget.minAnnotations} transcriptAnnotations, ${depthTarget.minClashLinks} clashLinks, and a complete scoreRationale. Do not invent transcript quotes; use exact quotes from the transcript above.`;
    parsed = normalizeDebateScore(
      await parseDeepSeekFeedbackWithRetry(
        generateText,
        repairPrompt,
        await generateText(repairPrompt)
      ),
      params
    );
  }

  if (
    allowRepairPasses &&
    params.practiceLanguage === "vi" &&
    needsVietnameseProseRepair(parsed)
  ) {
    const languageRepairPrompt = `${prompt}

## Previous JSON With Language Violation
${JSON.stringify(parsed)}

## Vietnamese Repair Instruction
The previous JSON used English in user-facing prose even though the practice language is Vietnamese. Return the full JSON schema again.

Hard rules:
- Keep every schema key and enum literal in English exactly as specified.
- Keep numeric scores, round numbers, winner, confidence, tags, severities, speakers, outcomes, and ids unchanged unless a score is outside its allowed range.
- Keep exact transcript quote fields unchanged: quote, sourceQuote, and responseQuote must remain exact copied text.
- Rewrite every user-facing explanation in natural Vietnamese: summary, strengths, improvements, sampleArguments, noteTakingFeedback, improvementPlan, shadowExamples, case feedback, argumentBreakdowns text, missingLayers, weighingFeedback, clashFeedback, strongerRebuilds, detailedFeedback, debateVerdict prose, clashLinks judgeRead/suggestion, transcriptAnnotations feedback/suggestion, and scoreRationale prose.
- JSON only.`;
    parsed = normalizeDebateScore(
      await parseDeepSeekFeedbackWithRetry(
        generateText,
        languageRepairPrompt,
        await generateText(languageRepairPrompt)
      ),
      params
    );
  }

  return parsed;
}

function parseGeminiFeedback(text: string): DebateScore {
  try {
    return JSON.parse(text) as DebateScore;
  } catch {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Invalid response: could not find JSON in Gemini output");
    }
    try {
      return JSON.parse(jsonMatch[0]) as DebateScore;
    } catch {
      throw new Error("Invalid response: Gemini returned malformed JSON");
    }
  }
}

async function parseGeminiFeedbackWithRetry(
  model: {
    generateContent: (
      prompt: string
    ) => Promise<{ response: { text: () => string; usageMetadata?: GeminiUsageMetadata } }>;
  },
  prompt: string,
  text: string,
  audit?: {
    modelName: string;
    userId?: string | null;
    sourceRoute?: string | null;
    outputType?: string | null;
    practiceAttemptId?: string | null;
    analysisJobId?: string | null;
    debateSessionId?: string | null;
    providerRequestIds?: string[];
    metadata?: Record<string, unknown>;
  }
): Promise<DebateScore> {
  try {
    return parseGeminiFeedback(text);
  } catch (error) {
    const retryPrompt = `${prompt}

## JSON Regeneration Instruction
Your previous response could not be parsed as valid JSON: ${error instanceof Error ? error.message : "Malformed JSON"}.
Return the full requested JSON schema again as valid JSON only.
Do not use Markdown fences, comments, trailing commas, unescaped newlines inside strings, or prose outside the JSON object.`;
    const startTime = Date.now();
    let retryResult: { response: { text: () => string; usageMetadata?: GeminiUsageMetadata } };
    try {
      retryResult = await model.generateContent(retryPrompt);
      const providerRequestId = await recordGeminiProviderRequest({
        model: audit?.modelName ?? process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
        status: "success",
        sourceRoute: audit?.sourceRoute,
        outputType: audit?.outputType,
        userId: audit?.userId,
        latencyMs: Date.now() - startTime,
        usage: retryResult.response.usageMetadata,
        practiceAttemptId: audit?.practiceAttemptId,
        analysisJobId: audit?.analysisJobId,
        debateSessionId: audit?.debateSessionId,
        metadata: {
          phase: "json_regeneration",
          ...(audit?.metadata ?? {}),
        },
      });
      if (providerRequestId) audit?.providerRequestIds?.push(providerRequestId);
    } catch (retryError) {
      await recordGeminiProviderRequest({
        model: audit?.modelName ?? process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
        status: "error",
        sourceRoute: audit?.sourceRoute,
        outputType: audit?.outputType,
        userId: audit?.userId,
        latencyMs: Date.now() - startTime,
        errorCode: "GEMINI_JSON_REGENERATION_FAILED",
        errorMessage: retryError instanceof Error ? retryError.message : String(retryError),
        practiceAttemptId: audit?.practiceAttemptId,
        analysisJobId: audit?.analysisJobId,
        debateSessionId: audit?.debateSessionId,
        metadata: {
          phase: "json_regeneration",
          ...(audit?.metadata ?? {}),
        },
      });
      throw retryError;
    }
    return parseGeminiFeedback(retryResult.response.text());
  }
}

async function parseDeepSeekFeedbackWithRetry(
  generateText: (prompt: string) => Promise<string>,
  prompt: string,
  text: string
): Promise<DebateScore> {
  try {
    return parseGeminiFeedback(text);
  } catch (error) {
    const retryPrompt = `${prompt}

## JSON Regeneration Instruction
Your previous response could not be parsed as valid JSON: ${error instanceof Error ? error.message : "Malformed JSON"}.
Return the full requested JSON schema again as valid JSON only.
Do not use Markdown fences, comments, trailing commas, unescaped newlines inside strings, or prose outside the JSON object.`;
    return parseGeminiFeedback(await generateText(retryPrompt));
  }
}

function clampNumber(value: unknown, min: number, max: number, fallback = min) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(min, Math.min(max, value))
    : fallback;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cleanString(value: unknown, maxLength = 600) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function cleanStringArray(value: unknown, maxItems: number, maxLength = 500) {
  return Array.isArray(value)
    ? value
        .map((item) => cleanString(item, maxLength))
        .filter(Boolean)
        .slice(0, maxItems)
    : [];
}

function normalizeNoteTakingFeedback(
  value: unknown,
  hasPrepNotes: boolean
): NoteTakingFeedback | null {
  if (!hasPrepNotes || !isPlainRecord(value)) return null;

  const summary = cleanString(value.summary, 700);
  const whatHelped = cleanStringArray(value.whatHelped, 4);
  const missedOpportunities = cleanStringArray(value.missedOpportunities, 4);
  const nextSessionTemplate = cleanStringArray(value.nextSessionTemplate, 5);

  if (
    !summary &&
    whatHelped.length === 0 &&
    missedOpportunities.length === 0 &&
    nextSessionTemplate.length === 0
  ) {
    return null;
  }

  return {
    summary,
    whatHelped,
    missedOpportunities,
    nextSessionTemplate,
  };
}

function normalizePracticeActionSteps(value: unknown): PracticeActionStep[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!isPlainRecord(item)) return null;
      const title = cleanString(item.title, 120);
      const whyItMatters = cleanString(item.whyItMatters, 500);
      const howToPractice = cleanString(item.howToPractice, 700);
      const shadowExample = cleanString(item.shadowExample, 700);
      const timeBoxSeconds =
        typeof item.timeBoxSeconds === "number" && Number.isFinite(item.timeBoxSeconds)
          ? Math.max(15, Math.min(900, Math.round(item.timeBoxSeconds)))
          : undefined;

      if (!title || !whyItMatters || !howToPractice) return null;

      return {
        title,
        whyItMatters,
        howToPractice,
        ...(shadowExample ? { shadowExample } : {}),
        ...(timeBoxSeconds ? { timeBoxSeconds } : {}),
      } satisfies PracticeActionStep;
    })
    .filter((item): item is PracticeActionStep => Boolean(item))
    .slice(0, 3);
}

function normalizeShadowExamples(value: unknown): ShadowExample[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!isPlainRecord(item)) return null;
      const label = cleanString(item.label, 120);
      const before = cleanString(item.before, 700);
      const after = cleanString(item.after, 900);
      const why = cleanString(item.why, 700);

      if (!label || !after || !why) return null;

      return {
        label,
        ...(before ? { before } : {}),
        after,
        why,
      } satisfies ShadowExample;
    })
    .filter((item): item is ShadowExample => Boolean(item))
    .slice(0, 3);
}

function createFallbackNoteTakingFeedback(
  feedback: DebateScore,
  params: {
    practiceTrack?: PracticeTrack;
    practiceLanguage?: PracticeLanguage;
  }
): NoteTakingFeedback {
  const vi = params.practiceLanguage === "vi";
  const speaking = params.practiceTrack === "speaking";
  const missed =
    feedback.improvements?.[0] ??
    feedback.missingLayers?.[0] ??
    feedback.scoreRationale?.content?.nextStep ??
    (vi
      ? "Ghi lại một ý cần chứng minh rõ hơn trước khi nói."
      : "Capture one idea that needs clearer proof before speaking.");

  if (vi) {
    return {
      summary: speaking
        ? "Ghi chú đã tạo điểm tựa cho bài nói, nhưng lần tới nên viết sẵn một câu ví dụ hoặc câu kết luận để dễ triển khai hơn."
        : "Ghi chú đã tạo điểm tựa cho lập luận, nhưng lần tới nên viết sẵn cơ chế, ví dụ và câu so sánh tác động để dễ đưa vào bài nói.",
      whatHelped: [
        speaking
          ? "Ghi chú giúp giữ trọng tâm chính của bài nói."
          : "Ghi chú giúp xác định trục lập luận chính trước khi vào bài.",
      ],
      missedOpportunities: [missed],
      nextSessionTemplate: speaking
        ? [
            "Ý chính: ___",
            "Ví dụ cụ thể: ___",
            "Câu kết: điều này quan trọng vì ___.",
          ]
        : [
            "Trục clash: phe mình chứng minh ___, phe kia nói ___.",
            "Cơ chế: ___ dẫn đến ___ vì ___.",
            "Cân tác động: ___ quan trọng hơn ___ vì ___.",
          ],
    };
  }

  return {
    summary: speaking
      ? "The notes gave the speech a starting point, but the next version should include one ready-to-say example or closing sentence."
      : "The notes gave the case a starting point, but the next version should capture mechanism, example, and weighing before the speech starts.",
    whatHelped: [
      speaking
        ? "The notes helped keep the main speaking goal visible."
        : "The notes helped identify the main argument or clash before speaking.",
    ],
    missedOpportunities: [missed],
    nextSessionTemplate: speaking
      ? [
          "Main idea: ___",
          "Specific example: ___",
          "Closing line: this matters because ___.",
        ]
      : [
          "Clash: my side proves ___; their side says ___.",
          "Mechanism: ___ causes ___ because ___.",
          "Weighing: ___ matters more than ___ because ___.",
        ],
  };
}

function ensureNoteTakingFeedback(
  existing: NoteTakingFeedback | null,
  fallback: NoteTakingFeedback
) {
  if (!existing) return fallback;

  return {
    summary: existing.summary || fallback.summary,
    whatHelped:
      existing.whatHelped.length > 0
        ? existing.whatHelped
        : fallback.whatHelped,
    missedOpportunities:
      existing.missedOpportunities.length > 0
        ? existing.missedOpportunities
        : fallback.missedOpportunities,
    nextSessionTemplate:
      existing.nextSessionTemplate.length >= 2
        ? existing.nextSessionTemplate
        : Array.from(
            new Set([
              ...existing.nextSessionTemplate,
              ...fallback.nextSessionTemplate,
            ])
          ).slice(0, 5),
  };
}

function ensurePracticeActionSteps(
  existing: PracticeActionStep[],
  feedback: DebateScore,
  params: {
    practiceTrack?: PracticeTrack;
    practiceLanguage?: PracticeLanguage;
  }
) {
  const vi = params.practiceLanguage === "vi";
  const speaking = params.practiceTrack === "speaking";
  const steps = [...existing];
  const sourceItems = [
    feedback.scoreRationale?.content?.nextStep,
    feedback.scoreRationale?.structure?.nextStep,
    feedback.scoreRationale?.persuasion?.nextStep,
    ...(feedback.missingLayers ?? []),
    ...(feedback.improvements ?? []),
  ]
    .map((item) => item?.trim())
    .filter((item): item is string => Boolean(item));
  const uniqueItems = Array.from(new Set(sourceItems));

  for (const item of uniqueItems) {
    if (steps.length >= 2) break;
    steps.push({
      title: vi
        ? speaking
          ? `Bài tập nói ${steps.length + 1}`
          : `Bài tập tranh biện ${steps.length + 1}`
        : speaking
          ? `Speaking drill ${steps.length + 1}`
          : `Debate drill ${steps.length + 1}`,
      whyItMatters: vi
        ? speaking
          ? "Bài tập này biến phản hồi thành một thói quen nói có thể lặp lại."
          : "Bài tập này biến phản hồi thành một thói quen tranh biện có thể lặp lại."
        : speaking
          ? "This turns feedback into one repeatable speaking habit."
          : "This turns feedback into one repeatable debating habit.",
      howToPractice: item,
      shadowExample:
        feedback.strongerRebuilds?.[steps.length] ??
        feedback.sampleArguments?.[steps.length] ??
        undefined,
      timeBoxSeconds: 120,
    });
  }

  return steps.slice(0, 3);
}

function ensureShadowExamples(
  existing: ShadowExample[],
  feedback: DebateScore,
  params: {
    practiceTrack?: PracticeTrack;
    practiceLanguage?: PracticeLanguage;
  }
) {
  const vi = params.practiceLanguage === "vi";
  const speaking = params.practiceTrack === "speaking";
  const examples = [...existing];
  const sourceItems = [
    ...(feedback.strongerRebuilds ?? []),
    ...(feedback.sampleArguments ?? []),
    feedback.scoreRationale?.content?.nextStep,
    feedback.scoreRationale?.persuasion?.nextStep,
  ]
    .map((item) => item?.trim())
    .filter((item): item is string => Boolean(item));
  const uniqueItems = Array.from(new Set(sourceItems));

  for (const item of uniqueItems) {
    if (examples.length >= 2) break;
    examples.push({
      label: vi
        ? speaking
          ? `Câu luyện theo ${examples.length + 1}`
          : `Mẫu lập luận ${examples.length + 1}`
        : speaking
          ? `Shadow line ${examples.length + 1}`
          : `Shadow argument ${examples.length + 1}`,
      after: item,
      why: vi
        ? speaking
          ? "Câu này cho bạn một cấu trúc rõ hơn để đọc thành tiếng và biến đổi trong lượt nói sau."
          : "Mẫu này cho bạn một khung rõ hơn để bắt chước khi xây luận điểm, cơ chế và tác động."
        : speaking
          ? "It gives you a clearer sentence shape to speak aloud and adapt."
          : "It gives you a clearer claim, mechanism, and impact shape to imitate.",
    });
  }

  return examples.slice(0, 3);
}

function clampSectionScores(parsed: DebateScore) {
  parsed.content.claimClarity = clampNumber(parsed.content.claimClarity, 0, 10);
  parsed.content.evidenceSupport = clampNumber(parsed.content.evidenceSupport, 0, 10);
  parsed.content.logicCoherence = clampNumber(parsed.content.logicCoherence, 0, 10);
  parsed.content.counterArgument = clampNumber(parsed.content.counterArgument, 0, 10);
  parsed.content.score = clampNumber(parsed.content.score, 0, 40);

  parsed.structure.introduction = clampNumber(parsed.structure.introduction, 0, 8);
  parsed.structure.bodyOrganization = clampNumber(parsed.structure.bodyOrganization, 0, 9);
  parsed.structure.conclusion = clampNumber(parsed.structure.conclusion, 0, 8);
  parsed.structure.score = clampNumber(parsed.structure.score, 0, 25);

  parsed.language.vocabulary = clampNumber(parsed.language.vocabulary, 0, 8);
  parsed.language.grammar = clampNumber(parsed.language.grammar, 0, 9);
  parsed.language.fluency = clampNumber(parsed.language.fluency, 0, 8);
  parsed.language.score = clampNumber(parsed.language.score, 0, 25);

  parsed.persuasion.audienceAwareness = clampNumber(
    parsed.persuasion.audienceAwareness,
    0,
    5
  );
  parsed.persuasion.impactfulness = clampNumber(
    parsed.persuasion.impactfulness,
    0,
    5
  );
  parsed.persuasion.score = clampNumber(parsed.persuasion.score, 0, 10);

  const categoryTotal =
    parsed.content.score +
    parsed.structure.score +
    parsed.language.score +
    parsed.persuasion.score;
  parsed.totalScore = clampNumber(categoryTotal, 0, 100);
}

function normalizeDebateScore(
  parsed: DebateScore,
  params: {
    practiceTrack?: PracticeTrack;
    practiceLanguage?: PracticeLanguage;
    transcript?: string;
    topic?: string;
    rounds?: DebateRound[];
    isFullRound?: boolean;
    actualDuration?: number;
    transcription?: PracticeTranscriptionArtifact | null;
    prepNotes?: string | null;
  }
) {
  clampSectionScores(parsed);
  parsed.practiceTrack = parsed.practiceTrack ?? params.practiceTrack ?? "debate";
  parsed.practiceLanguage = parsed.practiceLanguage ?? params.practiceLanguage ?? "en";
  parsed.argumentBreakdowns = parsed.argumentBreakdowns ?? [];
  parsed.missingLayers = parsed.missingLayers ?? [];
  parsed.strongerRebuilds = parsed.strongerRebuilds ?? [];
  const depthTarget = getDebateFeedbackDepthTarget({
    isFullRound: params.practiceTrack !== "speaking" && Boolean(params.isFullRound),
    actualDuration: params.actualDuration ?? 0,
    roundCount: params.rounds?.length,
  });
  const annotationResult = normalizeTranscriptAnnotationsForFeedback(
    parsed.transcriptAnnotations,
    {
      transcript: params.transcript ?? "",
      topic: params.topic,
      rounds: params.rounds,
      practiceLanguage: params.practiceLanguage,
      depthTarget,
    }
  );
  parsed.transcriptAnnotations = annotationResult.annotations;
  parsed.annotationMetadata = annotationResult.metadata;
  parsed.debateVerdict = normalizeDebateVerdict(parsed.debateVerdict) ?? undefined;
  parsed.clashLinks = normalizeDebateClashLinks(parsed.clashLinks);
  parsed.scoreRationale = normalizeScoreRationale(parsed.scoreRationale, parsed);
  const hasPrepNotes = truncateNotesForPrompt(params.prepNotes).length > 0;
  const normalizedNoteFeedback = normalizeNoteTakingFeedback(
    parsed.noteTakingFeedback,
    hasPrepNotes
  );
  parsed.noteTakingFeedback = hasPrepNotes
    ? ensureNoteTakingFeedback(
        normalizedNoteFeedback,
        createFallbackNoteTakingFeedback(parsed, params)
      )
    : null;
  parsed.improvementPlan = ensurePracticeActionSteps(
    normalizePracticeActionSteps(parsed.improvementPlan),
    parsed,
    params
  );
  parsed.shadowExamples = ensureShadowExamples(
    normalizeShadowExamples(parsed.shadowExamples),
    parsed,
    params
  );
  applyVietnameseDebateSoftCaps(parsed, params);
  return parsed;
}

export async function judgeDebateDuel(params: {
  motion: string;
  topicCategory: string;
  practiceLanguage?: PracticeLanguage;
  participants: {
    proposition: { participantId: string | null; displayName: string };
    opposition: { participantId: string | null; displayName: string };
  };
  speeches: Array<{
    id: string;
    roundNumber: number;
    speechType: "opening" | "rebuttal";
    side: "proposition" | "opposition";
    label: string;
    transcript: string;
    durationSeconds: number;
    qualityFlags?: string[];
  }>;
}, userId?: string, onTelemetry?: AiTelemetryCallback): Promise<DebateDuelJudgment> {
  const provider = getDuelJudgeProvider();
  let fallbackFromDeepSeek = false;

  if (provider === "deepseek") {
    try {
      return await judgeDebateDuelWithDeepSeek(params, userId, onTelemetry);
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.warn(
          "DeepSeek duel judgment failed; falling back to Gemini:",
          error instanceof Error ? error.message : error
        );
      }
      fallbackFromDeepSeek = true;
    }
  }

  return judgeDebateDuelWithGemini(
    params,
    userId,
    onTelemetry,
    fallbackFromDeepSeek
  );
}

async function judgeDebateDuelWithGemini(params: {
  motion: string;
  topicCategory: string;
  practiceLanguage?: PracticeLanguage;
  participants: {
    proposition: { participantId: string | null; displayName: string };
    opposition: { participantId: string | null; displayName: string };
  };
  speeches: Array<{
    id: string;
    roundNumber: number;
    speechType: "opening" | "rebuttal";
    side: "proposition" | "opposition";
    label: string;
    transcript: string;
    durationSeconds: number;
    qualityFlags?: string[];
  }>;
}, userId?: string, onTelemetry?: AiTelemetryCallback, fallbackUsed = false): Promise<DebateDuelJudgment> {
  const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const model = getGeminiClient().getGenerativeModel({
    model: modelName,
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.2,
    },
  });

  const prompt = buildDuelJudgmentPrompt(params);
  const startTime = Date.now();
  let result;
  const providerRequestIds: string[] = [];
  try {
    result = await model.generateContent(prompt);
    const providerRequestId = await recordGeminiProviderRequest({
      model: modelName,
      status: "success",
      sourceRoute: "/api/debate-duels/judge",
      outputType: "duel_judging",
      userId,
      latencyMs: Date.now() - startTime,
      usage: result.response.usageMetadata,
      metadata: {
        speechCount: params.speeches.length,
        practiceLanguage: params.practiceLanguage ?? null,
        fallbackUsed,
      },
    });
    if (providerRequestId) providerRequestIds.push(providerRequestId);
  } catch (error) {
    await recordGeminiProviderRequest({
      model: modelName,
      status: "error",
      sourceRoute: "/api/debate-duels/judge",
      outputType: "duel_judging",
      userId,
      latencyMs: Date.now() - startTime,
      errorCode: "GEMINI_DUEL_JUDGING_FAILED",
      errorMessage: error instanceof Error ? error.message : String(error),
      metadata: {
        speechCount: params.speeches.length,
        practiceLanguage: params.practiceLanguage ?? null,
        fallbackUsed,
      },
    });
    throw error;
  }
  const latency = Date.now() - startTime;
  const text = result.response.text();

  if (userId) {
    const usage = result.response.usageMetadata;
    getPostHogServer().capture({
      distinctId: userId,
      event: "$ai_generation",
      properties: {
        $ai_provider: "google",
        $ai_model: modelName,
        $ai_input_tokens: usage?.promptTokenCount,
        $ai_output_tokens: usage?.candidatesTokenCount,
        $ai_latency: latency,
        $ai_is_error: false,
        $ai_trace_id: crypto.randomUUID(),
        route: "/api/debate-duels/judge",
      },
    });
  }
  await emitAiTelemetry(onTelemetry, {
    provider: "google",
    requestedProvider: getProviderLabel(getDuelJudgeProvider()),
    model: modelName,
    latencyMs: latency,
    providerRequestIds,
    fallbackUsed,
    usage: {
      inputTokens: result.response.usageMetadata?.promptTokenCount,
      outputTokens: result.response.usageMetadata?.candidatesTokenCount,
    },
  });

  let parsed: DebateDuelJudgment;
  try {
    parsed = JSON.parse(text) as DebateDuelJudgment;
  } catch {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Invalid response: could not find JSON in Gemini output");
    }
    parsed = JSON.parse(jsonMatch[0]) as DebateDuelJudgment;
  }

  if (!parsed.winnerSide || !parsed.comparativeBallot || !parsed.participantFeedback) {
    throw new Error("Invalid duel judgment structure from Gemini");
  }

  parsed.winnerParticipantId =
    parsed.winnerParticipantId ??
    (parsed.winnerSide === "proposition"
      ? params.participants.proposition.participantId
      : params.participants.opposition.participantId);
  parsed.model = parsed.model || modelName;
  parsed.judgedAt = parsed.judgedAt || new Date().toISOString();
  parsed.qualityWarnings = parsed.qualityWarnings ?? [];
  parsed.roundBreakdown = parsed.roundBreakdown ?? [];
  parsed.clashLinks = normalizeDebateDuelClashLinks(parsed.clashLinks);

  return parsed;
}

async function judgeDebateDuelWithDeepSeek(params: {
  motion: string;
  topicCategory: string;
  practiceLanguage?: PracticeLanguage;
  participants: {
    proposition: { participantId: string | null; displayName: string };
    opposition: { participantId: string | null; displayName: string };
  };
  speeches: Array<{
    id: string;
    roundNumber: number;
    speechType: "opening" | "rebuttal";
    side: "proposition" | "opposition";
    label: string;
    transcript: string;
    durationSeconds: number;
    qualityFlags?: string[];
  }>;
}, userId?: string, onTelemetry?: AiTelemetryCallback): Promise<DebateDuelJudgment> {
  const createDeepSeekChatCompletion = await loadDeepSeekChatCompletion();
  const prompt = buildDuelJudgmentPrompt(params);
  const startTime = Date.now();
  const result = await createDeepSeekChatCompletion({
    messages: [
      {
        role: "system",
        content:
          "You are Thinkfy's rigorous debate judge. Return only valid JSON matching the requested schema.",
      },
      { role: "user", content: prompt },
    ],
    thinking: { type: "enabled", reasoningEffort: "high" },
    responseFormat: "json_object",
    maxTokens: 8192,
    userId,
    sourceRoute: "/api/debate-duels/judge",
    outputType: "duel_judging",
    metadata: {
      speechCount: params.speeches.length,
      practiceLanguage: params.practiceLanguage ?? null,
    },
  });
  const providerRequestIds = result.providerRequestId ? [result.providerRequestId] : [];
  const latency = Date.now() - startTime;

  if (userId) {
    const usage = result.usage;
    getPostHogServer().capture({
      distinctId: userId,
      event: "$ai_generation",
      properties: {
        $ai_provider: getProviderLabel("deepseek"),
        $ai_model: result.model,
        $ai_input_tokens: usage?.prompt_tokens,
        $ai_output_tokens: usage?.completion_tokens,
        $ai_cache_hit_tokens: usage?.prompt_cache_hit_tokens,
        $ai_cache_miss_tokens: usage?.prompt_cache_miss_tokens,
        $ai_reasoning_tokens: usage?.completion_tokens_details?.reasoning_tokens,
        $ai_latency: latency,
        $ai_is_error: false,
        $ai_trace_id: crypto.randomUUID(),
        route: "/api/debate-duels/judge",
      },
    });
  }
  await emitAiTelemetry(onTelemetry, {
    provider: getProviderLabel("deepseek"),
    requestedProvider: getProviderLabel("deepseek"),
    model: result.model,
    latencyMs: latency,
    providerRequestIds,
    usage: {
      inputTokens: result.usage?.prompt_tokens,
      outputTokens: result.usage?.completion_tokens,
      totalTokens: result.usage?.total_tokens,
      cacheHitTokens: result.usage?.prompt_cache_hit_tokens,
      cacheMissTokens: result.usage?.prompt_cache_miss_tokens,
      reasoningTokens: result.usage?.completion_tokens_details?.reasoning_tokens,
    },
  });

  let parsed: DebateDuelJudgment;
  try {
    parsed = JSON.parse(result.content) as DebateDuelJudgment;
  } catch {
    const jsonMatch = result.content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Invalid response: could not find JSON in DeepSeek output");
    }
    parsed = JSON.parse(jsonMatch[0]) as DebateDuelJudgment;
  }

  if (!parsed.winnerSide || !parsed.comparativeBallot || !parsed.participantFeedback) {
    throw new Error("Invalid duel judgment structure from DeepSeek");
  }

  parsed.winnerParticipantId =
    parsed.winnerParticipantId ??
    (parsed.winnerSide === "proposition"
      ? params.participants.proposition.participantId
      : params.participants.opposition.participantId);
  parsed.model = parsed.model || result.model;
  parsed.judgedAt = parsed.judgedAt || new Date().toISOString();
  parsed.qualityWarnings = parsed.qualityWarnings ?? [];
  parsed.roundBreakdown = parsed.roundBreakdown ?? [];
  parsed.clashLinks = normalizeDebateDuelClashLinks(parsed.clashLinks);

  return parsed;
}
