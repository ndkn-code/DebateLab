import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@/lib/supabase/server";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getPostHogServer } from "@/lib/posthog-server";
import { getDevAuthBypassUserFromRequest } from "@/lib/dev-auth-bypass";
import { getPracticeLanguageConfig } from "@/lib/practice-language";
import {
  getEnum,
  getString,
  isPlainRecord,
  readJsonObject,
  RequestValidationError,
  type JsonRecord,
} from "@/lib/api/request-validation";
import type {
  AiDifficulty,
  AiHighlight,
  AiHighlightType,
  PracticeLanguage,
  PracticeTrack,
} from "@/types";

export const maxDuration = 30;

interface RebuttalRequest {
  topic: string;
  side: "proposition" | "opposition";
  userTranscript: string;
  roundLabel: string;
  difficulty: AiDifficulty;
  practiceTrack?: PracticeTrack;
  practiceLanguage: PracticeLanguage;
  previousRounds?: { label: string; speaker: string; text: string }[];
}

interface StructuredRebuttalResponse {
  rebuttal: string;
  highlights?: AiHighlight[];
}

function parsePreviousRounds(value: unknown) {
  if (value == null) return undefined;
  if (!Array.isArray(value) || value.length > 8) {
    throw new RequestValidationError("previousRounds is invalid.");
  }

  return value.map((round, index) => {
    if (!isPlainRecord(round)) {
      throw new RequestValidationError(`previousRounds[${index}] is invalid.`);
    }

    const label =
      typeof round.label === "string"
        ? round.label.trim().slice(0, 80)
        : `Round ${index + 1}`;
    const speaker =
      typeof round.speaker === "string"
        ? round.speaker.trim().slice(0, 80)
        : "speaker";
    const text =
      typeof round.text === "string"
        ? round.text.trim().slice(0, 8000)
        : "";

    return { label, speaker, text };
  });
}

function parseRebuttalRequest(body: JsonRecord): RebuttalRequest {
  return {
    topic: getString(body, "topic", {
      required: true,
      minLength: 2,
      maxLength: 300,
    })!,
    side: getEnum(body, "side", ["proposition", "opposition"] as const, {
      required: true,
    })!,
    userTranscript: getString(body, "userTranscript", {
      required: true,
      minLength: 1,
      maxLength: 25000,
    })!,
    roundLabel: getString(body, "roundLabel", {
      required: true,
      minLength: 1,
      maxLength: 80,
    })!,
    difficulty: getEnum(body, "difficulty", ["easy", "medium", "hard"] as const, {
      defaultValue: "medium",
    }) as AiDifficulty,
    practiceTrack: getEnum(
      body,
      "practiceTrack",
      ["speaking", "debate"] as const,
      { defaultValue: "debate" }
    ) as PracticeTrack,
    practiceLanguage: getEnum(
      body,
      "practiceLanguage",
      ["en", "vi"] as const,
      { defaultValue: "en" }
    ) as PracticeLanguage,
    previousRounds: parsePreviousRounds(body.previousRounds),
  };
}

const difficultyPrompts: Record<AiDifficulty, string> = {
  easy: `You are a BEGINNER-level debate opponent. Your rebuttals should:
- Use simple but complete counter-arguments
- Challenge the student's main idea without attacking every possible layer
- Use basic vocabulary appropriate for ESL students
- Be 80-120 words long
- Leave some strategic openings that the student can answer`,

  medium: `You are a COMPETENT debate opponent. Your rebuttals should:
- Present solid, well-structured arguments with clear clash
- Address the opponent's logic, not just their wording
- Do at least one layer of comparison or impact weighing
- Use intermediate academic vocabulary
- Be 100-150 words long
- Challenge the student while remaining fair`,

  hard: `You are an EXPERT debate opponent (national championship level). Your rebuttals should:
- Present sophisticated, multi-layered clash
- Test assumptions, attack the mechanism, and compare impacts explicitly
- Reframe the judge's choice around comparative weighing
- Use precise, advanced but still spoken vocabulary
- Be 120-180 words long
- Force the student to think deeply and defend their position rigorously`,
};

function isHighlightType(value: unknown): value is AiHighlightType {
  return (
    value === "claim" ||
    value === "evidence" ||
    value === "impact" ||
    value === "assumption"
  );
}

function normalizeHighlights(raw: unknown): AiHighlight[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const candidate = item as Record<string, unknown>;
      const quote = typeof candidate.quote === "string" ? candidate.quote.trim() : "";
      if (!quote || !isHighlightType(candidate.type)) return null;

      return {
        type: candidate.type,
        quote,
        note:
          typeof candidate.note === "string" && candidate.note.trim()
            ? candidate.note.trim()
            : undefined,
      };
    })
    .filter(Boolean) as AiHighlight[];
}

function parseStructuredRebuttal(rawText: string): StructuredRebuttalResponse {
  const trimmed = rawText.trim();
  const jsonCandidate =
    trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim() ??
    trimmed.match(/\{[\s\S]*\}/)?.[0]?.trim() ??
    trimmed;

  try {
    const parsed = JSON.parse(jsonCandidate) as Record<string, unknown>;
    const rebuttal =
      typeof parsed.rebuttal === "string" ? parsed.rebuttal.trim() : "";
    if (!rebuttal) {
      return { rebuttal: trimmed, highlights: [] };
    }

    return {
      rebuttal,
      highlights: normalizeHighlights(parsed.highlights),
    };
  } catch {
    return { rebuttal: trimmed, highlights: [] };
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const authUser = user
      ? { id: user.id, email: user.email ?? null }
      : getDevAuthBypassUserFromRequest(req);

    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (user) {
      const rateLimit = await consumeRateLimit(supabase, {
        scope: "rebuttal",
        limit: 10,
        windowSeconds: 60,
      });
      if (!rateLimit.success) {
        return NextResponse.json(
          { error: "Too many requests. Please wait a moment." },
          {
            status: 429,
            headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
          }
        );
      }
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "API key not configured." },
        { status: 500 }
      );
    }

    const body = parseRebuttalRequest(
      await readJsonObject(req, { maxBytes: 64 * 1024 })
    );
    const {
      topic,
      side,
      userTranscript,
      roundLabel,
      difficulty,
      practiceTrack,
      practiceLanguage,
      previousRounds,
    } = body;

    if (!topic || !userTranscript || !roundLabel) {
      return NextResponse.json(
        { error: "Missing required fields." },
        { status: 400 }
      );
    }

    const aiSide = side === "proposition" ? "Opposition (AGAINST)" : "Proposition (FOR)";
    const difficultyInstructions = difficultyPrompts[difficulty || "medium"];
    const track = practiceTrack || "debate";
    const languageConfig = getPracticeLanguageConfig(practiceLanguage);
    const responseLanguageInstruction =
      practiceLanguage === "vi"
        ? "Write the rebuttal and highlight notes in Vietnamese. Preserve Vietnamese diacritics and use natural spoken Vietnamese debate language."
        : "Write the rebuttal and highlight notes in English for students practicing English debate.";
    const learnerContext =
      practiceLanguage === "vi"
        ? "This is for Vietnamese high school students practicing debate in Vietnamese, so be a challenging but fair practice partner."
        : "This is for Vietnamese high school students practicing debate in English, so be a challenging but fair practice partner.";

    let contextSection = "";
    if (previousRounds && previousRounds.length > 0) {
      contextSection = "\n## Previous Rounds\n" +
        previousRounds
          .map((r) => `### ${r.label} (${r.speaker})\n${r.text}`)
          .join("\n\n");
    }

    const roundInstructions =
      roundLabel.toLowerCase().includes("closing")
        ? `This is a closing speech. Summarize the winning comparative framing, explain why your side wins on the key weighing, and crystallize the most important impacts. Do not just repeat earlier claims.`
        : `This is a rebuttal speech. Directly answer the opponent's main claims by exposing weak assumptions, breaking their mechanism, comparing worlds, and weighing impacts.`;

    const prompt = `You are a debate AI playing the ${aiSide} side in a Trường Teen-style debate.

## Topic/Motion
"${topic}"

${difficultyInstructions}
${contextSection}

## Current Round: ${roundLabel}
## Practice Track
${track}

## Practice Language
${languageConfig.label}
${responseLanguageInstruction}

## Opponent's Latest Speech
"""
${userTranscript}
"""

## Your Task
Write a ${roundLabel.toLowerCase()} responding to the opponent's speech. This is a spoken debate, so write in a natural speaking style — conversational but academically sharp.

${roundInstructions}

Rules:
- Directly address and counter specific points from the opponent's speech
- Structure your logic around: argument label -> explanation or mechanism -> comparison or weighing -> impact -> link back to your side
- Prioritize depth over fancy wording
- Maintain your side (${aiSide}) consistently
- Be respectful but firm
- ${learnerContext}

Return ONLY valid JSON in this exact shape:
{
  "rebuttal": "the spoken rebuttal text only",
  "highlights": [
    {
      "type": "claim" | "evidence" | "impact" | "assumption",
      "quote": "an exact quote copied from the rebuttal text",
      "note": "short student-friendly reason this phrase matters"
    }
  ]
}

Highlight 3-5 exact quotes that a student should notice. Use only quote strings that appear verbatim in "rebuttal".`;

    const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 500,
      },
    });

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("TIMEOUT")), 25000);
    });

    const startTime = Date.now();
    const result = await Promise.race([
      model.generateContent(prompt),
      timeoutPromise,
    ]);
    const latency = Date.now() - startTime;

    const text = result.response.text().trim();
    const structuredResponse = parseStructuredRebuttal(text);
    const usage = result.response.usageMetadata;

    getPostHogServer().capture({
      distinctId: authUser.id,
      event: "$ai_generation",
      properties: {
        $ai_provider: "google",
        $ai_model: modelName,
        $ai_input_tokens: usage?.promptTokenCount,
        $ai_output_tokens: usage?.candidatesTokenCount,
        $ai_latency: latency,
        $ai_is_error: false,
        $ai_trace_id: crypto.randomUUID(),
        route: "/api/rebuttal",
      },
    });

    return NextResponse.json(structuredResponse);
  } catch (err) {
    if (err instanceof RequestValidationError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    if (process.env.NODE_ENV === 'development') console.error("Rebuttal API error:", err);

    if (err instanceof Error) {
      if (err.message === "TIMEOUT") {
        return NextResponse.json(
          { error: "AI response timed out. Please try again." },
          { status: 504 }
        );
      }
      if (err.message.includes("429") || err.message.includes("rate")) {
        return NextResponse.json(
          { error: "Rate limit reached. Please wait and try again." },
          { status: 429 }
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to generate AI rebuttal." },
      { status: 500 }
    );
  }
}
