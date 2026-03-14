import { NextRequest, NextResponse } from "next/server";
import { analyzeDebate } from "@/lib/gemini";

interface AnalyzeRequest {
  transcript: string;
  topic: string;
  side: "proposition" | "opposition";
  speechType: string;
  timeLimit: number;
  actualDuration: number;
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY is not configured" },
        { status: 500 }
      );
    }

    const body = (await req.json()) as AnalyzeRequest;
    const { transcript, topic, side, speechType, timeLimit, actualDuration } =
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

    // Call Gemini with a timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
      const feedback = await analyzeDebate({
        transcript,
        topic,
        side,
        speechType: speechType || "Opening Statement",
        timeLimit: timeLimit || 2,
        actualDuration: actualDuration || 0,
      });

      clearTimeout(timeout);
      return NextResponse.json(feedback);
    } catch (err) {
      clearTimeout(timeout);

      if (err instanceof Error) {
        if (err.name === "AbortError") {
          return NextResponse.json(
            { error: "Analysis timed out. Please try again." },
            { status: 504 }
          );
        }
        if (err.message.includes("429") || err.message.includes("rate")) {
          return NextResponse.json(
            { error: "Rate limit reached. Please wait a moment and try again." },
            { status: 429 }
          );
        }
        if (err.message.includes("Invalid response")) {
          return NextResponse.json(
            { error: "Failed to parse AI response. Please try again." },
            { status: 502 }
          );
        }
      }
      throw err;
    }
  } catch (err) {
    console.error("Analyze API error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
