import { GoogleGenerativeAI } from "@google/generative-ai";
import type { DebateScore } from "@/types/feedback";
import type {
  DebateMemory,
  DebateDuelJudgment,
  DebateRound,
  MotionBrief,
  PracticeLanguage,
  PracticeTrack,
} from "@/types";
import { buildAnalysisPrompt, buildDuelJudgmentPrompt } from "./prompts";
import { normalizeDebateDuelClashLinks } from "./debate-duels/clash-links";
import {
  normalizeDebateClashLinks,
  normalizeDebateVerdict,
} from "./feedback/debate-review";
import { normalizeTranscriptAnnotations } from "./feedback/annotations";
import {
  getDebateFeedbackDepthTarget,
  isFeedbackBelowDepthTarget,
  normalizeScoreRationale,
} from "./feedback/depth";
import { needsVietnameseProseRepair } from "./feedback/language-repair";
import { getPostHogServer } from "./posthog-server";

let genAI: GoogleGenerativeAI | null = null;

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }
  genAI ??= new GoogleGenerativeAI(apiKey);
  return genAI;
}

export async function analyzeDebate(params: {
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
}, userId?: string): Promise<DebateScore> {
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
  }
) {
  clampSectionScores(parsed);
  parsed.practiceTrack = parsed.practiceTrack ?? params.practiceTrack ?? "debate";
  parsed.practiceLanguage = parsed.practiceLanguage ?? params.practiceLanguage ?? "en";
  parsed.argumentBreakdowns = parsed.argumentBreakdowns ?? [];
  parsed.missingLayers = parsed.missingLayers ?? [];
  parsed.strongerRebuilds = parsed.strongerRebuilds ?? [];
  parsed.transcriptAnnotations = normalizeTranscriptAnnotations(
    parsed.transcriptAnnotations
  );
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
}, userId?: string): Promise<DebateDuelJudgment> {
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
