import { NextRequest, NextResponse } from "next/server";
import { analyzeDebate } from "@/lib/gemini";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";

// Allow up to 30s for Vercel serverless functions
export const maxDuration = 30;

import type { DebateRound } from "@/types";

interface AnalyzeRequest {
  transcript: string;
  topic: string;
  side: "proposition" | "opposition";
  speechType: string;
  timeLimit: number;
  actualDuration: number;
  isFullRound?: boolean;
  rounds?: DebateRound[];
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { success } = rateLimit(`analyze:${user.id}`, 5, 60 * 1000);
    if (!success) {
      return NextResponse.json(
        { error: "Too many requests. Please wait a moment." },
        { status: 429, headers: { "Retry-After": "60" } }
      );
    }

    if (!process.env.GEMINI_API_KEY) {
      if (process.env.NODE_ENV === 'development') console.error("GEMINI_API_KEY is not set");
      return NextResponse.json(
        { error: "Something went wrong. Please try again." },
        { status: 500 }
      );
    }

    const body = (await req.json()) as AnalyzeRequest;
    const { transcript, topic, side, speechType, timeLimit, actualDuration, isFullRound, rounds } =
      body;

    // Validate required fields
    if (!transcript || !topic || !side) {
      return NextResponse.json(
        { error: "Missing required fields: transcript, topic, side" },
        { status: 400 }
      );
    }

    // Validate transcript length
    const wordCount = transcript
      .split(/\s+/)
      .filter((w) => w.length > 0).length;
    if (wordCount < 20) {
      return NextResponse.json(
        {
          error: `Transcript too short (${wordCount} words). Minimum 20 words required.`,
        },
        { status: 400 }
      );
    }

    // Call Gemini with a 25-second timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("TIMEOUT")), 25000);
    });

    try {
      const feedback = await Promise.race([
        analyzeDebate({
          transcript,
          topic,
          side,
          speechType: speechType || "Opening Statement",
          timeLimit: timeLimit || 2,
          actualDuration: actualDuration || 0,
          isFullRound,
          rounds,
        }, user.id),
        timeoutPromise,
      ]);

      const modelUsed = process.env.GEMINI_MODEL || "gemini-2.5-flash";
      return NextResponse.json({ ...feedback, _model: modelUsed });
    } catch (err) {
      if (process.env.NODE_ENV === 'development') console.error("Gemini API error:", err);

      if (err instanceof Error) {
        if (err.message === "TIMEOUT") {
          return NextResponse.json(
            { error: "Analysis timed out. The AI service took too long to respond. Please try again." },
            { status: 504 }
          );
        }
        if (err.message.includes("429") || err.message.includes("rate") || err.message.includes("quota")) {
          return NextResponse.json(
            { error: "Rate limit reached. Please wait a moment and try again." },
            { status: 429 }
          );
        }
        if (err.message.includes("Invalid response") || err.message.includes("JSON")) {
          return NextResponse.json(
            { error: "Failed to parse AI response. Please try again." },
            { status: 502 }
          );
        }
        if (err.message.includes("API_KEY") || err.message.includes("401") || err.message.includes("403")) {
          return NextResponse.json(
            { error: "Something went wrong. Please try again." },
            { status: 401 }
          );
        }
        return NextResponse.json(
          { error: "Something went wrong. Please try again." },
          { status: 500 }
        );
      }

      return NextResponse.json(
        { error: "An unexpected error occurred during analysis." },
        { status: 500 }
      );
    }
  } catch (err) {
    if (process.env.NODE_ENV === 'development') console.error("Analyze API unexpected error:", err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
