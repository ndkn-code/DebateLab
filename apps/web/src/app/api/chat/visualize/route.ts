import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
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
import type { CoachMessageMetadata } from "@/types";

export const maxDuration = 45;

const PRIMARY_GEMMA_VISUAL_MODEL = "gemma-4-31b-it";
const FALLBACK_GEMMA_VISUAL_MODEL = "gemma-4-26b-a4b-it";

function getGemini() {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEYS?.split(",")[0];
  if (!apiKey?.trim()) {
    throw new Error("GEMINI_API_KEY or GEMINI_API_KEYS is not configured");
  }
  return new GoogleGenerativeAI(apiKey.trim());
}

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
}) {
  const startedAt = Date.now();
  const model = getGemini().getGenerativeModel({
    model: params.modelName,
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.2,
      maxOutputTokens: 900,
    },
  });

  try {
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
      },
    });
    return result.response.text();
  } catch (error) {
    await recordAiProviderRequest({
      provider: "google",
      model: params.modelName,
      status: "error",
      sourceRoute: "/api/chat/visualize",
      outputType: "coach_visual_planner",
      userId: params.userId,
      latencyMs: Date.now() - startedAt,
      errorCode: "COACH_VISUAL_PLANNER_FAILED",
      errorMessage: error instanceof Error ? error.message : String(error),
      metadata: {
        messageId: params.messageId,
      },
    });
    throw error;
  }
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

    const plannerModels = [PRIMARY_GEMMA_VISUAL_MODEL, FALLBACK_GEMMA_VISUAL_MODEL];
    let lastError: unknown = null;
    for (const modelName of plannerModels) {
      try {
        const raw = await planVisual({
          modelName,
          prompt,
          userId: user.id,
          messageId: message.id,
        });
        const visualExplainer = normalizeCoachVisualExplainerSpec(
          extractJsonObjectFromText(raw),
          {
            sourceMessageId: message.id,
            plannerModel: modelName,
          }
        );
        if (!visualExplainer) {
          throw new Error("Planner returned invalid visual explainer JSON");
        }
        const metadata: CoachMessageMetadata = {
          renderVersion: 1,
          blocks: existingMetadata?.blocks ?? [],
          suggestedActions: existingMetadata?.suggestedActions ?? [],
          ...(existingMetadata ?? {}),
          visualizable: true,
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
