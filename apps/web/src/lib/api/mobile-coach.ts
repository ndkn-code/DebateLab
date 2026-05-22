import "server-only";

import Groq from "groq-sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CoachContextEnvelopeSummary,
  CoachMessageMetadata,
  CoachProfileSummary,
  MobileCoachConversationSummary,
  MobileCoachMessage,
  MobileCoachSendMessageResponse,
} from "@thinkfy/shared/coach";

import {
  getCoachContextEnvelope,
  getCoachProfile,
} from "@/lib/api/coach-profile";
import {
  DEFAULT_PRACTICE_LANGUAGE,
  coercePracticeLanguage,
  getPracticeLanguageConfig,
} from "@/lib/practice-language";
import type { CoachContextEnvelope, CoachProfile, PracticeLanguage } from "@/types";

export const MOBILE_COACH_MESSAGE_MAX_LENGTH = 4000;

const MOBILE_COACH_SYSTEM_PROMPT = `You are Thinkfy AI Coach, a warm debate and public speaking coach for Vietnamese high school students.

Coach speaking practice around clarity, confidence, delivery, pacing, and understandable English.
Coach debate practice around stance, case line, mechanism, comparison, clash, and impact.

Keep answers practical and student-friendly. Use short paragraphs, bullets or numbered steps when useful, and bold important concepts. Never write a wall of text. If context is missing, teach the general method first, then ask for the exact missing detail.`;

export class MobileCoachApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
  ) {
    super(message);
    this.name = "MobileCoachApiError";
  }
}

export function isUuid(value?: string | null): value is string {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

export function normalizeMobileCoachContext(context?: string | null) {
  if (!context) return undefined;
  return context === "dashboard-home" ? "coach-home" : context;
}

function clipText(value: string, maxLength: number) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
}

function getGroqClient() {
  if (!process.env.GROQ_API_KEY) {
    throw new MobileCoachApiError(
      "Coach is unavailable because the chat provider is not configured.",
      502,
      "coach_provider_unavailable"
    );
  }

  return new Groq({ apiKey: process.env.GROQ_API_KEY });
}

function buildMobileSystemPrompt({
  envelope,
  practiceLanguage,
  profile,
}: {
  envelope: CoachContextEnvelope;
  practiceLanguage: PracticeLanguage;
  profile: CoachProfile;
}) {
  const languageConfig = getPracticeLanguageConfig(practiceLanguage);
  const languageRules =
    languageConfig.code === "vi"
      ? [
          "RESPONSE LANGUAGE:",
          "- Respond in Vietnamese.",
          "- Use natural Vietnamese debate coaching language.",
          "- If the user asks in English while Vietnamese mode is active, still answer in Vietnamese unless they explicitly ask otherwise.",
        ].join("\n")
      : [
          "RESPONSE LANGUAGE:",
          "- Respond in English.",
          "- Keep English clear and accessible for Vietnamese high school students.",
          "- If the user asks in Vietnamese while English mode is active, answer in English unless they explicitly ask otherwise.",
        ].join("\n");

  return `${MOBILE_COACH_SYSTEM_PROMPT}

${languageConfig.aiInstruction}

${languageRules}

PERSONAL COACHING CONTEXT
User: ${profile.displayName}
Streak: ${profile.streak}
Level: ${profile.level}
Credits: ${profile.credits}
Recent trend: ${profile.brief.trendSummary}
Next move: ${profile.brief.nextMove}
Strongest skill: ${profile.brief.strongestSkillLabel ?? "not enough data"}
Focus skill: ${profile.brief.weakestSkillLabel ?? "not enough data"}
Coaching mode: ${envelope.mode}
Focus title: ${envelope.focusTitle}
Focus summary: ${envelope.focusSummary}

${envelope.promptContext}

RULES FOR THIS CONTEXT
- Use the profile and attached context to make advice specific to this student.
- Do not dump the full profile unless the student asks for a progress summary.
- If reviewing a session, point to concrete strengths, weaknesses, and missing debate layers.
- If context is thin, say that briefly and coach from the available evidence.`;
}

function isCoachMetadata(value: unknown): value is CoachMessageMetadata {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    (value as CoachMessageMetadata).renderVersion === 1 &&
    Array.isArray((value as CoachMessageMetadata).blocks)
  );
}

function mapMetadata(value: unknown) {
  return isCoachMetadata(value) ? value : null;
}

function mapConversation(
  row: Record<string, unknown>,
  preview?: string | null
): MobileCoachConversationSummary {
  return {
    id: String(row.id),
    title: String(row.title || "New conversation"),
    contextType: typeof row.context_type === "string" ? row.context_type : null,
    contextId: typeof row.context_id === "string" ? row.context_id : null,
    preview: preview ?? null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at ?? row.created_at),
  };
}

function mapMessage(row: Record<string, unknown>): MobileCoachMessage {
  return {
    id: String(row.id),
    conversationId: String(row.conversation_id),
    role:
      row.role === "assistant" || row.role === "system" || row.role === "user"
        ? row.role
        : "assistant",
    content: String(row.content ?? ""),
    metadata: mapMetadata(row.metadata),
    createdAt: String(row.created_at),
  };
}

function buildMobileCoachMetadata({
  envelope,
  profile,
}: {
  envelope: CoachContextEnvelope;
  profile: CoachProfile;
}): CoachMessageMetadata {
  const recommendationItems = profile.recommendations
    .slice(0, 3)
    .map((item) => `${item.title}: ${item.description}`);
  const drill = profile.recommendations[0];

  return {
    renderVersion: 1,
    summary: envelope.focusSummary,
    blocks: [
      {
        id: "focus",
        type: "coach_tip",
        title: envelope.focusTitle,
        body: envelope.focusSummary,
      },
      ...(recommendationItems.length > 0
        ? [
            {
              id: "next-steps",
              type: "next_steps" as const,
              title: "Suggested next moves",
              items: recommendationItems,
            },
          ]
        : []),
      ...(drill
        ? [
            {
              id: "drill",
              type: "drill" as const,
              title: drill.title,
              body: drill.description,
              prompt: drill.prompt,
            },
          ]
        : []),
    ],
    suggestedActions: envelope.starterPrompts.slice(0, 3).map((prompt, index) => ({
      label: index === 0 ? "Try this" : `Prompt ${index + 1}`,
      prompt,
      variant: index === 0 ? "primary" : "secondary",
    })),
  };
}

export function toMobileCoachProfile(profile: CoachProfile): CoachProfileSummary {
  return {
    displayName: profile.displayName,
    streak: profile.streak,
    level: profile.level,
    credits: profile.credits,
    dailyGoalMinutes: profile.dailyGoalMinutes,
    sessionsLast7: profile.sessionsLast7,
    sessionsLast30: profile.sessionsLast30,
    minutesLast7: profile.minutesLast7,
    minutesLast30: profile.minutesLast30,
    practiceMix: profile.practiceMix,
    skillSnapshot: {
      metrics: profile.skillSnapshot.metrics,
      overallScore: profile.skillSnapshot.overallScore,
      strongestSkill: profile.skillSnapshot.strongestSkill,
      weakestSkill: profile.skillSnapshot.weakestSkill,
      sourceSessions: profile.skillSnapshot.sourceSessions,
      confidence: profile.skillSnapshot.confidence,
    },
    recentTrend: profile.recentTrend,
    weaknessPatterns: profile.weaknessPatterns,
    strengthPatterns: profile.strengthPatterns,
    recentSessions: profile.recentSessions,
    recommendations: profile.recommendations,
    starterPrompts: profile.starterPrompts,
    brief: profile.brief,
  };
}

export function toMobileCoachEnvelope(
  envelope: CoachContextEnvelope
): CoachContextEnvelopeSummary {
  return {
    mode: envelope.mode,
    focusTitle: envelope.focusTitle,
    focusSummary: envelope.focusSummary,
    starterPrompts: envelope.starterPrompts,
    selectedSession: envelope.selectedSession,
  };
}

export async function getMobileCoachHome({
  contextId,
  contextType,
  message,
  practiceLanguageInput,
  supabase,
  userId,
}: {
  contextId?: string | null;
  contextType?: string | null;
  message?: string | null;
  practiceLanguageInput?: string | null;
  supabase: SupabaseClient;
  userId: string;
}) {
  const practiceLanguage = coercePracticeLanguage(
    practiceLanguageInput,
    DEFAULT_PRACTICE_LANGUAGE
  );
  const normalizedContext = normalizeMobileCoachContext(contextType);
  const profile = await getCoachProfile(userId, practiceLanguage, supabase);
  const envelope = await getCoachContextEnvelope({
    userId,
    profile,
    contextType: normalizedContext,
    contextId,
    message,
    practiceLanguage,
    supabase,
  });
  const conversations = await listMobileCoachConversations(supabase, userId);

  return {
    ok: true as const,
    profile: toMobileCoachProfile(profile),
    envelope: toMobileCoachEnvelope(envelope),
    conversations,
  };
}

export async function listMobileCoachConversations(
  supabase: SupabaseClient,
  userId: string
) {
  const { data, error } = await supabase
    .from("chat_conversations")
    .select("id, user_id, title, context_type, context_id, created_at, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(30);

  if (error) {
    throw new MobileCoachApiError(
      "Unable to load coach conversations.",
      500,
      "coach_conversations_unavailable"
    );
  }

  const rows = (data ?? []) as Record<string, unknown>[];
  if (rows.length === 0) return [];

  const conversationIds = rows.map((row) => String(row.id));
  const { data: messages } = await supabase
    .from("chat_messages")
    .select("conversation_id, content, created_at")
    .in("conversation_id", conversationIds)
    .order("created_at", { ascending: false })
    .limit(200);

  const previewByConversation = new Map<string, string>();
  for (const message of (messages ?? []) as Record<string, unknown>[]) {
    const conversationId = String(message.conversation_id);
    if (previewByConversation.has(conversationId)) continue;
    const preview = clipText(String(message.content ?? ""), 88);
    if (preview) previewByConversation.set(conversationId, preview);
  }

  return rows.map((row) =>
    mapConversation(row, previewByConversation.get(String(row.id)) ?? null)
  );
}

export async function getMobileCoachConversation({
  conversationId,
  supabase,
  userId,
}: {
  conversationId: string;
  supabase: SupabaseClient;
  userId: string;
}) {
  const { data: conversation, error: conversationError } = await supabase
    .from("chat_conversations")
    .select("id, user_id, title, context_type, context_id, created_at, updated_at")
    .eq("id", conversationId)
    .eq("user_id", userId)
    .maybeSingle();

  if (conversationError) {
    throw new MobileCoachApiError(
      "Unable to load coach conversation.",
      500,
      "coach_conversation_unavailable"
    );
  }

  if (!conversation) {
    throw new MobileCoachApiError("Conversation not found.", 404, "not_found");
  }

  const { data: messages, error: messagesError } = await supabase
    .from("chat_messages")
    .select("id, conversation_id, role, content, metadata, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(100);

  if (messagesError) {
    throw new MobileCoachApiError(
      "Unable to load coach messages.",
      500,
      "coach_messages_unavailable"
    );
  }

  return {
    ok: true as const,
    conversation: mapConversation(conversation as Record<string, unknown>),
    messages: ((messages ?? []) as Record<string, unknown>[]).map(mapMessage),
  };
}

export async function sendMobileCoachMessage({
  context,
  contextId,
  conversationId,
  message,
  practiceLanguageInput,
  supabase,
  userId,
}: {
  context?: string | null;
  contextId?: string | null;
  conversationId?: string | null;
  message: string;
  practiceLanguageInput?: string | null;
  supabase: SupabaseClient;
  userId: string;
}): Promise<MobileCoachSendMessageResponse> {
  const practiceLanguage = coercePracticeLanguage(
    practiceLanguageInput,
    DEFAULT_PRACTICE_LANGUAGE
  );
  const normalizedContext = normalizeMobileCoachContext(context);
  const trimmedMessage = message.trim();

  if (!trimmedMessage) {
    throw new MobileCoachApiError("Message is required.", 400, "empty_message");
  }
  if (trimmedMessage.length > MOBILE_COACH_MESSAGE_MAX_LENGTH) {
    throw new MobileCoachApiError(
      "Message is too long.",
      400,
      "message_too_long"
    );
  }

  let conversation: Record<string, unknown> | null = null;
  let history: Array<{ role: "user" | "assistant"; content: string }> = [];

  if (conversationId) {
    if (!isUuid(conversationId)) {
      throw new MobileCoachApiError(
        "Conversation not found.",
        404,
        "not_found"
      );
    }

    const { data: existingConversation } = await supabase
      .from("chat_conversations")
      .select("id, user_id, title, context_type, context_id, created_at, updated_at")
      .eq("id", conversationId)
      .eq("user_id", userId)
      .maybeSingle();

    if (!existingConversation) {
      throw new MobileCoachApiError(
        "Conversation not found.",
        404,
        "not_found"
      );
    }
    conversation = existingConversation as Record<string, unknown>;

    const { data: historyRows } = await supabase
      .from("chat_messages")
      .select("role, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(20);

    history = ((historyRows ?? []) as Record<string, unknown>[])
      .reverse()
      .flatMap((row) => {
        if (row.role !== "user" && row.role !== "assistant") return [];
        return [{ role: row.role, content: String(row.content ?? "") }];
      });
  }

  const profile = await getCoachProfile(userId, practiceLanguage, supabase);
  const envelope = await getCoachContextEnvelope({
    userId,
    profile,
    contextType:
      normalizedContext ??
      (typeof conversation?.context_type === "string"
        ? conversation.context_type
        : undefined),
    contextId:
      contextId ??
      (typeof conversation?.context_id === "string"
        ? conversation.context_id
        : undefined),
    message: trimmedMessage,
    practiceLanguage,
    supabase,
  });
  const systemPrompt = buildMobileSystemPrompt({
    envelope,
    practiceLanguage,
    profile,
  });

  const chatModel = process.env.GROQ_CHAT_MODEL || "llama-3.3-70b-versatile";
  const result = await getGroqClient().chat.completions.create({
    messages: [
      { role: "system", content: systemPrompt },
      ...history,
      { role: "user", content: trimmedMessage },
    ],
    model: chatModel,
    temperature: 0.7,
    max_tokens: 1600,
  });
  const assistantText = result.choices[0]?.message?.content?.trim() ?? "";
  const finishReason = result.choices[0]?.finish_reason ?? null;
  const assistantMetadata = buildMobileCoachMetadata({ envelope, profile });

  if (!assistantText) {
    throw new MobileCoachApiError(
      "Coach returned an empty response.",
      502,
      "coach_empty_response"
    );
  }

  if (!conversation) {
    const insertData: Record<string, string> = {
      user_id: userId,
      title: clipText(trimmedMessage, 64) || "New conversation",
    };
    if (normalizedContext) insertData.context_type = normalizedContext;
    if (isUuid(contextId)) insertData.context_id = contextId;

    const { data: insertedConversation, error } = await supabase
      .from("chat_conversations")
      .insert(insertData)
      .select("id, user_id, title, context_type, context_id, created_at, updated_at")
      .single();

    if (error || !insertedConversation) {
      throw new MobileCoachApiError(
        "Unable to create coach conversation.",
        500,
        "coach_conversation_create_failed"
      );
    }
    conversation = insertedConversation as Record<string, unknown>;
  }

  const resolvedConversationId = String(conversation.id);
  const { data: messageRows, error: insertMessagesError } = await supabase
    .from("chat_messages")
    .insert([
      {
        conversation_id: resolvedConversationId,
        role: "user",
        content: trimmedMessage,
      },
      {
        conversation_id: resolvedConversationId,
        role: "assistant",
        content: assistantText,
        metadata: assistantMetadata,
      },
    ])
    .select("id, conversation_id, role, content, metadata, created_at");

  if (insertMessagesError || !messageRows || messageRows.length < 2) {
    throw new MobileCoachApiError(
      "Unable to save coach messages.",
      500,
      "coach_message_save_failed"
    );
  }

  const now = new Date().toISOString();
  const { data: updatedConversation } = await supabase
    .from("chat_conversations")
    .update({ updated_at: now })
    .eq("id", resolvedConversationId)
    .eq("user_id", userId)
    .select("id, user_id, title, context_type, context_id, created_at, updated_at")
    .maybeSingle();

  const mappedConversation = mapConversation(
    (updatedConversation as Record<string, unknown> | null) ?? {
      ...conversation,
      updated_at: now,
    },
    clipText(assistantText, 88)
  );
  const mappedMessages = (messageRows as Record<string, unknown>[]).map(mapMessage);
  const userMessage = mappedMessages.find((row) => row.role === "user");
  const assistantMessage = mappedMessages.find((row) => row.role === "assistant");

  if (!userMessage || !assistantMessage) {
    throw new MobileCoachApiError(
      "Unable to save coach messages.",
      500,
      "coach_message_save_failed"
    );
  }

  return {
    ok: true,
    conversation: mappedConversation,
    userMessage,
    assistantMessage,
    envelope: toMobileCoachEnvelope(envelope),
    finishReason,
  };
}
