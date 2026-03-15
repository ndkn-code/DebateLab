import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";

export const maxDuration = 15;

interface OnboardingFeedbackRequest {
  transcript: string;
  topic: string;
  position: string;
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

    const { success } = rateLimit(`onboarding:${user.id}`, 3, 60 * 1000);
    if (!success) {
      return NextResponse.json(
        { error: "Too many requests. Please wait a moment." },
        { status: 429, headers: { "Retry-After": "60" } }
      );
    }

    const body: OnboardingFeedbackRequest = await req.json();
    const { transcript, topic, position } = body;

    if (!transcript?.trim()) {
      return NextResponse.json(
        {
          score: 65,
          strength: "You showed up and gave it a try - that takes courage!",
          improvement:
            "Try speaking more to give us something to work with.",
          encouragement:
            "Everyone starts somewhere. DebateLab will help you find your voice!",
        },
        { status: 200 }
      );
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.5,
        maxOutputTokens: 300,
      },
    });

    const prompt = `You are a debate coach giving quick feedback to a student who just tried their first 30-second argument.
Topic: ${topic}
Position: ${position}
Student's argument: ${transcript}

Return JSON:
{
  "score": <number 0-100>,
  "strength": "<one sentence about what they did well>",
  "improvement": "<one sentence about what to work on>",
  "encouragement": "<one short encouraging sentence>"
}

Be encouraging — this is their first try. Score generously (60-85 range for any reasonable attempt).
Keep all responses under 20 words each.`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      // Try to extract JSON from response
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        data = JSON.parse(match[0]);
      } else {
        throw new Error("Invalid JSON response");
      }
    }

    return NextResponse.json({
      score: Math.min(100, Math.max(0, data.score ?? 70)),
      strength: data.strength ?? "You made a clear attempt at argumentation.",
      improvement: data.improvement ?? "Try adding specific examples to support your points.",
      encouragement: data.encouragement ?? "Great start! Keep practicing and you'll improve fast.",
    });
  } catch (error) {
    console.error("Onboarding feedback error:", error);
    return NextResponse.json({
      score: 70,
      strength: "You took the initiative to practice - great first step!",
      improvement: "Try organizing your argument with a clear claim and evidence.",
      encouragement: "Every champion started as a beginner. You've got this!",
    });
  }
}
