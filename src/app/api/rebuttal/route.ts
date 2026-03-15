import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { AiDifficulty } from "@/types";

export const maxDuration = 30;

interface RebuttalRequest {
  topic: string;
  side: "proposition" | "opposition";
  userTranscript: string;
  roundLabel: string;
  difficulty: AiDifficulty;
  previousRounds?: { label: string; speaker: string; text: string }[];
}

const difficultyPrompts: Record<AiDifficulty, string> = {
  easy: `You are a BEGINNER-level debate opponent. Your rebuttals should:
- Use simple, straightforward arguments
- Miss some obvious counter-points
- Use basic vocabulary appropriate for ESL students
- Be 80-120 words long
- Occasionally make weak arguments that the student can easily counter`,

  medium: `You are a COMPETENT debate opponent. Your rebuttals should:
- Present solid, well-structured arguments
- Address key points from the opponent's speech
- Use intermediate academic vocabulary
- Be 100-150 words long
- Challenge the student while remaining fair`,

  hard: `You are an EXPERT debate opponent (national championship level). Your rebuttals should:
- Present sophisticated, multi-layered arguments
- Systematically dismantle the opponent's key claims
- Use advanced academic vocabulary and rhetorical techniques
- Be 120-180 words long
- Force the student to think deeply and defend their position rigorously`,
};

export async function POST(req: NextRequest) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "API key not configured." },
        { status: 500 }
      );
    }

    const body = (await req.json()) as RebuttalRequest;
    const { topic, side, userTranscript, roundLabel, difficulty, previousRounds } = body;

    if (!topic || !userTranscript || !roundLabel) {
      return NextResponse.json(
        { error: "Missing required fields." },
        { status: 400 }
      );
    }

    const aiSide = side === "proposition" ? "Opposition (AGAINST)" : "Proposition (FOR)";
    const difficultyInstructions = difficultyPrompts[difficulty || "medium"];

    let contextSection = "";
    if (previousRounds && previousRounds.length > 0) {
      contextSection = "\n## Previous Rounds\n" +
        previousRounds
          .map((r) => `### ${r.label} (${r.speaker})\n${r.text}`)
          .join("\n\n");
    }

    const prompt = `You are a debate AI playing the ${aiSide} side in a Trường Teen-style debate.

## Topic/Motion
"${topic}"

${difficultyInstructions}
${contextSection}

## Current Round: ${roundLabel}

## Opponent's Latest Speech
"""
${userTranscript}
"""

## Your Task
Write a ${roundLabel.toLowerCase()} responding to the opponent's speech. This is a spoken debate, so write in a natural speaking style — conversational but academic.

Rules:
- Directly address and counter specific points from the opponent's speech
- Maintain your side (${aiSide}) consistently
- Be respectful but firm
- Write ONLY the rebuttal text, no meta-commentary or labels
- This is for Vietnamese high school students practicing debate in English, so be a challenging but fair practice partner`;

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 500,
      },
    });

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("TIMEOUT")), 25000);
    });

    const result = await Promise.race([
      model.generateContent(prompt),
      timeoutPromise,
    ]);

    const text = result.response.text().trim();

    return NextResponse.json({ rebuttal: text });
  } catch (err) {
    console.error("Rebuttal API error:", err);

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
