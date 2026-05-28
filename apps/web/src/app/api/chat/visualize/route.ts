import { NextRequest, NextResponse } from "next/server";
import {
  requireRequestAuth,
  unauthorizedTextResponse,
} from "@/lib/api/request-auth";
import {
  getString,
  readJsonObject,
  RequestValidationError,
  type JsonRecord,
} from "@/lib/api/request-validation";
import { recordAiProviderRequest } from "@/lib/ai/provider-requests";
import {
  extractJsonObjectFromText,
  normalizeCoachVisualExplainerSpec,
} from "@/lib/coach/visualization";
import {
  classifyGeminiError,
  getGeminiClientForSlot,
  getGeminiKeyCooldowns,
  runWithGeminiKeyPool,
} from "@/lib/gemini/key-pool";
import type { CoachMessageMetadata } from "@/types";

export const maxDuration = 45;

const PRIMARY_VISUAL_MODEL =
  process.env.GEMINI_VISUAL_PLANNER_MODEL || "gemini-3.1-flash-lite";
const PRIMARY_GEMMA_VISUAL_MODEL = "gemma-4-31b-it";
const FALLBACK_GEMMA_VISUAL_MODEL = "gemma-4-26b-a4b-it";

function parseRequest(body: JsonRecord) {
  const messageId = getString(body, "messageId", {
    required: true,
    minLength: 8,
    maxLength: 96,
  })!;
  const conversationId = getString(body, "conversationId", {
    maxLength: 96,
  });
  return { messageId, conversationId };
}

function buildPlannerPrompt(params: {
  assistantText: string;
  previousUserText?: string;
  languageHint: "vi" | "en";
}) {
  const language =
    params.languageHint === "vi"
      ? "Vietnamese, with natural debate coaching terms"
      : "English";

  return `You are a visual lesson planner for Thinkfy AI Coach.

Return ONLY one valid JSON object. No markdown. No HTML. No SVG. No React.

Allowed schema:
{
  "version": 1,
  "template": "argument_chain" | "rebuttal_pivot" | "clash_map" | "weighing_scale",
  "title": "short title",
  "subtitle": "optional short subtitle",
  "steps": [
    {"id": "step-1", "label": "short label", "text": "short explanation", "accent": "primary|warning|success|danger"}
  ],
  "connectors": [
    {"from": "step-1", "to": "step-2", "label": "optional connector label"}
  ],
  "takeaway": "one short final takeaway"
}

Rules:
- Use ${language}.
- Pick exactly one template.
- argument_chain: show claim -> mechanism -> impact -> weighing.
- rebuttal_pivot: show opponent assumption -> pivot -> stronger response.
- clash_map: show side A vs side B and the deciding clash.
- weighing_scale: show competing impacts and why one is heavier.
- 3-5 steps total. Each step text must be under 28 words.
- Teach the concept directly. Do not mention "the coach", "AI", "the app", or "Thinkfy" in title, subtitle, steps, or takeaway unless the student explicitly asked about the product.
- Prefer concise debate terms such as "Claim", "Mechanism", "Impact", "Weighing", "Clash"; for Vietnamese, use natural equivalents like "Luận điểm", "Cơ chế", "Tác động", "So sánh".
- Never include raw HTML, markdown tables, SVG, code, or unknown keys.
- Do not invent facts beyond the assistant answer.

Previous student message:
${params.previousUserText ?? "(not available)"}

Assistant answer to visualize:
${params.assistantText.slice(0, 5000)}`;
}

async function planVisual(params: {
  modelName: string;
  prompt: string;
  userId: string;
  messageId: string;
  modelFallbackCount: number;
}) {
  return runWithGeminiKeyPool({
    seed: `coach-visual:${params.userId}:${params.messageId}:${params.modelName}`,
    run: async (attempt) => {
      const startedAt = Date.now();
      const model = getGeminiClientForSlot(attempt.slot).getGenerativeModel({
        model: params.modelName,
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.2,
          maxOutputTokens: 900,
        },
      });
      const result = await model.generateContent(params.prompt);
      await recordAiProviderRequest({
        provider: "google",
        model: params.modelName,
        status: "success",
        sourceRoute: "/api/chat/visualize",
        outputType: "coach_visual_planner",
        userId: params.userId,
        latencyMs: Date.now() - startedAt,
        finishReason: result.response.candidates?.[0]?.finishReason ?? null,
        usage: {
          inputTokens: result.response.usageMetadata?.promptTokenCount,
          outputTokens: result.response.usageMetadata?.candidatesTokenCount,
          totalTokens: result.response.usageMetadata?.totalTokenCount,
        },
        metadata: {
          messageId: params.messageId,
          plannerModelFallbackCount: params.modelFallbackCount,
          keySlot: attempt.slot,
          keyFallbackCount: attempt.fallbackCount,
          keyCooldownSkippedCount: attempt.skippedCooldownCount,
          keyCooldownSkippedSlots: attempt.skippedCooldownSlots,
        },
      });
      return result.response.text();
    },
    onError: async (error, attempt, cooldown) => {
      await recordAiProviderRequest({
        provider: "google",
        model: params.modelName,
        status: "error",
        sourceRoute: "/api/chat/visualize",
        outputType: "coach_visual_planner",
        userId: params.userId,
        latencyMs: null,
        errorCode: getVisualPlannerErrorCode(error),
        errorMessage: error instanceof Error ? error.message : String(error),
        metadata: {
          messageId: params.messageId,
          plannerModelFallbackCount: params.modelFallbackCount,
          geminiErrorKind: classifyGeminiError(error),
          keySlot: attempt.slot,
          keyFallbackCount: attempt.fallbackCount,
          keyCooldownSkippedCount: attempt.skippedCooldownCount,
          keyCooldownSkippedSlots: attempt.skippedCooldownSlots,
          keyCooldownUntil: cooldown?.until ?? null,
          activeKeyCooldowns: getGeminiKeyCooldowns().map((item) => ({
            slot: item.slot,
            reason: item.reason,
            until: item.until,
            failureCount: item.failureCount,
          })),
        },
      });
    },
  });
}

function getVisualPlannerErrorCode(error: unknown) {
  const kind = classifyGeminiError(error);
  if (kind === "rate_limit") return "RATE_LIMIT_OR_QUOTA";
  if (kind === "service_unavailable") return "GEMINI_SERVICE_UNAVAILABLE";
  if (kind === "access_denied") return "GEMINI_ACCESS_DENIED";
  return "COACH_VISUAL_PLANNER_FAILED";
}

async function recordInvalidVisualPlan(params: {
  modelName: string;
  userId: string;
  messageId: string;
  modelFallbackCount: number;
  error: unknown;
}) {
  await recordAiProviderRequest({
    provider: "google",
    model: params.modelName,
    status: "error",
    sourceRoute: "/api/chat/visualize",
    outputType: "coach_visual_planner",
    userId: params.userId,
    latencyMs: null,
    errorCode: "COACH_VISUAL_SCHEMA_INVALID",
    errorMessage: params.error instanceof Error ? params.error.message : String(params.error),
    metadata: {
      messageId: params.messageId,
      plannerModelFallbackCount: params.modelFallbackCount,
      providerCallSucceeded: true,
    },
  });
}

function inferLanguage(text: string): "vi" | "en" {
  return /[ăâđêôơưáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/i.test(
    text
  )
    ? "vi"
    : "en";
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireRequestAuth(req, { allowDevBypass: false });
    if (!auth.ok) {
      return unauthorizedTextResponse();
    }
    const { supabase, user } = auth;
    const body = parseRequest(await readJsonObject(req, { maxBytes: 8 * 1024 }));

    const { data: message, error } = await supabase
      .from("chat_messages")
      .select(
        "id, conversation_id, role, content, metadata, created_at, chat_conversations!inner(user_id)"
      )
      .eq("id", body.messageId)
      .eq("role", "assistant")
      .eq("chat_conversations.user_id", user.id)
      .maybeSingle();

    if (error || !message) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }
    if (body.conversationId && message.conversation_id !== body.conversationId) {
      return NextResponse.json({ error: "Conversation mismatch" }, { status: 400 });
    }

    const existingMetadata = (message.metadata ?? null) as CoachMessageMetadata | null;
    if (existingMetadata?.visualExplainer) {
      return NextResponse.json({
        visualExplainer: existingMetadata.visualExplainer,
        metadata: existingMetadata,
      });
    }

    const { data: previousRows } = await supabase
      .from("chat_messages")
      .select("role, content, created_at")
      .eq("conversation_id", message.conversation_id)
      .lt("created_at", message.created_at)
      .order("created_at", { ascending: false })
      .limit(6);
    const previousUserText = (previousRows ?? []).find(
      (row) => row.role === "user"
    )?.content;

    const prompt = buildPlannerPrompt({
      assistantText: message.content,
      previousUserText,
      languageHint: inferLanguage(`${previousUserText ?? ""}\n${message.content}`),
    });

    const plannerModels = [
      PRIMARY_VISUAL_MODEL,
      PRIMARY_GEMMA_VISUAL_MODEL,
      FALLBACK_GEMMA_VISUAL_MODEL,
    ];
    let lastError: unknown = null;
    for (const [modelFallbackCount, modelName] of plannerModels.entries()) {
      try {
        const raw = await planVisual({
          modelName,
          prompt,
          userId: user.id,
          messageId: message.id,
          modelFallbackCount,
        });
        const visualExplainer = normalizeCoachVisualExplainerSpec(
          extractJsonObjectFromText(raw),
          {
            sourceMessageId: message.id,
            plannerModel: modelName,
          }
        );
        if (!visualExplainer) {
          const schemaError = new Error(
            "Planner returned invalid visual explainer JSON"
          );
          await recordInvalidVisualPlan({
            modelName,
            userId: user.id,
            messageId: message.id,
            modelFallbackCount,
            error: schemaError,
          });
          throw schemaError;
        }
        const metadata: CoachMessageMetadata = {
          renderVersion: 1,
          blocks: existingMetadata?.blocks ?? [],
          suggestedActions: existingMetadata?.suggestedActions ?? [],
          ...(existingMetadata ?? {}),
          visualizable: true,
          autoVisualize: false,
          visualExplainer,
          visualTemplate: visualExplainer.template,
          visualPlannerModel: modelName,
        };
        await supabase
          .from("chat_messages")
          .update({ metadata })
          .eq("id", message.id);
        return NextResponse.json({ visualExplainer, metadata });
      } catch (error) {
        lastError = error;
      }
    }

    return NextResponse.json(
      {
        error:
          lastError instanceof Error
            ? lastError.message
            : "Could not create visual explainer",
      },
      { status: 502 }
    );
  } catch (error) {
    if (error instanceof RequestValidationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
