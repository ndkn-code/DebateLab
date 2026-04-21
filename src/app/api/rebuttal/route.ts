import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { getPostHogServer } from "@/lib/posthog-server";
import type { AiDifficulty, PracticeTrack } from "@/types";

export const maxDuration = 30;

interface RebuttalRequest {
  topic: string;
  side: "proposition" | "opposition";
  userTranscript: string;
  roundLabel: string;
  difficulty: AiDifficulty;
  practiceTrack?: PracticeTrack;
  previousRounds?: { label: string; speaker: string; text: string }[];
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

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { success } = rateLimit(`rebuttal:${user.id}`, 10, 60 * 1000);
    if (!success) {
      return NextResponse.json(
        { error: "Too many requests. Please wait a moment." },
        { status: 429, headers: { "Retry-After": "60" } }
      );
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "API key not configured." },
        { status: 500 }
      );
    }

    const body = (await req.json()) as RebuttalRequest;
    const {
      topic,
      side,
      userTranscript,
      roundLabel,
      difficulty,
      practiceTrack,
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
- Write ONLY the rebuttal text, no meta-commentary or labels
- This is for Vietnamese high school students practicing debate in English, so be a challenging but fair practice partner`;

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
    const usage = result.response.usageMetadata;

    getPostHogServer().capture({
      distinctId: user.id,
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

    return NextResponse.json({ rebuttal: text });
  } catch (err) {
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
