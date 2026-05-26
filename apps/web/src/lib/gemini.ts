import { createHash } from "node:crypto";
import { GoogleGenerativeAI } from "@google/generative-ai";
import type {
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

let genAI: GoogleGenerativeAI | null = null;

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }
  genAI ??= new GoogleGenerativeAI(apiKey);
  return genAI;
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
}): Promise<GeminiStageResult> {
  const model = getGeminiClient().getGenerativeModel({
    model: params.modelName,
    generationConfig: {
      responseMimeType: "application/json",
      temperature: params.temperature ?? 0.25,
      maxOutputTokens: params.maxOutputTokens,
    },
  });
  const startTime = Date.now();
  const result = await model.generateContent(params.prompt);
  return {
    stage: params.stage,
    text: result.response.text(),
    latencyMs: Date.now() - startTime,
    usage: result.response.usageMetadata,
  };
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
- Return 4-6 annotations.
- quote must be an exact contiguous quote copied from the transcript or a round.
- Never use the motion title, greetings, filler, or generic opening as the quote.
- If feedback talks about a specific flaw, quote the sentence containing that flaw or its immediate context.
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

  const depthTarget = getDebateFeedbackDepthTarget({
    isFullRound: true,
    actualDuration: params.actualDuration,
    roundCount: params.rounds?.length,
  });

  if (
    ((parsed.argumentBreakdowns?.length ?? 0) < depthTarget.minArgumentBreakdowns ||
      (parsed.clashLinks?.length ?? 0) < depthTarget.minClashLinks) &&
    process.env.PRACTICE_FULL_ROUND_STAGED_REPAIR_ENABLED !== "false"
  ) {
    const repairPrompt = `${verdictPrompt}

## Existing Feedback To Repair
${JSON.stringify(parsed)}

## Repair Task
The feedback is missing enough argumentBreakdowns or clashLinks for a full-round debate.
Return the full feedback JSON again. Preserve the current verdict and scores unless they are inconsistent, keep transcriptAnnotations as [], and expand only the missing strategic detail.`;
    stagePromptHashes.depth_repair = createHash("sha256")
      .update(repairPrompt)
      .digest("hex");
    const repairStage = await generateGeminiStage({
      modelName,
      stage: "depth_repair",
      prompt: repairPrompt,
      maxOutputTokens: 8192,
      temperature: 0.2,
    });
    stages.push(repairStage);
    const repaired = parseGeminiFeedback(repairStage.text);
    repaired.transcriptAnnotations = parsed.transcriptAnnotations;
    parsed = normalizeDebateScore(repaired, params);
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
    metadata: {
      judgePipeline: "staged_full_round_gemini",
      judgeStageCount: stages.length,
      judgeStageLatenciesMs: summary.stageLatencies,
      judgeStageUsage: summary.stageUsage,
      judgeStagePromptHashes: stagePromptHashes,
      annotationStageError,
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
