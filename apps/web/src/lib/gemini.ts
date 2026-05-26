import { createHash } from "node:crypto";
import { GoogleGenerativeAI } from "@google/generative-ai";
import type {
  DebateArgumentBreakdown,
  DebateClashLink,
  DebateScore,
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
  getProviderLabel,
} from "@/lib/ai/provider-selection";
import type { AiQualityTelemetry } from "@/lib/ai/quality-model";
import type { PracticeTranscriptionArtifact } from "@thinkfy/shared/practice";
import { buildAnalysisPrompt, buildDuelJudgmentPrompt } from "./prompts";
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
import { needsVietnameseProseRepair } from "./feedback/language-repair";
import { getPostHogServer } from "./posthog-server";
import { buildSttJudgeGuardrailBlock } from "./stt/prompt";

const geminiClients = new Map<string, GoogleGenerativeAI>();

function getGeminiApiKeys() {
  const pooledKeys =
    process.env.GEMINI_API_KEYS?.split(",")
      .map((key) => key.trim())
      .filter(Boolean) ?? [];
  const singleKey = process.env.GEMINI_API_KEY?.trim();
  const keys = pooledKeys.length > 0 ? pooledKeys : singleKey ? [singleKey] : [];
  return Array.from(new Set(keys));
}

function getGeminiClientForApiKey(apiKey: string) {
  const key = apiKey.trim();
  const configured = getGeminiApiKeys().length > 0;
  if (!key || !configured) {
    throw new Error("GEMINI_API_KEY or GEMINI_API_KEYS is not configured");
  }
  const existing = geminiClients.get(key);
  if (existing) return existing;
  const client = new GoogleGenerativeAI(key);
  geminiClients.set(key, client);
  return client;
}

function hashStringToNumber(value: string) {
  const digest = createHash("sha256").update(value).digest("hex").slice(0, 8);
  return Number.parseInt(digest, 16) || 0;
}

function getGeminiKeySlot(seed: string, keyCount: number) {
  if (keyCount <= 1) return 0;
  return hashStringToNumber(seed) % keyCount;
}

function isGeminiQuotaOrRateLimitError(error: unknown) {
  const source = error as { status?: number; code?: number; message?: string };
  const status = source?.status ?? source?.code;
  const message =
    error instanceof Error ? error.message : String(source?.message ?? error);
  return (
    status === 429 ||
    /429|quota|rate.?limit|resource_exhausted|too many requests/i.test(message)
  );
}

function getGeminiKeyCountForTelemetry() {
  return getGeminiApiKeys().length || 0;
}

function getGeminiClient() {
  const apiKey = getGeminiApiKeys()[0];
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY or GEMINI_API_KEYS is not configured");
  }
  return getGeminiClientForApiKey(apiKey);
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

  return `## Dynamic Debate Context
Motion: ${params.topic}
Student side: ${params.side}
Speech type: ${params.speechType}
Full round: ${Boolean(params.isFullRound)}
Time setting: ${params.timeLimit} minutes
Actual duration: ${params.actualDuration} seconds
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
  providerAudit?: {
    sourceRoute?: string;
    practiceAttemptId?: string;
    analysisJobId?: string;
    metadata?: Record<string, unknown>;
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
};

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

function getStagedFullRoundJudgeModelName() {
  return (
    process.env.GEMINI_FULL_ROUND_JUDGE_MODEL ||
    process.env.GEMINI_FLASH_LITE_MODEL ||
    "gemini-3.1-flash-lite"
  );
}

async function emitAiTelemetry(
  onTelemetry: AiTelemetryCallback | undefined,
  telemetry: AiQualityTelemetry
) {
  if (!onTelemetry) return;
  await onTelemetry(telemetry);
}

export async function analyzeDebate(
  params: AnalyzeDebateParams,
  userId?: string,
  onTelemetry?: AiTelemetryCallback
): Promise<DebateScore> {
  if (shouldUseStagedFullRoundJudge(params)) {
    return analyzeFullRoundDebateWithStagedGemini(params, userId, onTelemetry);
  }

  const provider = getPracticeFeedbackProvider(params.practiceTrack ?? "debate");
  let fallbackFromDeepSeek = false;

  if (provider === "deepseek") {
    try {
      return await analyzeDebateWithDeepSeek(params, userId, onTelemetry);
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.warn(
          process.env.DEEPSEEK_ANALYSIS_FALLBACK === "gemini"
            ? "DeepSeek analysis failed; falling back to Gemini:"
            : "DeepSeek analysis failed:",
          error instanceof Error ? error.message : error
        );
      }
      if (process.env.DEEPSEEK_ANALYSIS_FALLBACK !== "gemini") {
        throw error;
      }
      fallbackFromDeepSeek = true;
    }
  }

  return analyzeDebateWithGemini(params, userId, onTelemetry, fallbackFromDeepSeek);
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
}): Promise<GeminiStageResult> {
  const keys = getGeminiApiKeys();
  if (keys.length === 0) {
    throw new Error("GEMINI_API_KEY or GEMINI_API_KEYS is not configured");
  }

  const seed = params.keySeed ?? `${params.modelName}:${params.stage}`;
  const startSlot = getGeminiKeySlot(seed, keys.length);
  let lastError: unknown = null;

  for (let offset = 0; offset < keys.length; offset += 1) {
    const slot = (startSlot + offset) % keys.length;
    const model = getGeminiClientForApiKey(keys[slot]).getGenerativeModel({
      model: params.modelName,
      generationConfig: {
        responseMimeType: "application/json",
        temperature: params.temperature ?? 0.25,
        maxOutputTokens: params.maxOutputTokens,
      },
    });
    const startTime = Date.now();
    try {
      const result = await model.generateContent(params.prompt);
      return {
        stage: params.stage,
        text: result.response.text(),
        latencyMs: Date.now() - startTime,
        usage: result.response.usageMetadata,
        keySlot: slot,
        keyFallbackCount: offset,
      };
    } catch (error) {
      lastError = error;
      if (!isGeminiQuotaOrRateLimitError(error) || offset === keys.length - 1) {
        throw error;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
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
  };
}

function buildStagedFullRoundBaseContext(params: AnalyzeDebateParams) {
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
  return `You are Thinkfy's staged full-round debate judge.
${language}
Judge only the student's/user's skill and whether the user beat the AI opponent in this practice round.
Be strict about mechanism, clash, weighing, and strategic adaptation.
Do not penalize likely speech-to-text spelling artifacts unless the meaning remains unclear after context.
${truongTeenJudgingContext}

${buildDeepSeekAnalysisDynamicContext(params)}`;
}

function buildSpeechMapPrompt(params: AnalyzeDebateParams) {
  return `${buildStagedFullRoundBaseContext(params)}

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
  return `${buildStagedFullRoundBaseContext(params)}

## Stage 1 Output To Use
${JSON.stringify(speechMap)}

## Stage 2 Task: Verdict, Scores, And Coaching
Use the speech map and transcript to produce the full Thinkfy debate feedback JSON.

Important:
- Decide debateVerdict.winner as "user", "ai", or "tie".
- Include 3-5 argumentBreakdowns and 3-5 clashLinks.
- Set transcriptAnnotations to [] in this stage. A separate quote-anchoring stage will fill them.
- Keep scores strict and internally consistent. totalScore must equal the four category scores.
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
  return `${buildStagedFullRoundBaseContext(params)}

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
  params: AnalyzeDebateParams
) {
  if (feedback.totalScore <= cap) return false;
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
    if (reason === "fewer than 3 model-produced clash links") {
      return "phản hồi ban đầu có dưới 3 liên kết va chạm do mô hình tự tạo";
    }
    if (reason === "fewer than 3 model-produced argument breakdowns") {
      return "phản hồi ban đầu có dưới 3 phần bóc tách luận điểm do mô hình tự tạo";
    }
    if (reason === "annotation fallback was needed") {
      return "hệ thống phải tự bổ sung một phần chú thích vì mô hình neo dẫn chứng chưa đủ chắc";
    }
    return reason;
  });
  const capNote = vi
    ? `Điểm được giới hạn vì phản hồi chiến lược ban đầu còn thiếu độ phủ: ${readableReasons.join("; ")}.`
    : `Score capped because the initial strategic feedback lacked coverage: ${readableReasons.join("; ")}.`;
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

  return true;
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

  const speechMapPrompt = buildSpeechMapPrompt(params);
  stagePromptHashes.speech_map = createHash("sha256")
    .update(speechMapPrompt)
    .digest("hex");
  const speechMapStage = await generateGeminiStage({
    modelName,
    stage: "speech_map",
    prompt: speechMapPrompt,
    maxOutputTokens: 4096,
    temperature: 0.2,
    keySeed: `${userId ?? "anonymous"}:${params.topic}:speech_map`,
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
  const verdictStage = await generateGeminiStage({
    modelName,
    stage: "verdict_feedback",
    prompt: verdictPrompt,
    maxOutputTokens: 8192,
    temperature: 0.25,
    keySeed: `${userId ?? "anonymous"}:${params.topic}:verdict_feedback`,
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
  try {
    const annotationPrompt = buildStagedAnnotationPrompt(
      params,
      speechMap,
      parsed
    );
    stagePromptHashes.annotation_anchor = createHash("sha256")
      .update(annotationPrompt)
      .digest("hex");
    const annotationStage = await generateGeminiStage({
      modelName,
      stage: "annotation_anchor",
      prompt: annotationPrompt,
      maxOutputTokens: 4096,
      temperature: 0.15,
      keySeed: `${userId ?? "anonymous"}:${params.topic}:annotation_anchor`,
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
    metadata: {
      judgePipeline: "staged_full_round_gemini",
      judgeStageCount: stages.length,
      judgeStageLatenciesMs: summary.stageLatencies,
      judgeStageUsage: summary.stageUsage,
      judgeStageKeySlots: summary.stageKeySlots,
      geminiKeyPoolSize: getGeminiKeyCountForTelemetry(),
      judgeStagePromptHashes: stagePromptHashes,
      annotationStageError,
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
        params.practiceTrack !== "speaking" && params.isFullRound ? 12000 : 4096,
    },
  });

  const prompt = buildAnalysisPrompt(params);
  const startTime = Date.now();
  const result = await model.generateContent(prompt);
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
    usage: {
      inputTokens: result.response.usageMetadata?.promptTokenCount,
      outputTokens: result.response.usageMetadata?.candidatesTokenCount,
    },
  });

  let parsed = await parseGeminiFeedbackWithRetry(model, prompt, text);

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
    const repairResult = await model.generateContent(repairPrompt);
    parsed = normalizeDebateScore(
      await parseGeminiFeedbackWithRetry(
        model,
        repairPrompt,
        repairResult.response.text()
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
- Rewrite every user-facing explanation in natural Vietnamese: summary, strengths, improvements, sampleArguments, case feedback, argumentBreakdowns text, missingLayers, weighingFeedback, clashFeedback, strongerRebuilds, detailedFeedback, debateVerdict prose, clashLinks judgeRead/suggestion, transcriptAnnotations feedback/suggestion, and scoreRationale prose.
- JSON only.`;
    const languageRepairResult = await model.generateContent(languageRepairPrompt);
    parsed = normalizeDebateScore(
      await parseGeminiFeedbackWithRetry(
        model,
        languageRepairPrompt,
        languageRepairResult.response.text()
      ),
      params
    );
  }

  return parsed;
}

async function analyzeDebateWithDeepSeek(
  params: AnalyzeDebateParams,
  userId?: string,
  onTelemetry?: AiTelemetryCallback
): Promise<DebateScore> {
  const createDeepSeekChatCompletion = await loadDeepSeekChatCompletion();
  const verdictDraft: Record<string, unknown> | null = null;

  const prompt = buildCompactDeepSeekAnalysisPrompt(params, verdictDraft);
  const { messages, promptPrefixHash } = buildDeepSeekAnalysisMessages(
    params,
    verdictDraft
  );
  const maxTokens =
    params.practiceTrack !== "speaking" && params.isFullRound ? 7000 : 4096;
  const thinking = { type: "disabled" } as const;
  const generateText = (nextPrompt: string) =>
    createDeepSeekChatCompletion({
      messages: [
        messages[0],
        messages[1],
        { role: "user", content: nextPrompt },
      ],
      thinking: { type: "disabled" },
      responseFormat: "json_object",
      maxTokens: Math.min(maxTokens, 4096),
      userId,
      timeoutMs: 30000,
      sourceRoute: params.providerAudit?.sourceRoute ?? "/api/analyze",
      outputType: "practice_judging",
      practiceAttemptId: params.providerAudit?.practiceAttemptId,
      analysisJobId: params.providerAudit?.analysisJobId,
      metadata: {
        phase: "json_regeneration_or_repair",
        ...(params.providerAudit?.metadata ?? {}),
      },
    }).then((retryResult) => retryResult.content);

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
      timeoutMs: 30000,
      sourceRoute: params.providerAudit?.sourceRoute ?? "/api/analyze",
      outputType: "practice_judging",
      practiceAttemptId: params.providerAudit?.practiceAttemptId,
      analysisJobId: params.providerAudit?.analysisJobId,
      metadata: {
        phase: "primary",
        isFullRound: params.isFullRound ?? false,
        ...(params.providerAudit?.metadata ?? {}),
      },
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith("DeepSeek returned an empty response")
    ) {
      internalRetryUsed = true;
      result = await createDeepSeekChatCompletion({
        messages,
        thinking,
        responseFormat: "json_object",
        maxTokens,
        userId,
        timeoutMs: 30000,
        sourceRoute: params.providerAudit?.sourceRoute ?? "/api/analyze",
        outputType: "practice_judging",
        practiceAttemptId: params.providerAudit?.practiceAttemptId,
        analysisJobId: params.providerAudit?.analysisJobId,
        metadata: {
          phase: "empty_response_internal_retry",
          isFullRound: params.isFullRound ?? false,
          ...(params.providerAudit?.metadata ?? {}),
        },
      });
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
    requestedProvider: getProviderLabel("deepseek"),
    model: result.model,
    latencyMs: latency,
    metadata: {
      deepSeekPromptPrefixHash: promptPrefixHash,
      deepSeekInternalRetryUsed: internalRetryUsed,
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
- Rewrite every user-facing explanation in natural Vietnamese: summary, strengths, improvements, sampleArguments, case feedback, argumentBreakdowns text, missingLayers, weighingFeedback, clashFeedback, strongerRebuilds, detailedFeedback, debateVerdict prose, clashLinks judgeRead/suggestion, transcriptAnnotations feedback/suggestion, and scoreRationale prose.
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
    ) => Promise<{ response: { text: () => string } }>;
  },
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
    const retryResult = await model.generateContent(retryPrompt);
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
  const result = await model.generateContent(prompt);
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
