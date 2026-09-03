import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateStructured } from "@/lib/ai/core";
import { requireRequestAuth } from "@/lib/api/request-auth";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getPostHogServer } from "@/lib/posthog-server";
import {
  getString,
  readJsonObject,
  RequestValidationError,
} from "@/lib/api/request-validation";

export const maxDuration = 15;

const OnboardingFeedbackSchema = z
  .object({
    score: z.number().finite(),
    strength: z.string().min(1).max(400),
    improvement: z.string().min(1).max(400),
    encouragement: z.string().min(1).max(400),
  })
  .strict();

export async function POST(req: NextRequest) {
  try {
    const auth = await requireRequestAuth(req);

    if (!auth.ok) {
      return auth.errorResponse;
    }

    const { user } = auth;
    const rateLimit = await consumeRateLimit(auth.supabase, {
      scope: "onboarding-feedback",
      limit: 3,
      windowSeconds: 60,
    });
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: "Too many requests. Please wait a moment." },
        {
          status: 429,
          headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
        },
      );
    }

    const body = await readJsonObject(req, { maxBytes: 12 * 1024 });
    const transcript = getString(body, "transcript", { maxLength: 6000 }) ?? "";
    const topic = getString(body, "topic", {
      maxLength: 200,
      defaultValue: "Practice speaking",
    })!;
    const position = getString(body, "position", {
      maxLength: 80,
      defaultValue: "student",
    })!;

    if (!transcript?.trim()) {
      return NextResponse.json(
        {
          score: 65,
          strength: "You showed up and gave it a try - that takes courage!",
          improvement:
            "Try speaking a little longer so we can hear your full idea.",
          encouragement:
            "Everyone starts somewhere. Thinkfy will help you find your voice!",
        },
        { status: 200 },
      );
    }

    const prompt = `You are a warm, encouraging speaking coach giving quick feedback on a student's first 45-second warm-up speaking sample.
Treat this as a low-stakes speaking warm-up, not a full debate evaluation.
Topic: ${topic}
Position: ${position}
Student's response: ${transcript}

Return JSON:
{
  "score": <number 0-100>,
  "strength": "<one sentence about what they did well>",
  "improvement": "<one sentence about what to work on>",
  "encouragement": "<one short encouraging sentence>"
}

Focus on clarity, structure, confidence, and understandable English.
Be encouraging — this is their first try. Score generously (60-85 range for any reasonable attempt).
Keep all responses under 20 words each.`;

    const result = await generateStructured({
      task: "onboarding_feedback",
      prompt,
      schema: OnboardingFeedbackSchema,
      context: {
        task: "onboarding_feedback",
        sourceRoute: "/api/onboarding-feedback",
        outputType: "onboarding_feedback",
        userId: user.id,
        deadlineAt: Date.now() + 10_000,
        metadata: { topic, position },
      },
    });

    getPostHogServer().capture({
      distinctId: user.id,
      event: "$ai_generation",
      properties: {
        $ai_provider: result.provider === "gemini" ? "google" : result.provider,
        $ai_model: result.model,
        $ai_input_tokens: result.usage.inputTokens,
        $ai_output_tokens: result.usage.outputTokens,
        $ai_latency: result.latencyMs,
        $ai_is_error: false,
        $ai_trace_id: result.traceId,
        route: "/api/onboarding-feedback",
      },
    });
    const data = result.output;

    return NextResponse.json({
      score: Math.min(100, Math.max(0, data.score ?? 70)),
      strength:
        data.strength ?? "You made a clear attempt to express your idea.",
      improvement:
        data.improvement ??
        "Try adding one clear reason and one short example next time.",
      encouragement:
        data.encouragement ??
        "Great start! Keep practicing and you'll improve fast.",
    });
  } catch (error) {
    if (error instanceof RequestValidationError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    if (process.env.NODE_ENV === "development")
      console.error("Onboarding feedback error:", error);
    return NextResponse.json({
      score: 70,
      strength: "You took the initiative to practice - great first step!",
      improvement:
        "Try organizing your response with one clear point and one example.",
      encouragement:
        "Every strong speaker started as a beginner. You've got this!",
    });
  }
}
