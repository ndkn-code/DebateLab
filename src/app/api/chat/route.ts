import { NextRequest } from "next/server";
import Groq from "groq-sdk";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { getPostHogServer } from "@/lib/posthog-server";
import {
  getCoachContextEnvelope,
  getCoachProfile,
} from "@/lib/api/coach-profile";

export const maxDuration = 60;

const SYSTEM_PROMPT = `You are DebateLab AI Coach — a friendly, knowledgeable debate and public speaking coach for Vietnamese high school students (ages 15-18). Your name is Coach.

You support two coaching modes:
- Speaking mode: clarity, confidence, delivery, pacing, and understandable English
- Debate mode: stance, case line, mechanism, comparison, clash, and impact

Your capabilities:
- Explain debate formats (BP, WSDC, Truong Teen)
- Teach argumentation (claims, warrants, impacts, rebuttals)
- Help students build debate cases and speaking outlines
- Identify and explain logical fallacies
- Review debate or speaking performance from transcripts or scores
- Run practice back-and-forth debate exchanges in text form
- Answer questions about course content

RESPONSE FORMAT RULES:
- Keep paragraphs SHORT (2-3 sentences max per paragraph)
- Use blank lines between paragraphs for readability
- When giving steps or tips, use numbered lists (1. 2. 3.)
- When listing options or examples, use bullet points (-)
- Use **bold** for key terms and important concepts
- Use line breaks liberally — NEVER write a wall of text
- Start with a direct answer, then elaborate if needed
- End with either an encouraging one-liner or a precise next-step suggestion

DEPTH RULES:
- If the student is asking about speaking or presentation, stay concise and coaching-oriented
- If the student is asking about debate strategy, casebuilding, rebuttal, or performance review, go deeper
- In debate mode, default to this structure when building or reviewing arguments:
  1. **Stance / team line**
  2. **Argument name**
  3. **Mechanism**
  4. **Comparison / weighing**
  5. **Impact**
  6. **Link back to the motion**
- In debate mode, do NOT overvalue polished vocabulary if the reasoning is weak
- If a debate argument is shallow, say exactly what layer is missing: mechanism, comparison, impact, clash, or motion link

TONE:
- Warm, encouraging, and slightly casual (like a cool older sibling who happens to be a debate expert)
- Use simple English — remember these are non-native speakers
- Celebrate effort and progress
- Be specific in feedback, not generic

DO NOT:
- Write long academic paragraphs
- Use complex vocabulary without explaining it
- Be condescending or overly formal
- Give generic advice like "practice more"

If the user asks you to review a debate and no transcript or score is available, ask for the topic, side, and transcript (or score).`;

interface ChatRequest {
  message: string;
  conversationId?: string;
  context?: string;
  contextId?: string;
}

function isUuid(value?: string | null): value is string {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function normalizeContextType(context?: string) {
  if (!context) return undefined;
  return context === "dashboard-home" ? "coach-home" : context;
}

function getGroq() {
  return new Groq({
    apiKey: process.env.GROQ_API_KEY!,
  });
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return new Response("Unauthorized", { status: 401 });
    }

    const { success } = rateLimit(`chat:${user.id}`, 20, 60 * 1000);
    if (!success) {
      return new Response(
        JSON.stringify({ error: "Too many requests. Please wait a moment." }),
        { status: 429, headers: { "Content-Type": "application/json", "Retry-After": "60" } }
      );
    }

    const body: ChatRequest = await req.json();
    const normalizedContext = normalizeContextType(body.context);
    const { message, contextId } = body;
    let { conversationId } = body;

    if (!message?.trim()) {
      return new Response("Message is required", { status: 400 });
    }

    let systemPrompt = SYSTEM_PROMPT;

    try {
      const coachProfile = await getCoachProfile(user.id);
      const envelope = await getCoachContextEnvelope({
        userId: user.id,
        profile: coachProfile,
        contextType: normalizedContext,
        contextId,
        message,
      });

      systemPrompt += `\n\nPERSONAL COACHING CONTEXT
This is a debate-first coaching conversation. The following summary belongs to the authenticated user and should guide your advice.

Coaching mode: ${envelope.mode}
Focus title: ${envelope.focusTitle}
Focus summary: ${envelope.focusSummary}

${envelope.promptContext}

RULES FOR THIS CONTEXT:
- Use the profile and attached context to make advice specific to this user.
- Do not dump all of the profile back unless the user asks for a progress summary.
- If you review a session, point to concrete strengths, weaknesses, and the missing debate layers.
- If you compare sessions, describe the trend and the repeated pattern across them.
- If context is missing or thin, say that briefly and coach from the available evidence only.`;
    } catch (coachError) {
      if (process.env.NODE_ENV === "development") {
        console.error("Coach context build failed:", coachError);
      }
    }

    const chatModel =
      process.env.GROQ_CHAT_MODEL || "llama-3.3-70b-versatile";

    // Create or load conversation
    if (conversationId) {
      const { data: existingConversation } = await supabase
        .from("chat_conversations")
        .select("id")
        .eq("id", conversationId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (!existingConversation) {
        return new Response("Conversation not found", { status: 404 });
      }
    } else {
      const insertData: Record<string, string> = {
        user_id: user.id,
        title: "New conversation",
      };
      if (normalizedContext) insertData.context_type = normalizedContext;
      if (isUuid(contextId)) insertData.context_id = contextId;

      const { data: conv, error } = await supabase
        .from("chat_conversations")
        .insert(insertData)
        .select("id")
        .single();

      if (error) {
        if (process.env.NODE_ENV === 'development') console.error("Failed to create conversation:", error);
        throw new Error("Failed to create conversation");
      }
      conversationId = conv.id;
    }

    // Save user message
    const { error: msgError } = await supabase.from("chat_messages").insert({
      conversation_id: conversationId,
      role: "user",
      content: message.trim(),
    });
    if (msgError) {
      if (process.env.NODE_ENV === 'development') console.error("Failed to save user message:", msgError);
      throw new Error("Failed to save message");
    }

    // Load conversation history (last 20 messages)
    const { data: history } = await supabase
      .from("chat_messages")
      .select("role, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(20);

    // Build messages array for Groq (OpenAI-compatible format)
    const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
      { role: "system", content: systemPrompt },
      ...(history ?? []).map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    ];

    // Stream response from Groq
    const streamStartTime = Date.now();
    const chatCompletion = await getGroq().chat.completions.create({
      messages,
      model: chatModel,
      temperature: 0.7,
      max_tokens: 1024,
      stream: true,
    });

    let fullResponse = "";

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        try {
          for await (const chunk of chatCompletion) {
            const text = chunk.choices[0]?.delta?.content || "";
            if (text) {
              fullResponse += text;
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ text, conversationId })}\n\n`
                )
              );
            }
          }

          // Save assistant message
          await supabase.from("chat_messages").insert({
            conversation_id: conversationId,
            role: "assistant",
            content: fullResponse,
          });

          getPostHogServer().capture({
            distinctId: user.id,
            event: "$ai_generation",
            properties: {
              $ai_provider: "groq",
              $ai_model: chatModel,
              $ai_output_tokens: Math.ceil(fullResponse.length / 4),
              $ai_latency: Date.now() - streamStartTime,
              $ai_is_error: false,
              $ai_trace_id: crypto.randomUUID(),
              route: "/api/chat",
            },
          });

          // Auto-generate title from first user message
          if ((history ?? []).length <= 1) {
            generateTitle(message.trim(), conversationId!, supabase);
          }

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ done: true, conversationId })}\n\n`
            )
          );
          controller.close();
        } catch (err) {
          if (process.env.NODE_ENV === 'development') console.error("Stream error:", err);
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ error: "Stream interrupted" })}\n\n`
            )
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    if (process.env.NODE_ENV === 'development') console.error("Chat API error:", error);
    return new Response(
      JSON.stringify({ error: "Something went wrong. Please try again." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

// Fire-and-forget title generation using Groq
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function generateTitle(firstMessage: string, conversationId: string, supabase: any) {
  try {
    const result = await getGroq().chat.completions.create({
      messages: [
        {
          role: "user",
          content: `Generate a short 3-5 word title for a conversation that starts with this message. Return ONLY the title, no quotes or punctuation:\n\n"${firstMessage}"`,
        },
      ],
      model: process.env.GROQ_CHAT_MODEL || "llama-3.3-70b-versatile",
      temperature: 0.3,
      max_tokens: 20,
    });

    const title = (result.choices[0]?.message?.content ?? "")
      .trim()
      .slice(0, 100);

    if (title) {
      await supabase
        .from("chat_conversations")
        .update({ title })
        .eq("id", conversationId);
    }
  } catch {
    // Non-critical, ignore
  }
}
