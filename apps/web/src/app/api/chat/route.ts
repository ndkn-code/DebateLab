import { NextRequest } from "next/server";
import Groq from "groq-sdk";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getPostHogServer } from "@/lib/posthog-server";
import {
  requireRequestAuth,
  unauthorizedTextResponse,
} from "@/lib/api/request-auth";
import {
  getCoachContextEnvelope,
  getCoachProfile,
} from "@/lib/api/coach-profile";
import {
  coercePracticeLanguage,
  getPracticeLanguageConfig,
} from "@/lib/practice-language";
import {
  getString,
  readJsonObject,
  RequestValidationError,
  type JsonRecord,
} from "@/lib/api/request-validation";
import type {
  CoachMessageMetadata,
  CoachResponseBlock,
  CoachResponseBlockType,
  CoachSuggestedAction,
} from "@/types";

export const maxDuration = 60;

const SYSTEM_PROMPT = `You are Thinkfy AI Coach — a friendly, knowledgeable debate and public speaking coach for Vietnamese high school students (ages 15-18). Your name is Coach.

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
- Give the full useful answer as normal readable markdown. Do not rely on UI cards, section labels, or hidden metadata to complete the answer.
- If details are missing, teach the general method first, then ask for the exact missing detail you need.

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
- Use the selected coaching language naturally and keep explanations student-friendly
- Celebrate effort and progress
- Be specific in feedback, not generic

DO NOT:
- Write long academic paragraphs
- Use complex vocabulary without explaining it
- Be condescending or overly formal
- Give generic advice like "practice more"

If the user asks you to review a debate and no transcript or score is available, ask for the topic, side, and transcript (or score).`;

function buildSystemPrompt(practiceLanguageInput: unknown) {
  const languageConfig = getPracticeLanguageConfig(practiceLanguageInput);
  const languageRules =
    languageConfig.code === "vi"
      ? [
          "RESPONSE LANGUAGE:",
          "- Respond in Vietnamese.",
          "- Use natural Vietnamese debate coaching language. It is fine to keep common debate terms such as motion, rebuttal, clash, weighing, and impact when they sound natural to Vietnamese students.",
          "- If the user asks in English while Vietnamese mode is active, still answer in Vietnamese unless they explicitly ask otherwise.",
        ].join("\n")
      : [
          "RESPONSE LANGUAGE:",
          "- Respond in English.",
          "- Keep English clear and accessible for Vietnamese high school students.",
          "- If the user asks in Vietnamese while English mode is active, gently answer in English unless they explicitly ask otherwise.",
        ].join("\n");

  return `${SYSTEM_PROMPT}\n\n${languageConfig.aiInstruction}\n\n${languageRules}`;
}

interface ChatRequest {
  message: string;
  conversationId?: string;
  context?: string;
  contextId?: string;
  practiceLanguage?: string;
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

function parseChatRequest(body: JsonRecord): ChatRequest {
  const message = getString(body, "message", {
    required: true,
    minLength: 1,
    maxLength: 4000,
  })!;
  const conversationId = getString(body, "conversationId", {
    maxLength: 64,
  });
  const context = getString(body, "context", {
    maxLength: 64,
  });
  const contextId = getString(body, "contextId", {
    maxLength: 96,
  });
  const practiceLanguage = getString(body, "practiceLanguage", {
    maxLength: 8,
  });

  if (conversationId && !isUuid(conversationId)) {
    throw new RequestValidationError("conversationId is invalid.");
  }

  return { message, conversationId, context, contextId, practiceLanguage };
}

const ENABLE_COACH_METADATA = process.env.ENABLE_COACH_METADATA === "true";

const COACH_BLOCK_TYPES = [
  "opening_formula",
  "template",
  "coach_tip",
  "common_mistake",
  "example",
  "drill",
  "next_steps",
  "clarifying_question",
] as const satisfies readonly CoachResponseBlockType[];

function isCoachBlockType(value: unknown): value is CoachResponseBlockType {
  return (
    typeof value === "string" &&
    COACH_BLOCK_TYPES.includes(value as CoachResponseBlockType)
  );
}

function cleanText(value: unknown, maxLength = 900) {
  if (typeof value !== "string") return undefined;
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return undefined;
  if (normalized.length <= maxLength) return normalized;

  const clipped = normalized.slice(0, maxLength);
  const sentenceEnd = Math.max(
    clipped.lastIndexOf(". "),
    clipped.lastIndexOf("! "),
    clipped.lastIndexOf("? ")
  );

  if (sentenceEnd > maxLength * 0.55) {
    return clipped.slice(0, sentenceEnd + 1).trim();
  }

  const wordEnd = clipped.lastIndexOf(" ");
  const trimmed =
    wordEnd > maxLength * 0.65 ? clipped.slice(0, wordEnd).trim() : clipped.trim();

  return `${trimmed.replace(/[.,;:!?-]+$/, "")}...`;
}

function cleanItems(value: unknown, maxItems = 6) {
  if (!Array.isArray(value)) return undefined;
  const items = value
    .map((item) => cleanText(item, 220))
    .filter((item): item is string => Boolean(item))
    .slice(0, maxItems);
  return items.length > 0 ? items : undefined;
}

const ACTION_PLACEHOLDER_PATTERN = /_{2,}|\[[^\]]+\]|<[^>]+>/;
const GENERIC_ACTION_PATTERN =
  /\b(share|send|provide)\b[\s\S]{0,80}\b(motion|topic|side|details)\b/i;
const TEMPLATE_PLACEHOLDER_PATTERN =
  /\[(motion|stance|side|reason|claim|argument|impact)[^\]]*\]/i;
const MISSING_CONTEXT_PATTERN =
  /\b(send|share|provide|tell me|complete|add)\b[\s\S]{0,80}\b(motion|side|topic|transcript|score|details)\b|\b(complete your thought|get started|once i know|before i can)\b/i;

function blockText(block: CoachResponseBlock) {
  return [block.title, block.body, ...(block.items ?? [])]
    .filter(Boolean)
    .join(" ");
}

function isUsefulTemplate(block: CoachResponseBlock) {
  return Boolean(
    block.body &&
      block.body.length > 48 &&
      TEMPLATE_PLACEHOLDER_PATTERN.test(block.body)
  );
}

function isMissingContextBlock(block: CoachResponseBlock) {
  return MISSING_CONTEXT_PATTERN.test(blockText(block));
}

function getOpeningPart(item: string) {
  const cleaned = item.replace(/\*\*/g, "").replace(/`/g, "").toLowerCase();
  const separatorIndex = cleaned.indexOf(":");
  if (separatorIndex < 0) return null;

  const label = cleaned.slice(0, separatorIndex).trim();
  const body = cleaned.slice(separatorIndex + 1).trim();

  if (label.includes("motion")) return { key: "motion", body };
  if (label.includes("stance") || label.includes("side")) {
    return { key: "stance", body };
  }
  if (label.includes("thesis") || label.includes("team line")) {
    return { key: "thesis", body };
  }
  if (label.includes("roadmap") || label.includes("preview")) {
    return { key: "roadmap", body };
  }

  return null;
}

function isUsefulOpeningFormula(block: CoachResponseBlock) {
  const items = block.items ?? [];
  if (items.length !== 4) return false;

  const parts = items.map(getOpeningPart);
  const partMap = new Map(parts.flatMap((part) => (part ? [[part.key, part.body]] : [])));

  return (
    /\b(motion|topic)\b/.test(partMap.get("motion") ?? "") &&
    /\b(stance|side|support|oppose|position|proposition|opposition)\b/.test(
      partMap.get("stance") ?? ""
    ) &&
    /\b(reason|claim|because|mechanism|why|main)\b/.test(
      partMap.get("thesis") ?? ""
    ) &&
    /\b(preview|argument|point|roadmap|show)\b/.test(
      partMap.get("roadmap") ?? ""
    )
  );
}

function isUsefulClarifyingQuestion(block: CoachResponseBlock) {
  const text = blockText(block);
  return text.length >= 20 && (MISSING_CONTEXT_PATTERN.test(text) || text.includes("?"));
}

function looksIncompleteStudentMessage(text?: string) {
  const normalized = text?.trim().toLowerCase() ?? "";
  if (!normalized) return true;
  if (/\b(on|about|for|motion is|topic is|side is)\s*$/.test(normalized)) {
    return true;
  }
  return (
    normalized.length < 28 &&
    /\b(debate|motion|topic|side)\b/.test(normalized) &&
    !/[?.!]$/.test(normalized)
  );
}

function hasSpecificStudentMaterial(text?: string) {
  const normalized = text?.trim() ?? "";
  return (
    normalized.length > 60 ||
    /\b(motion|topic|side|stance|draft|argument|thesis)\s*:/i.test(normalized)
  );
}

function normalizeBlock(value: unknown, index: number): CoachResponseBlock | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const type = isCoachBlockType(raw.type) ? raw.type : null;
  const title = cleanText(raw.title, 80);
  if (!type || !title) return null;

  const block = {
    id: cleanText(raw.id, 60) ?? `block-${index + 1}`,
    type,
    title,
    body: cleanText(raw.body),
    items: cleanItems(raw.items, type === "opening_formula" ? 4 : 6),
    prompt: cleanText(raw.prompt, 220),
  };

  if (block.type === "opening_formula" && !isUsefulOpeningFormula(block)) {
    return null;
  }
  if (block.type === "template" && !isUsefulTemplate(block)) {
    return null;
  }
  if (block.type === "clarifying_question" && !isUsefulClarifyingQuestion(block)) {
    return null;
  }
  if (block.type !== "clarifying_question" && isMissingContextBlock(block)) {
    return null;
  }

  return block;
}

function normalizeAction(value: unknown): CoachSuggestedAction | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const label = cleanText(raw.label, 48);
  const prompt = cleanText(raw.prompt, 220);
  const actionText = `${label ?? ""} ${prompt ?? ""}`;
  if (
    !label ||
    !prompt ||
    ACTION_PLACEHOLDER_PATTERN.test(prompt) ||
    GENERIC_ACTION_PATTERN.test(actionText)
  ) {
    return null;
  }

  return {
    label,
    prompt,
    variant: raw.variant === "primary" ? "primary" : "secondary",
  };
}

function normalizeMetadata(
  value: unknown,
  context: { assistantText?: string; studentMessage?: string } = {}
): CoachMessageMetadata | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const blocks = Array.isArray(raw.blocks)
    ? raw.blocks
        .map((block, index) => normalizeBlock(block, index))
        .filter((block): block is CoachResponseBlock => Boolean(block))
        .slice(0, 6)
    : [];

  if (blocks.length === 0) return null;

  const needsMoreInfo = looksIncompleteStudentMessage(context.studentMessage);
  const clarifyingBlocks = blocks.filter(
    (block) => block.type === "clarifying_question"
  );

  if (needsMoreInfo) {
    if (clarifyingBlocks.length === 0) return null;
    return {
      renderVersion: 1,
      summary: cleanText(raw.summary, 360),
      blocks: clarifyingBlocks,
      suggestedActions: [],
    };
  }

  const hasClarifyingQuestion = clarifyingBlocks.length > 0;
  if (hasClarifyingQuestion) {
    return {
      renderVersion: 1,
      summary: cleanText(raw.summary, 360),
      blocks,
      suggestedActions: [],
    };
  }

  const suggestedActions =
    hasSpecificStudentMaterial(context.studentMessage) &&
    Array.isArray(raw.suggestedActions)
      ? raw.suggestedActions
          .map(normalizeAction)
          .filter((action): action is CoachSuggestedAction => Boolean(action))
          .slice(0, 3)
      : [];

  return {
    renderVersion: 1,
    summary: cleanText(raw.summary, 360),
    blocks,
    suggestedActions,
  };
}

function parseJsonObject(text: string) {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
    if (fenced) {
      try {
        return JSON.parse(fenced);
      } catch {
        return null;
      }
    }

    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

async function generateCoachMessageMetadata({
  assistantText,
  studentMessage,
  mode,
  focusTitle,
  practiceLanguage,
}: {
  assistantText: string;
  studentMessage: string;
  mode?: string;
  focusTitle?: string;
  practiceLanguage: string;
}): Promise<CoachMessageMetadata | null> {
  if (!assistantText.trim()) return null;

  try {
    const result = await getGroq().chat.completions.create({
      messages: [
        {
          role: "system",
          content: `You convert Thinkfy coach replies into compact UI metadata.

Return ONLY valid JSON. Do not use markdown fences.

Schema:
{
  "renderVersion": 1,
  "summary": "short optional lead-in",
  "blocks": [
    {
      "id": "block-1",
      "type": "opening_formula | template | coach_tip | common_mistake | example | drill | next_steps | clarifying_question",
      "title": "short card title",
      "body": "optional short paragraph",
      "items": ["optional short bullets"],
      "prompt": "optional follow-up prompt"
    }
  ],
  "suggestedActions": [
    { "label": "short button label", "prompt": "message to send", "variant": "primary | secondary" }
  ]
}

Rules:
- Use 0-4 blocks. Return "blocks": [] and "suggestedActions": [] when the reply is clearer as plain text.
- Pick block types that match the assistant reply. Do not invent facts or force a card.
- Prefer debate-specific blocks over generic summaries only when the structure is genuinely useful.
- Do not create opening_formula unless it contains exactly 4 real opening parts: motion, stance, thesis, and roadmap.
- Do not create template unless the body contains an actual editable template with bracket placeholders.
- Use clarifying_question when the reply asks for missing topic, side, transcript, or format.
- If any block is clarifying_question, return "suggestedActions": []. Only include other blocks when they are useful teaching scaffolds before the question.
- Never create action prompts with placeholders such as ____, [motion], <insert>, or similar.
- Never create generic actions like "Share debate motion", "Ask coach", or "Answer this".
- Suggested action labels and prompts must sound like natural next moves that fit the current coach ask.
- Write every title, body, item, label, and suggested action prompt in ${practiceLanguage === "vi" ? "Vietnamese" : "English"}.
- Keep every card concise enough for a mobile lesson feed.
- Suggested actions are optional. Only include them when the student already gave enough material to act on.`,
        },
        {
          role: "user",
          content: `Student message:
${studentMessage}

Coach mode: ${mode ?? "general-coaching"}
Current focus: ${focusTitle ?? "Current coaching focus"}

Assistant reply to structure:
${assistantText}`,
        },
      ],
      model: process.env.GROQ_CHAT_MODEL || "llama-3.3-70b-versatile",
      temperature: 0.2,
      max_tokens: 900,
      response_format: { type: "json_object" },
    });

    const raw = result.choices[0]?.message?.content ?? "";
    return normalizeMetadata(parseJsonObject(raw), {
      assistantText,
      studentMessage,
    });
  } catch (metadataError) {
    if (process.env.NODE_ENV === "development") {
      console.error("Coach metadata generation failed:", metadataError);
    }
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireRequestAuth(req, { allowDevBypass: false });

    if (!auth.ok) {
      return unauthorizedTextResponse();
    }

    const { supabase, user } = auth;
    const rateLimit = await consumeRateLimit(supabase, {
      scope: "chat",
      limit: 20,
      windowSeconds: 60,
    });
    if (!rateLimit.success) {
      return new Response(
        JSON.stringify({ error: "Too many requests. Please wait a moment." }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": String(rateLimit.retryAfterSeconds),
          },
        }
      );
    }

    const body = parseChatRequest(
      await readJsonObject(req, { maxBytes: 12 * 1024 })
    );
    const normalizedContext = normalizeContextType(body.context);
    const practiceLanguage = coercePracticeLanguage(body.practiceLanguage);
    const { message, contextId } = body;
    let { conversationId } = body;

    let systemPrompt = buildSystemPrompt(practiceLanguage);
    let coachMetadataContext: { mode?: string; focusTitle?: string } = {};

    try {
      const coachProfile = await getCoachProfile(user.id, practiceLanguage);
      const envelope = await getCoachContextEnvelope({
        userId: user.id,
        profile: coachProfile,
        contextType: normalizedContext,
        contextId,
        message,
        practiceLanguage,
      });
      coachMetadataContext = {
        mode: envelope.mode,
        focusTitle: envelope.focusTitle,
      };

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
        title: practiceLanguage === "vi" ? "Cuộc hội thoại mới" : "New conversation",
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
    const { data: historyRows } = await supabase
      .from("chat_messages")
      .select("role, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(20);
    const history = [...(historyRows ?? [])].reverse();

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
      max_tokens: 1600,
      stream: true,
    });

    let fullResponse = "";
    let finishReason: string | null = null;

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        try {
          for await (const chunk of chatCompletion) {
            const choice = chunk.choices[0];
            const text = choice?.delta?.content || "";
            if (choice?.finish_reason) {
              finishReason = choice.finish_reason;
            }
            if (text) {
              fullResponse += text;
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ text, conversationId })}\n\n`
                )
              );
            }
          }

          const metadata = ENABLE_COACH_METADATA
            ? await generateCoachMessageMetadata({
                assistantText: fullResponse,
                studentMessage: message.trim(),
                mode: coachMetadataContext.mode,
                focusTitle: coachMetadataContext.focusTitle,
                practiceLanguage,
              })
            : null;

          // Save assistant message
          await supabase.from("chat_messages").insert({
            conversation_id: conversationId,
            role: "assistant",
            content: fullResponse,
            metadata,
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
              $ai_finish_reason: finishReason,
              $ai_trace_id: crypto.randomUUID(),
              route: "/api/chat",
            },
          });

          // Auto-generate title from first user message
          if ((history ?? []).length <= 1) {
            generateTitle(message.trim(), conversationId!, supabase, practiceLanguage);
          }

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ done: true, conversationId, finishReason })}\n\n`
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
    if (error instanceof RequestValidationError) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: error.status,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (process.env.NODE_ENV === 'development') console.error("Chat API error:", error);
    return new Response(
      JSON.stringify({ error: "Something went wrong. Please try again." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

// Fire-and-forget title generation using Groq
async function generateTitle(
  firstMessage: string,
  conversationId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  practiceLanguage: string
) {
  try {
    const result = await getGroq().chat.completions.create({
      messages: [
        {
          role: "user",
          content: `Generate a short 3-5 word title in ${practiceLanguage === "vi" ? "Vietnamese" : "English"} for a conversation that starts with this message. Return ONLY the title, no quotes or punctuation:\n\n"${firstMessage}"`,
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
