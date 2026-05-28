import { NextRequest } from "next/server";
import Groq from "groq-sdk";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getPostHogServer } from "@/lib/posthog-server";
import { recordAiProviderRequest } from "@/lib/ai/provider-requests";
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
import { decideCoachIntent, type CoachIntentDecision } from "@/lib/coach/intent";
import { pruneCoachMetadata } from "@/lib/coach/metadata";
import {
  createDebateCorpusRetrievalMetadata,
  retrieveDebateCorpusContext,
  type DebateCorpusRetrievalResult,
} from "@/lib/corpus/retrieval";
import {
  classifyGeminiError,
  getGeminiClientForSlot,
  getGeminiKeyCooldowns,
  recordGeminiKeyFailure,
  recordGeminiKeySuccess,
  selectGeminiKeyAttempts,
  shouldTryNextGeminiKey,
} from "@/lib/gemini/key-pool";
import type {
  CoachModelRoute,
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
- Do not put a heading or list item on its own line unless it is valid markdown.
- If you name 3+ concepts, use a markdown bullet list with "- ".
- Start with a direct answer, then elaborate if needed
- End with either an encouraging one-liner or a precise next-step suggestion
- Give the full useful answer as normal readable markdown. Do not rely on UI cards, section labels, or hidden metadata to complete the answer.
- If details are missing, teach the general method first, then ask for the exact missing detail you need.
- When the student asks for diagnosis/review but gives no transcript, score, or concrete speech text, do not guess the weakness. Say what evidence you need and give one general framework only.

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
- Do not diagnose "lack of experience", "practice more", "unclear technique", or other generic weaknesses unless you can point to concrete user material in the chat context.

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
- Output pseudo-lists as plain lines. If it is a list, use real markdown bullets or numbering.

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

const GROQ_COACH_MODEL = "llama-3.3-70b-versatile";
const GEMINI_DEEP_COACH_MODEL = "gemini-3.1-flash-lite";
const CHAT_PROVIDER_SOURCE_ROUTE = "/api/chat";

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

const ENABLE_COACH_METADATA = process.env.ENABLE_COACH_METADATA !== "false";

const COACH_BLOCK_TYPES = [
  "opening_formula",
  "template",
  "diagnosis",
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
  userId,
  routeIntent,
  modelRoute,
  corpusRetrieval,
  firstTokenLatencyMs,
}: {
  assistantText: string;
  studentMessage: string;
  mode?: string;
  focusTitle?: string;
  practiceLanguage: string;
  userId?: string | null;
  routeIntent: CoachIntentDecision;
  modelRoute: CoachModelRoute;
  corpusRetrieval: DebateCorpusRetrievalResult | null;
  firstTokenLatencyMs?: number | null;
}): Promise<CoachMessageMetadata | null> {
  if (!assistantText.trim()) return null;

  try {
    const startedAt = Date.now();
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
      "type": "opening_formula | template | diagnosis | coach_tip | common_mistake | example | drill | next_steps | clarifying_question",
      "title": "short card title",
      "body": "optional short paragraph",
      "items": ["optional short bullets"],
      "prompt": "optional follow-up prompt"
    }
  ],
  "suggestedActions": [
    { "label": "short button label", "prompt": "message to send", "variant": "primary | secondary" }
  ],
  "visualizable": true,
  "visualPrompt": "optional short prompt for a visual explainer"
}

Rules:
- Use 0-5 blocks. Return "blocks": [] and "suggestedActions": [] when the reply is clearer as plain text.
- Cards are optional enhancements, not a second copy of the answer. If a card would repeat or paraphrase the visible markdown answer, omit it.
- Pick block types that match the assistant reply. Do not invent facts or force a card.
- Prefer debate-specific blocks over generic summaries only when the structure is genuinely useful.
- Use diagnosis only when the coach identifies a specific weakness or missing debate layer from concrete student material.
- Do not create generic diagnosis cards such as "lack of experience", "unclear technique", or "practice more".
- Use example for a concrete before/after example, drill for a timed exercise, and next_steps only for a concrete action plan.
- Do not create both diagnosis and next_steps from the same material. Prefer a drill or example over a broad action-plan card.
- next_steps must include a concrete exercise, timed action, checklist, rewrite task, or exact next message to send.
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
      model: GROQ_COACH_MODEL,
      temperature: 0.2,
      max_tokens: 900,
      response_format: { type: "json_object" },
    });

    const raw = result.choices[0]?.message?.content ?? "";
    const parsed = parseJsonObject(raw) as Record<string, unknown> | null;
    const normalizedMetadata = normalizeMetadata(parsed, {
      assistantText,
      studentMessage,
    });
    const pruned = normalizedMetadata
      ? pruneCoachMetadata(normalizedMetadata, {
          assistantText,
          studentMessage,
          intent: routeIntent.intent,
        })
      : null;

    await recordAiProviderRequest({
      provider: "groq",
      model: GROQ_COACH_MODEL,
      status: "success",
      sourceRoute: CHAT_PROVIDER_SOURCE_ROUTE,
      outputType: "coach_metadata",
      userId,
      latencyMs: Date.now() - startedAt,
      finishReason: result.choices[0]?.finish_reason ?? null,
      usage: {
        inputTokens: result.usage?.prompt_tokens,
        outputTokens: result.usage?.completion_tokens,
        totalTokens: result.usage?.total_tokens,
      },
      metadata: {
        coachIntent: routeIntent.intent,
        coachIntentReason: routeIntent.reason,
        coachModelRoute: modelRoute,
        coachCorpusRetrievedCount: corpusRetrieval?.items.length ?? 0,
        metadataOriginalBlockCount: pruned?.audit.originalBlockCount ?? 0,
        metadataKeptBlockCount: pruned?.audit.keptBlockCount ?? 0,
        metadataRejectedBlockCount: pruned?.audit.rejectedBlockCount ?? 0,
        metadataPruneReasons: pruned?.audit.reasons ?? {},
      },
    });
    const metadata = pruned?.metadata ?? null;
    if (!metadata) return null;
    return {
      ...metadata,
      visualizable:
        metadata.visualizable ||
        routeIntent.intent === "visual_explainer" ||
        Boolean(parsed?.visualizable),
      autoVisualize: routeIntent.intent === "visual_explainer",
      visualPrompt:
        cleanText(parsed?.visualPrompt, 220) ?? undefined,
      coachIntent: routeIntent.intent,
      coachModelRoute: modelRoute,
      coachCorpusRetrievedCount: corpusRetrieval?.items.length ?? 0,
      coachCorpusCandidateCount: corpusRetrieval?.candidateItems.length ?? 0,
      corpusRetrievalLogId: corpusRetrieval?.logId ?? null,
      firstTokenLatencyMs: firstTokenLatencyMs ?? null,
    };
  } catch (metadataError) {
    await recordAiProviderRequest({
      provider: "groq",
      model: GROQ_COACH_MODEL,
      status: "error",
      sourceRoute: CHAT_PROVIDER_SOURCE_ROUTE,
      outputType: "coach_metadata",
      userId,
      errorCode: "COACH_METADATA_FAILED",
      errorMessage:
        metadataError instanceof Error ? metadataError.message : String(metadataError),
      metadata: {
        coachIntent: routeIntent.intent,
        coachIntentReason: routeIntent.reason,
        coachModelRoute: modelRoute,
      },
    });
    if (process.env.NODE_ENV === "development") {
      console.error("Coach metadata generation failed:", metadataError);
    }
    return null;
  }
}

function getCoachModelRoute(intent: CoachIntentDecision): CoachModelRoute {
  if (intent.intent === "deep_review") return "gemini_deep_review";
  if (intent.intent === "visual_explainer") return "visual_explainer";
  if (intent.intent === "corpus_debate_help") return "groq_corpus";
  return "groq_general";
}

function buildCoachRagQuery(params: {
  message: string;
  focusTitle?: string;
  focusSummary?: string;
  promptContext?: string;
}) {
  return [
    params.focusTitle ? `Focus: ${params.focusTitle}` : "",
    params.focusSummary ? `Focus summary: ${params.focusSummary}` : "",
    `Student question: ${params.message}`,
    params.promptContext
      ? `Coach context excerpt:\n${params.promptContext.slice(0, 1800)}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

function buildCoachSystemPrompt(params: {
  systemPrompt: string;
  routeIntent: CoachIntentDecision;
  corpusContext?: string;
}) {
  const routingRules =
    params.routeIntent.intent === "deep_review"
      ? [
          "COACH ROUTE:",
          "- This is a high-value review/strategy turn. Give a careful diagnosis, trend, and next drill.",
          "- Be decisive and specific. Use bullets and short sections.",
        ].join("\n")
      : params.routeIntent.intent === "visual_explainer"
        ? [
            "COACH ROUTE:",
            "- The student is asking for a visual explanation. First give a short, polished markdown explanation in 2-3 paragraphs.",
            "- Do NOT output a fake diagram, arrow chain, raw node list, or labels like 'Vấn Đề -> Cơ Chế -> Kết Luận' in the prose.",
            "- If you need to name the parts, use a compact bullet list with bold labels.",
            "- The UI will render the actual visual card separately, so your text should explain the idea, not duplicate the diagram.",
            "- Make the explanation easy to convert into a diagram with 3-5 nodes.",
          ].join("\n")
        : params.routeIntent.intent === "corpus_debate_help"
          ? [
              "COACH ROUTE:",
              "- This is debate-specific coaching. Use Trường Teen patterns when they are relevant.",
              "- Avoid generic advice; identify the missing layer and show a concrete move.",
            ].join("\n")
          : [
              "COACH ROUTE:",
              "- This is general coaching chat. Stay fast, warm, and useful.",
            ].join("\n");

  return [
    params.systemPrompt,
    routingRules,
    params.corpusContext
      ? `${params.corpusContext}\nCOACH RAG RULES:\n- Treat the Trường Teen context as private coaching reference material.\n- Do not cite corpus item IDs to the student.\n- Do not present debater-mentioned evidence as independently verified fact.\n- Prefer transferable debate moves over memorized phrasing.`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

function getGeminiUsage(usage: {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  totalTokenCount?: number;
} | null | undefined) {
  return {
    inputTokens: usage?.promptTokenCount,
    outputTokens: usage?.candidatesTokenCount,
    totalTokens: usage?.totalTokenCount,
  };
}

function getGeminiCoachErrorCode(error: unknown) {
  const kind = classifyGeminiError(error);
  if (kind === "rate_limit") return "RATE_LIMIT_OR_QUOTA";
  if (kind === "service_unavailable") return "GEMINI_SERVICE_UNAVAILABLE";
  if (kind === "access_denied") return "GEMINI_ACCESS_DENIED";
  return "GEMINI_COACH_FAILED";
}

async function streamGeminiCoachResponse(params: {
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  userId: string;
  modelRoute: CoachModelRoute;
  routeIntent: CoachIntentDecision;
  corpusRetrieval: DebateCorpusRetrievalResult | null;
  onText: (text: string) => void;
}) {
  const prompt = params.messages
    .map((message) => `${message.role.toUpperCase()}:\n${message.content}`)
    .join("\n\n");
  const attempts = selectGeminiKeyAttempts(
    `${GEMINI_DEEP_COACH_MODEL}:${params.userId}:${params.routeIntent.intent}:${prompt.slice(
      0,
      256
    )}`
  );
  let lastError: unknown = null;

  for (let index = 0; index < attempts.length; index += 1) {
    const attempt = attempts[index];
    const startedAt = Date.now();
    let fullText = "";
    let emittedText = false;
    let usage:
      | {
          promptTokenCount?: number;
          candidatesTokenCount?: number;
          totalTokenCount?: number;
        }
      | null = null;

    try {
      const model = getGeminiClientForSlot(attempt.slot).getGenerativeModel({
        model: GEMINI_DEEP_COACH_MODEL,
        generationConfig: {
          temperature: 0.35,
          maxOutputTokens: 1600,
        },
      });
      const result = await model.generateContentStream(prompt);

      for await (const chunk of result.stream) {
        const text = chunk.text();
        if (!text) continue;
        emittedText = true;
        fullText += text;
        params.onText(text);
      }

      const finalResponse = await result.response;
      usage = finalResponse.usageMetadata ?? usage;
      recordGeminiKeySuccess(attempt.slot);
      await recordAiProviderRequest({
        provider: "google",
        model: GEMINI_DEEP_COACH_MODEL,
        status: "success",
        sourceRoute: CHAT_PROVIDER_SOURCE_ROUTE,
        outputType: "coach_deep_review",
        userId: params.userId,
        latencyMs: Date.now() - startedAt,
        finishReason:
          finalResponse.candidates?.[0]?.finishReason ??
          (fullText.length > 0 ? "STOP" : null),
        usage: getGeminiUsage(usage),
        metadata: {
          coachIntent: params.routeIntent.intent,
          coachIntentReason: params.routeIntent.reason,
          coachModelRoute: params.modelRoute,
          coachCorpusRetrievedCount: params.corpusRetrieval?.items.length ?? 0,
          keySlot: attempt.slot,
          keyFallbackCount: attempt.fallbackCount,
          keyCooldownSkippedCount: attempt.skippedCooldownCount,
          keyCooldownSkippedSlots: attempt.skippedCooldownSlots,
        },
      });
      return fullText;
    } catch (error) {
      lastError = error;
      const cooldown = recordGeminiKeyFailure(attempt.slot, error);
      await recordAiProviderRequest({
        provider: "google",
        model: GEMINI_DEEP_COACH_MODEL,
        status: "error",
        sourceRoute: CHAT_PROVIDER_SOURCE_ROUTE,
        outputType: "coach_deep_review",
        userId: params.userId,
        latencyMs: Date.now() - startedAt,
        errorCode: getGeminiCoachErrorCode(error),
        errorMessage: error instanceof Error ? error.message : String(error),
        metadata: {
          coachIntent: params.routeIntent.intent,
          coachIntentReason: params.routeIntent.reason,
          coachModelRoute: params.modelRoute,
          geminiErrorKind: classifyGeminiError(error),
          keySlot: attempt.slot,
          keyFallbackCount: attempt.fallbackCount,
          keyCooldownSkippedCount: attempt.skippedCooldownCount,
          keyCooldownSkippedSlots: attempt.skippedCooldownSlots,
          keyCooldownUntil: cooldown?.until ?? null,
          emittedText,
          activeKeyCooldowns: getGeminiKeyCooldowns().map((item) => ({
            slot: item.slot,
            reason: item.reason,
            until: item.until,
            failureCount: item.failureCount,
          })),
        },
      });
      if (
        emittedText ||
        !shouldTryNextGeminiKey(error) ||
        index === attempts.length - 1
      ) {
        throw error;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
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
    let coachPromptContext: {
      focusTitle?: string;
      focusSummary?: string;
      promptContext?: string;
    } = {};
    const routeIntent = decideCoachIntent({
      message,
      contextType: normalizedContext,
    });
    const modelRoute = getCoachModelRoute(routeIntent);
    let corpusRetrieval: DebateCorpusRetrievalResult | null = null;

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
      coachPromptContext = {
        focusTitle: envelope.focusTitle,
        focusSummary: envelope.focusSummary,
        promptContext: envelope.promptContext,
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

    if (routeIntent.corpusPurpose) {
      corpusRetrieval = await retrieveDebateCorpusContext({
        purpose: routeIntent.corpusPurpose,
        practiceLanguage,
        practiceTrack: "debate",
        topic: coachPromptContext.focusTitle || message,
        transcript: buildCoachRagQuery({
          message,
          focusTitle: coachPromptContext.focusTitle,
          focusSummary: coachPromptContext.focusSummary,
          promptContext: coachPromptContext.promptContext,
        }),
        roundsText: coachPromptContext.focusSummary
          ? [coachPromptContext.focusSummary]
          : undefined,
        userId: user.id,
        sourceRoute: CHAT_PROVIDER_SOURCE_ROUTE,
      });
    }

    systemPrompt = buildCoachSystemPrompt({
      systemPrompt,
      routeIntent,
      corpusContext: corpusRetrieval?.contextBlock,
    });

    const chatModel = GROQ_COACH_MODEL;

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

    // Stream response from the selected coach route
    const streamStartTime = Date.now();
    let fullResponse = "";
    let finishReason: string | null = null;
    let firstTokenLatencyMs: number | null = null;

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        try {
          if (modelRoute === "gemini_deep_review") {
            try {
              fullResponse = await streamGeminiCoachResponse({
                messages,
                userId: user.id,
                modelRoute,
                routeIntent,
                corpusRetrieval,
                onText: (text) => {
                  if (firstTokenLatencyMs == null) {
                    firstTokenLatencyMs = Date.now() - streamStartTime;
                  }
                  fullResponse += text;
                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({
                        text,
                        conversationId,
                        coachIntent: routeIntent.intent,
                      })}\n\n`
                    )
                  );
                },
              });
              finishReason = "stop";
            } catch (geminiError) {
              if (process.env.NODE_ENV === "development") {
                console.warn(
                  "Gemini coach route failed; falling back to Groq:",
                  geminiError instanceof Error
                    ? geminiError.message
                    : geminiError
                );
              }
              fullResponse = "";
            }
          }

          if (fullResponse.length === 0) {
            const groqStartedAt = Date.now();
            const chatCompletion = await getGroq().chat.completions.create({
              messages,
              model: chatModel,
              temperature: modelRoute === "visual_explainer" ? 0.55 : 0.7,
              max_tokens: 1600,
              stream: true,
            });
            for await (const chunk of chatCompletion) {
              const choice = chunk.choices[0];
              const text = choice?.delta?.content || "";
              if (choice?.finish_reason) {
                finishReason = choice.finish_reason;
              }
              if (text) {
                if (firstTokenLatencyMs == null) {
                  firstTokenLatencyMs = Date.now() - streamStartTime;
                }
                fullResponse += text;
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      text,
                      conversationId,
                      coachIntent: routeIntent.intent,
                    })}\n\n`
                  )
                );
              }
            }

            await recordAiProviderRequest({
              provider: "groq",
              model: chatModel,
              status: "success",
              sourceRoute: CHAT_PROVIDER_SOURCE_ROUTE,
              outputType:
                modelRoute === "visual_explainer"
                  ? "coach_visual_prompt"
                  : "coach_chat",
              userId: user.id,
              latencyMs: Date.now() - groqStartedAt,
              finishReason,
              usage: {
                outputTokens: Math.ceil(fullResponse.length / 4),
                totalTokens: Math.ceil(
                  (fullResponse.length +
                    messages.reduce((sum, item) => sum + item.content.length, 0)) /
                    4
                ),
              },
              metadata: {
                coachIntent: routeIntent.intent,
                coachIntentReason: routeIntent.reason,
                coachModelRoute: modelRoute,
                coachCorpusRetrievedCount: corpusRetrieval?.items.length ?? 0,
                coachCorpusCandidateCount:
                  corpusRetrieval?.candidateItems.length ?? 0,
                firstTokenLatencyMs,
              },
            });
          }

          const metadata = ENABLE_COACH_METADATA
            ? await generateCoachMessageMetadata({
                assistantText: fullResponse,
                studentMessage: message.trim(),
                mode: coachMetadataContext.mode,
                focusTitle: coachMetadataContext.focusTitle,
                practiceLanguage,
                userId: user.id,
                routeIntent,
                modelRoute,
                corpusRetrieval,
                firstTokenLatencyMs,
              })
            : null;

          const finalMetadata =
            metadata ??
            ({
              renderVersion: 1,
              blocks: [],
              suggestedActions: [],
              coachIntent: routeIntent.intent,
              coachModelRoute: modelRoute,
              coachCorpusRetrievedCount: corpusRetrieval?.items.length ?? 0,
              coachCorpusCandidateCount: corpusRetrieval?.candidateItems.length ?? 0,
              corpusRetrievalLogId: corpusRetrieval?.logId ?? null,
              firstTokenLatencyMs,
              visualizable: routeIntent.intent === "visual_explainer",
              autoVisualize: routeIntent.intent === "visual_explainer",
            } satisfies CoachMessageMetadata);

          // Save assistant message
          const { data: assistantRow } = await supabase
            .from("chat_messages")
            .insert({
              conversation_id: conversationId,
              role: "assistant",
              content: fullResponse,
              metadata: finalMetadata,
            })
            .select("id")
            .single();

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
              coach_intent: routeIntent.intent,
              coach_model_route: modelRoute,
            },
          });

          // Auto-generate title from first user message
          if ((history ?? []).length <= 1) {
            generateTitle(
              message.trim(),
              conversationId!,
              supabase,
              practiceLanguage,
              user.id
            );
          }

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                done: true,
                conversationId,
                assistantMessageId: assistantRow?.id ?? null,
                finishReason,
                metadata: finalMetadata,
                coachIntent: routeIntent.intent,
                coachModelRoute: modelRoute,
                corpusRetrieval: corpusRetrieval
                  ? createDebateCorpusRetrievalMetadata(corpusRetrieval)
                  : null,
              })}\n\n`
            )
          );
          controller.close();
        } catch (err) {
          await recordAiProviderRequest({
            provider: modelRoute === "gemini_deep_review" ? "google/groq" : "groq",
            model:
              modelRoute === "gemini_deep_review"
                ? `${GEMINI_DEEP_COACH_MODEL}/${chatModel}`
                : chatModel,
            status: "error",
            sourceRoute: CHAT_PROVIDER_SOURCE_ROUTE,
            outputType: "coach_chat",
            userId: user.id,
            latencyMs: Date.now() - streamStartTime,
            errorCode: "COACH_STREAM_FAILED",
            errorMessage: err instanceof Error ? err.message : String(err),
            metadata: {
              coachIntent: routeIntent.intent,
              coachIntentReason: routeIntent.reason,
              coachModelRoute: modelRoute,
              firstTokenLatencyMs,
            },
          });
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
  practiceLanguage: string,
  userId?: string | null
) {
  try {
    const startedAt = Date.now();
    const result = await getGroq().chat.completions.create({
      messages: [
        {
          role: "user",
          content: `Generate a short 3-5 word title in ${practiceLanguage === "vi" ? "Vietnamese" : "English"} for a conversation that starts with this message. Return ONLY the title, no quotes or punctuation:\n\n"${firstMessage}"`,
        },
      ],
      model: GROQ_COACH_MODEL,
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
    await recordAiProviderRequest({
      provider: "groq",
      model: GROQ_COACH_MODEL,
      status: "success",
      sourceRoute: CHAT_PROVIDER_SOURCE_ROUTE,
      outputType: "coach_title",
      userId,
      latencyMs: Date.now() - startedAt,
      finishReason: result.choices[0]?.finish_reason ?? null,
      usage: {
        inputTokens: result.usage?.prompt_tokens,
        outputTokens: result.usage?.completion_tokens,
        totalTokens: result.usage?.total_tokens,
      },
      metadata: { conversationId },
    });
  } catch (error) {
    await recordAiProviderRequest({
      provider: "groq",
      model: GROQ_COACH_MODEL,
      status: "error",
      sourceRoute: CHAT_PROVIDER_SOURCE_ROUTE,
      outputType: "coach_title",
      userId,
      errorCode: "COACH_TITLE_FAILED",
      errorMessage: error instanceof Error ? error.message : String(error),
      metadata: { conversationId },
    });
    // Non-critical, ignore
  }
}
