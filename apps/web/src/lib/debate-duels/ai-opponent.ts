import "server-only";

import { randomUUID } from "node:crypto";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createDeepSeekChatCompletion } from "@/lib/ai/deepseek";
import { tryCreateAdminClient } from "@/lib/supabase/admin";
import type { DebateDuelSide, PracticeLanguage } from "@/types";

const AI_OPPONENT_EMAIL = "ai-opponent@thinkfy.system";
export const AI_OPPONENT_DISPLAY_NAME = "AI Sparring Partner";

/**
 * Returns the id of the sentinel AI-opponent user, creating it once if needed.
 * AI-backfill duels reference this user as the opposition participant. It never
 * logs in and is never charged; it just gives the AI a valid participant row.
 */
export async function ensureAiOpponentUser(): Promise<string> {
  const admin = tryCreateAdminClient();
  if (!admin) throw new Error("ADMIN_CLIENT_UNAVAILABLE");

  const existing = await admin
    .from("profiles")
    .select("id")
    .eq("email", AI_OPPONENT_EMAIL)
    .maybeSingle();
  if (existing.data?.id) return existing.data.id as string;

  const { data, error } = await admin.auth.admin.createUser({
    email: AI_OPPONENT_EMAIL,
    email_confirm: true,
    password: randomUUID(),
    user_metadata: { display_name: AI_OPPONENT_DISPLAY_NAME },
  });
  if (error || !data.user) {
    // Likely a concurrent create — re-fetch before giving up.
    const retry = await admin
      .from("profiles")
      .select("id")
      .eq("email", AI_OPPONENT_EMAIL)
      .maybeSingle();
    if (retry.data?.id) return retry.data.id as string;
    throw new Error(
      `Failed to create AI opponent user: ${error?.message ?? "unknown error"}`
    );
  }
  return data.user.id;
}

/**
 * Generates a single duel speech for the AI opponent (used for AI-backfill
 * duels when no human is available). Deliberately self-contained — the AI judge
 * scores both sides on the same rubric, so the opponent just needs to produce a
 * competent, on-side spoken opening or rebuttal. DeepSeek primary (the same
 * provider the duel judge resolves to) with a Gemini fallback so an AI turn
 * never silently produces an empty speech.
 */
export interface DuelAiSpeechParams {
  motion: string;
  aiSide: DebateDuelSide;
  speechType: "opening" | "rebuttal";
  practiceLanguage: PracticeLanguage;
  priorSpeeches: {
    side: DebateDuelSide;
    speechType: "opening" | "rebuttal";
    transcript: string;
  }[];
  targetSeconds: number;
  userId: string;
}

function wordTargetForSeconds(seconds: number) {
  // ~2.2 spoken words/sec, clamped to a sane duel range.
  return Math.max(120, Math.min(420, Math.round(seconds * 2.2)));
}

function buildDuelAiPrompt(params: DuelAiSpeechParams) {
  const lang = params.practiceLanguage === "vi" ? "Vietnamese" : "English";
  const sideLabel =
    params.aiSide === "proposition"
      ? "Proposition (arguing FOR the motion)"
      : "Opposition (arguing AGAINST the motion)";
  const words = wordTargetForSeconds(params.targetSeconds);
  const transcriptBlock = params.priorSpeeches.length
    ? params.priorSpeeches
        .map(
          (speech) =>
            `[${speech.side === "proposition" ? "Proposition" : "Opposition"} ${speech.speechType}]\n${speech.transcript}`
        )
        .join("\n\n")
    : "(No speeches yet — you are opening the debate.)";
  const task =
    params.speechType === "opening"
      ? "Deliver your side's OPENING: frame the motion, present 2-3 substantive arguments with clear mechanisms and impacts, and set up the key clashes."
      : "Deliver your side's REBUTTAL: directly answer the opponent's strongest points, extend your own case, and weigh why your side wins the debate overall.";

  const system = `You are a sharp but fair debate opponent in a live 1v1 spoken debate. You argue the ${sideLabel}. Write a natural spoken ${params.speechType} in ${lang} of roughly ${words} words. Argue with mechanisms, comparisons, and impact weighing — never invent fake statistics, named studies, or citations. Stay consistently on your assigned side.`;
  const user = `Motion: "${params.motion}"

Debate so far:
${transcriptBlock}

${task}

Return ONLY valid JSON: {"speech": "your spoken ${params.speechType} as plain text"}.`;

  return { system, user };
}

function parseSpeech(raw: string): string {
  const text = (raw ?? "").trim();
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed.speech === "string") return parsed.speech.trim();
  } catch {
    // Not clean JSON — fall through and salvage below.
  }
  return text
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
}

async function generateWithGemini(system: string, user: string): Promise<string> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured");
  }
  const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.7,
      maxOutputTokens: 1600,
    },
  });
  const result = await model.generateContent(`${system}\n\n${user}`);
  return result.response.text().trim();
}

export async function generateDuelAiSpeech(
  params: DuelAiSpeechParams
): Promise<{ transcript: string; model: string }> {
  const { system, user } = buildDuelAiPrompt(params);

  try {
    const result = await createDeepSeekChatCompletion({
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      thinking: { type: "disabled" },
      responseFormat: "json_object",
      maxTokens: 1600,
      temperature: 0.7,
      timeoutMs: 45000,
      userId: params.userId,
      sourceRoute: "/api/debate-duels/[shareCode]/ai-turn",
      outputType: "rebuttal",
      metadata: {
        duelAiSpeech: true,
        speechType: params.speechType,
        aiSide: params.aiSide,
      },
    });
    const transcript = parseSpeech(result.content);
    if (transcript) return { transcript, model: result.model };
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("Duel AI DeepSeek generation failed; trying Gemini:", error);
    }
  }

  const transcript = parseSpeech(await generateWithGemini(system, user));
  return {
    transcript:
      transcript || "[The AI opponent could not generate a speech this round.]",
    model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
  };
}
