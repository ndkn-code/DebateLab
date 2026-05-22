import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getPostHogServer } from "@/lib/posthog-server";
import {
  requireRequestAuth,
  shouldConsumeUserRateLimit,
} from "@/lib/api/request-auth";
import { getPracticeLanguageConfig } from "@/lib/practice-language";
import {
  getEnum,
  getNumber,
  getString,
  getStringArray,
  isPlainRecord,
  readJsonObject,
  RequestValidationError,
  type JsonRecord,
} from "@/lib/api/request-validation";
import { formatMotionBriefForPrompt } from "@/lib/motion-brief";
import {
  formatDebateMemoryForPrompt,
  getRebuttalMaxOutputTokens,
  getRebuttalWordTarget,
} from "@/lib/rebuttal/debate-continuity";
import { normalizeStructuredRebuttalResponse } from "@/lib/rebuttal/structured-response";
import type {
  AiDifficulty,
  DebateMemory,
  MotionBrief,
  PracticeLanguage,
  PracticeTrack,
} from "@/types";

export const maxDuration = 60;

interface RebuttalRequest {
  topic: string;
  side: "proposition" | "opposition";
  userTranscript: string;
  roundLabel: string;
  difficulty: AiDifficulty;
  practiceTrack?: PracticeTrack;
  practiceLanguage: PracticeLanguage;
  previousRounds?: { label: string; speaker: string; text: string }[];
  speechTimeSeconds?: number;
  currentRoundNumber?: number;
  motionBrief?: MotionBrief;
  debateMemory?: DebateMemory;
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

function readLimitedString(
  source: JsonRecord,
  key: string,
  maxLength: number
) {
  const value = source[key];
  if (value == null || value === "") return "";
  if (typeof value !== "string") {
    throw new RequestValidationError(`${key} must be a string.`);
  }
  return value.trim().slice(0, maxLength);
}

function parseMotionBrief(value: unknown): MotionBrief | undefined {
  if (value == null) return undefined;
  if (!isPlainRecord(value)) {
    throw new RequestValidationError("motionBrief is invalid.");
  }

  const keyTerms = getStringArray(value.keyTerms, "motionBrief.keyTerms", {
    maxItems: 10,
    maxItemLength: 220,
  }).filter(Boolean);
  const scope = readLimitedString(value, "scope", 1200);
  const propositionBurden = readLimitedString(
    value,
    "propositionBurden",
    1200
  );
  const oppositionBurden = readLimitedString(
    value,
    "oppositionBurden",
    1200
  );
  const modelClarification = readLimitedString(
    value,
    "modelClarification",
    1200
  );

  if (
    keyTerms.length === 0 ||
    !scope ||
    !propositionBurden ||
    !oppositionBurden ||
    !modelClarification
  ) {
    throw new RequestValidationError("motionBrief is incomplete.");
  }

  return {
    keyTerms,
    scope,
    propositionBurden,
    oppositionBurden,
    modelClarification,
  };
}

function parseDebateMemory(value: unknown): DebateMemory | undefined {
  if (value == null) return undefined;
  if (!isPlainRecord(value)) {
    throw new RequestValidationError("debateMemory is invalid.");
  }

  const aiSide = value.aiSide;
  const studentSide = value.studentSide;
  if (aiSide !== "proposition" && aiSide !== "opposition") {
    throw new RequestValidationError("debateMemory.aiSide is invalid.");
  }
  if (studentSide !== "proposition" && studentSide !== "opposition") {
    throw new RequestValidationError("debateMemory.studentSide is invalid.");
  }

  return {
    aiSide,
    studentSide,
    policyModel: readLimitedString(value, "policyModel", 1200),
    priorAiClaims: getStringArray(value.priorAiClaims, "debateMemory.priorAiClaims", {
      maxItems: 12,
      maxItemLength: 500,
    }).filter(Boolean),
    concessions: getStringArray(value.concessions, "debateMemory.concessions", {
      maxItems: 8,
      maxItemLength: 500,
    }).filter(Boolean),
    activeClashes: getStringArray(value.activeClashes, "debateMemory.activeClashes", {
      maxItems: 12,
      maxItemLength: 500,
    }).filter(Boolean),
    droppedClaims: getStringArray(value.droppedClaims, "debateMemory.droppedClaims", {
      maxItems: 10,
      maxItemLength: 500,
    }).filter(Boolean),
  };
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
    speechTimeSeconds: getNumber(body, "speechTimeSeconds", {
      min: 60,
      max: 900,
      defaultValue: 180,
    }),
    currentRoundNumber: getNumber(body, "currentRoundNumber", {
      min: 1,
      max: 20,
    }),
    motionBrief: parseMotionBrief(body.motionBrief),
    debateMemory: parseDebateMemory(body.debateMemory),
  };
}

const difficultyPrompts: Record<AiDifficulty, string> = {
  easy: `You are a BEGINNER-level debate opponent. Your rebuttals should:
- Use simple but complete counter-arguments
- Challenge the student's main idea without attacking every possible layer
- Use basic vocabulary appropriate for ESL students
- Follow the duration-aware word target given later in the prompt
- Leave some strategic openings that the student can answer`,

  medium: `You are a COMPETENT debate opponent. Your rebuttals should:
- Present solid, well-structured arguments with clear clash
- Address the opponent's logic, not just their wording
- Do at least one layer of comparison or impact weighing
- Use intermediate academic vocabulary
- Follow the duration-aware word target given later in the prompt
- Challenge the student while remaining fair`,

  hard: `You are an EXPERT debate opponent (national championship level). Your rebuttals should:
- Present sophisticated, multi-layered clash
- Test assumptions, attack the mechanism, and compare impacts explicitly
- Reframe the judge's choice around comparative weighing
- Use precise, advanced but still spoken vocabulary
- Follow the duration-aware word target given later in the prompt
- Force the student to think deeply and defend their position rigorously`,
};

export async function POST(req: NextRequest) {
  try {
    const auth = await requireRequestAuth(req);

    if (!auth.ok) {
      return auth.errorResponse;
    }

    const { supabase, user: authUser } = auth;
    if (shouldConsumeUserRateLimit(auth)) {
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
      await readJsonObject(req, { maxBytes: 160 * 1024 })
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
      speechTimeSeconds,
      currentRoundNumber,
      motionBrief,
      debateMemory,
    } = body;

    if (!topic || !userTranscript || !roundLabel) {
      return NextResponse.json(
        { error: "Missing required fields." },
        { status: 400 }
      );
    }

    const memoryAiSide =
      debateMemory?.aiSide ?? (side === "proposition" ? "opposition" : "proposition");
    const aiSide =
      memoryAiSide === "proposition"
        ? "Proposition (FOR)"
        : "Opposition (AGAINST)";
    const difficultyInstructions = difficultyPrompts[difficulty || "medium"];
    const track = practiceTrack || "debate";
    const languageConfig = getPracticeLanguageConfig(practiceLanguage);
    const wordTarget = getRebuttalWordTarget(speechTimeSeconds, roundLabel);
    const maxOutputTokens = getRebuttalMaxOutputTokens(wordTarget);
    const timeoutMs =
      wordTarget.max >= 1000 ? 55000 : wordTarget.max >= 800 ? 45000 : 30000;
    const motionBriefContext = motionBrief
      ? `\n${formatMotionBriefForPrompt(motionBrief)}`
      : "";
    const debateMemoryContext = formatDebateMemoryForPrompt(
      debateMemory,
      motionBrief
    );
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
${motionBriefContext}
${debateMemoryContext}

${difficultyInstructions}
${contextSection}

## Current Round: ${roundLabel}
${currentRoundNumber ? `Round number: ${currentRoundNumber}` : ""}
Opponent speech time setting: ${speechTimeSeconds ?? 180} seconds
Target length for your spoken response: ${wordTarget.min}-${wordTarget.max} words for a ${wordTarget.label} speech format
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
- Maintain your side (${aiSide}) and policy/model consistently across the whole debate
- Do not shift from a full ban/model to a partial ban/model, or vice versa, unless the Motion Definition explicitly defines that exception
- Review the previous rounds and Debate Memory before answering so you do not drop your own claims, contradict earlier concessions, or ignore active clashes
- Make the response proportional to the opponent's allocated speaking time; longer speeches need fuller engagement with mechanisms, examples, impacts, and weighing
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
        responseMimeType: "application/json",
        temperature: 0.7,
        maxOutputTokens,
      },
    });

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("TIMEOUT")), timeoutMs);
    });

    const startTime = Date.now();
    const result = await Promise.race([
      model.generateContent(prompt),
      timeoutPromise,
    ]);
    const latency = Date.now() - startTime;

    const text = result.response.text().trim();
    const structuredResponse = normalizeStructuredRebuttalResponse(text);
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
        speech_time_seconds: speechTimeSeconds,
        rebuttal_word_target_min: wordTarget.min,
        rebuttal_word_target_max: wordTarget.max,
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
