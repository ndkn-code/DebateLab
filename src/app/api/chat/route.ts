import { NextRequest } from "next/server";
import Groq from "groq-sdk";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { getPostHogServer } from "@/lib/posthog-server";

export const maxDuration = 60;

const SYSTEM_PROMPT = `You are DebateLab AI Coach — a friendly, knowledgeable debate and public speaking coach for Vietnamese high school students (ages 15-18). Your name is Coach.

Your capabilities:
- Explain debate formats (BP, WSDC, Truong Teen)
- Teach argumentation (claims, warrants, impacts, rebuttals)
- Identify and explain logical fallacies
- Help brainstorm arguments for any debate topic
- Teach persuasion techniques and rhetoric
- Give public speaking tips (delivery, body language, voice)
- Review and discuss debate performance (when given scores/transcripts)
- Do practice debates in text form (back-and-forth argumentation)
- Answer questions about course content

RESPONSE FORMAT RULES — FOLLOW STRICTLY:
- Keep paragraphs SHORT (2-3 sentences max per paragraph)
- Use blank lines between paragraphs for readability
- When giving steps or tips, use numbered lists (1. 2. 3.)
- When listing options or examples, use bullet points (-)
- Use **bold** for key terms and important concepts
- Use line breaks liberally — NEVER write a wall of text
- Keep your overall response concise (under 200 words unless the student asks for detail)
- Start with a direct answer, then elaborate if needed
- End with an encouraging one-liner or a follow-up question

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

If the user asks you to review their debate, ask for their topic, side, and transcript (or score). If they say 'review my last debate', tell them to share the details from their history page.`;

interface ChatRequest {
  message: string;
  conversationId?: string;
  context?: string;
  contextId?: string;
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
    const { message, context, contextId } = body;
    let { conversationId } = body;

    if (!message?.trim()) {
      return new Response("Message is required", { status: 400 });
    }

    // Build system prompt with optional context
    let systemPrompt = SYSTEM_PROMPT;
    if (context === "course" && contextId) {
      const { data: course } = await supabase
        .from("courses")
        .select("title, description")
        .eq("id", contextId)
        .single();

      if (course) {
        systemPrompt += `\n\nThe student is currently studying the course: "${course.title}". Course description: ${course.description}. Tailor your answers to be relevant to this course content when appropriate.`;
      }
    }

    const chatModel =
      process.env.GROQ_CHAT_MODEL || "llama-3.3-70b-versatile";

    // Create or load conversation
    if (!conversationId) {
      const insertData: Record<string, string> = {
        user_id: user.id,
        title: "New conversation",
      };
      if (context) insertData.context_type = context;
      if (contextId) insertData.context_id = contextId;

      const { data: conv, error } = await supabase
        .from("chat_conversations")
        .insert(insertData)
        .select("id")
        .single();

      if (error) {
        console.error("Failed to create conversation:", error);
        throw new Error(`DB error creating conversation: ${error.message}`);
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
      console.error("Failed to save user message:", msgError);
      throw new Error(`DB error: ${msgError.message}`);
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
          console.error("Stream error:", err);
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
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("Chat API error:", errMsg, error);
    return new Response(
      JSON.stringify({ error: `Chat failed: ${errMsg}` }),
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
