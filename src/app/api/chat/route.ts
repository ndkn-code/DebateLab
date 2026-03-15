import { NextRequest } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

const SYSTEM_PROMPT = `You are DebateLab AI Coach — a friendly, knowledgeable debate and public speaking coach for Vietnamese high school students. You help students improve their debate skills, understand argumentation frameworks, learn rhetorical techniques, and build confidence in public speaking.

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

Style guidelines:
- Be encouraging, warm, and supportive
- Use clear, accessible English (remember your students are non-native speakers)
- Give specific, actionable advice with examples
- When explaining concepts, use debate scenarios that Vietnamese students can relate to
- Keep responses concise but thorough — students are busy
- Use markdown formatting for structure when helpful (headers, bold, lists)
- If asked about something outside debate/speaking/argumentation, gently redirect

If the user asks you to review their debate, ask for their topic, side, and transcript (or score). If they say 'review my last debate', tell them to share the details from their history page.`;

interface ChatRequest {
  message: string;
  conversationId?: string;
  context?: string;
  contextId?: string;
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

    // Create or load conversation
    if (!conversationId) {
      // Create new conversation
      const { data: conv, error } = await supabase
        .from("chat_conversations")
        .insert({
          user_id: user.id,
          title: "New conversation",
          model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
          system_prompt: systemPrompt,
          message_count: 0,
        })
        .select("id")
        .single();

      if (error) throw error;
      conversationId = conv.id;
    }

    // Save user message
    await supabase.from("chat_messages").insert({
      conversation_id: conversationId,
      role: "user",
      content: message.trim(),
    });

    // Load conversation history (last 20 messages)
    const { data: history } = await supabase
      .from("chat_messages")
      .select("role, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(20);

    // Build Gemini messages
    const geminiHistory = (history ?? []).map((m) => ({
      role: m.role === "user" ? ("user" as const) : ("model" as const),
      parts: [{ text: m.content }],
    }));

    // Initialize Gemini
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
      generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
      systemInstruction: systemPrompt,
    });

    // Start chat with history (exclude last user message since we pass it to sendMessageStream)
    const chatHistory = geminiHistory.slice(0, -1);
    const chat = model.startChat({ history: chatHistory });

    // Stream response
    const result = await chat.sendMessageStream(message.trim());

    let fullResponse = "";

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        try {
          for await (const chunk of result.stream) {
            const text = chunk.text();
            fullResponse += text;
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ text, conversationId })}\n\n`)
            );
          }

          // Save assistant message
          await supabase.from("chat_messages").insert({
            conversation_id: conversationId,
            role: "assistant",
            content: fullResponse,
          });

          // Update conversation metadata
          const { count } = await supabase
            .from("chat_messages")
            .select("*", { count: "exact", head: true })
            .eq("conversation_id", conversationId);

          await supabase
            .from("chat_conversations")
            .update({
              message_count: count ?? 0,
              last_message_at: new Date().toISOString(),
            })
            .eq("id", conversationId);

          // Auto-generate title from first user message
          if ((history ?? []).length <= 1) {
            generateTitle(message.trim(), conversationId!, supabase);
          }

          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ done: true, conversationId })}\n\n`)
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
    console.error("Chat API error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to process chat message" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

// Fire-and-forget title generation
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function generateTitle(firstMessage: string, conversationId: string, supabase: any) {
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
      generationConfig: { temperature: 0.3, maxOutputTokens: 20 },
    });

    const result = await model.generateContent(
      `Generate a short 3-5 word title for a conversation that starts with this message. Return ONLY the title, no quotes or punctuation:\n\n"${firstMessage}"`
    );
    const title = result.response.text().trim().slice(0, 100);

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
