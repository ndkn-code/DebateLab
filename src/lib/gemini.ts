import { GoogleGenerativeAI } from "@google/generative-ai";
import type { DebateScore } from "@/types/feedback";
import type { DebateDuelJudgment, DebateRound, PracticeTrack } from "@/types";
import { buildAnalysisPrompt, buildDuelJudgmentPrompt } from "./prompts";
import { getPostHogServer } from "./posthog-server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function analyzeDebate(params: {
  transcript: string;
  topic: string;
  side: "proposition" | "opposition";
  speechType: string;
  timeLimit: number;
  actualDuration: number;
  practiceTrack?: PracticeTrack;
  isFullRound?: boolean;
  rounds?: DebateRound[];
}, userId?: string): Promise<DebateScore> {
  const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.3,
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

  // Try to parse JSON, with fallback extraction
  let parsed: DebateScore;
  try {
    parsed = JSON.parse(text) as DebateScore;
  } catch {
    // Try to extract JSON from markdown code blocks or surrounding text
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Invalid response: could not find JSON in Gemini output");
    }
    try {
      parsed = JSON.parse(jsonMatch[0]) as DebateScore;
    } catch {
      throw new Error("Invalid response: Gemini returned malformed JSON");
    }
  }

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

  parsed.practiceTrack = parsed.practiceTrack ?? params.practiceTrack ?? "debate";
  parsed.argumentBreakdowns = parsed.argumentBreakdowns ?? [];
  parsed.missingLayers = parsed.missingLayers ?? [];
  parsed.strongerRebuilds = parsed.strongerRebuilds ?? [];

  return parsed;
}

export async function judgeDebateDuel(params: {
  motion: string;
  topicCategory: string;
  participants: {
    proposition: { participantId: string | null; displayName: string };
    opposition: { participantId: string | null; displayName: string };
  };
  speeches: Array<{
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
  const model = genAI.getGenerativeModel({
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

  return parsed;
}
