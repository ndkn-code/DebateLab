import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getPostHogServer } from "@/lib/posthog-server";
import {
  requireRequestAuth,
  shouldConsumeUserRateLimit,
} from "@/lib/api/request-auth";
import { getPracticeLanguageConfig } from "@/lib/practice-language";
import {
  getEnum,
  getNumber,
  getString,
  getStringArray,
  isPlainRecord,
  readJsonObject,
  RequestValidationError,
  type JsonRecord,
} from "@/lib/api/request-validation";
import { formatMotionBriefForPrompt } from "@/lib/motion-brief";
import {
  createDeepSeekChatCompletion,
  type DeepSeekMessage,
  type DeepSeekUsage,
} from "@/lib/ai/deepseek";
import { recordAiQualityRun } from "@/lib/ai/quality";
import { recordAiProviderRequest } from "@/lib/ai/provider-requests";
import {
  createDebateCorpusRetrievalMetadata,
  linkDebateCorpusRetrievalLogToAiRun,
  retrieveDebateCorpusContext,
} from "@/lib/corpus/retrieval";
import {
  getProviderLabel,
  getProviderModelName,
  getRebuttalProvider,
  type AiProvider,
} from "@/lib/ai/provider-selection";
import { tryCreateAdminClient } from "@/lib/supabase/admin";
import {
  formatDebateMemoryForPrompt,
  getRebuttalMaxOutputTokens,
  getRebuttalWordTarget,
} from "@/lib/rebuttal/debate-continuity";
import { normalizeStructuredRebuttalResponse } from "@/lib/rebuttal/structured-response";
import {
  TRUONG_TEEN_PROMPT_VERSION,
  buildFuzzyEvidenceHintBlock,
  buildTruongTeenRebuttalPromptAddendum,
  getTruongTeenWordTarget,
  shouldUseTruongTeenPrompt,
} from "@/lib/truong-teen/debate-dna";
import type {
  AiDifficulty,
  DebateMemory,
  MotionBrief,
  PracticeLanguage,
  PracticeTrack,
} from "@/types";

export const maxDuration = 60;

interface RebuttalRequest {
  topic: string;
  side: "proposition" | "opposition";
  userTranscript: string;
  roundLabel: string;
  difficulty: AiDifficulty;
  practiceTrack?: PracticeTrack;
  practiceLanguage: PracticeLanguage;
  previousRounds?: { label: string; speaker: string; text: string }[];
  speechTimeSeconds?: number;
  currentRoundNumber?: number;
  motionBrief?: MotionBrief;
  debateMemory?: DebateMemory;
}

function parsePreviousRounds(value: unknown) {
  if (value == null) return undefined;
  if (!Array.isArray(value) || value.length > 8) {
    throw new RequestValidationError("previousRounds is invalid.");
  }

  return value.map((round, index) => {
    if (!isPlainRecord(round)) {
      throw new RequestValidationError(`previousRounds[${index}] is invalid.`);
    }

    const label =
      typeof round.label === "string"
        ? round.label.trim().slice(0, 80)
        : `Round ${index + 1}`;
    const speaker =
      typeof round.speaker === "string"
        ? round.speaker.trim().slice(0, 80)
        : "speaker";
    const text =
      typeof round.text === "string"
        ? round.text.trim().slice(0, 8000)
        : "";

    return { label, speaker, text };
  });
}

function readLimitedString(
  source: JsonRecord,
  key: string,
  maxLength: number
) {
  const value = source[key];
  if (value == null || value === "") return "";
  if (typeof value !== "string") {
    throw new RequestValidationError(`${key} must be a string.`);
  }
  return value.trim().slice(0, maxLength);
}

function parseMotionBrief(value: unknown): MotionBrief | undefined {
  if (value == null) return undefined;
  if (!isPlainRecord(value)) {
    throw new RequestValidationError("motionBrief is invalid.");
  }

  const keyTerms = getStringArray(value.keyTerms, "motionBrief.keyTerms", {
    maxItems: 10,
    maxItemLength: 220,
  }).filter(Boolean);
  const scope = readLimitedString(value, "scope", 1200);
  const propositionBurden = readLimitedString(
    value,
    "propositionBurden",
    1200
  );
  const oppositionBurden = readLimitedString(
    value,
    "oppositionBurden",
    1200
  );
  const modelClarification = readLimitedString(
    value,
    "modelClarification",
    1200
  );

  if (
    keyTerms.length === 0 ||
    !scope ||
    !propositionBurden ||
    !oppositionBurden ||
    !modelClarification
  ) {
    throw new RequestValidationError("motionBrief is incomplete.");
  }

  return {
    keyTerms,
    scope,
    propositionBurden,
    oppositionBurden,
    modelClarification,
  };
}

function parseDebateMemory(value: unknown): DebateMemory | undefined {
  if (value == null) return undefined;
  if (!isPlainRecord(value)) {
    throw new RequestValidationError("debateMemory is invalid.");
  }

  const aiSide = value.aiSide;
  const studentSide = value.studentSide;
  if (aiSide !== "proposition" && aiSide !== "opposition") {
    throw new RequestValidationError("debateMemory.aiSide is invalid.");
  }
  if (studentSide !== "proposition" && studentSide !== "opposition") {
    throw new RequestValidationError("debateMemory.studentSide is invalid.");
  }

  return {
    aiSide,
    studentSide,
    policyModel: readLimitedString(value, "policyModel", 1200),
    priorAiClaims: getStringArray(value.priorAiClaims, "debateMemory.priorAiClaims", {
      maxItems: 12,
      maxItemLength: 500,
    }).filter(Boolean),
    concessions: getStringArray(value.concessions, "debateMemory.concessions", {
      maxItems: 8,
      maxItemLength: 500,
    }).filter(Boolean),
    activeClashes: getStringArray(value.activeClashes, "debateMemory.activeClashes", {
      maxItems: 12,
      maxItemLength: 500,
    }).filter(Boolean),
    droppedClaims: getStringArray(value.droppedClaims, "debateMemory.droppedClaims", {
      maxItems: 10,
      maxItemLength: 500,
    }).filter(Boolean),
  };
}

function parseRebuttalRequest(body: JsonRecord): RebuttalRequest {
  return {
    topic: getString(body, "topic", {
      required: true,
      minLength: 2,
      maxLength: 300,
    })!,
    side: getEnum(body, "side", ["proposition", "opposition"] as const, {
      required: true,
    })!,
    userTranscript: getString(body, "userTranscript", {
      required: true,
      minLength: 1,
      maxLength: 25000,
    })!,
    roundLabel: getString(body, "roundLabel", {
      required: true,
      minLength: 1,
      maxLength: 80,
    })!,
    difficulty: getEnum(body, "difficulty", ["easy", "medium", "hard"] as const, {
      defaultValue: "medium",
    }) as AiDifficulty,
    practiceTrack: getEnum(
      body,
      "practiceTrack",
      ["speaking", "debate"] as const,
      { defaultValue: "debate" }
    ) as PracticeTrack,
    practiceLanguage: getEnum(
      body,
      "practiceLanguage",
      ["en", "vi"] as const,
      { defaultValue: "en" }
    ) as PracticeLanguage,
    previousRounds: parsePreviousRounds(body.previousRounds),
    speechTimeSeconds: getNumber(body, "speechTimeSeconds", {
      min: 60,
      max: 900,
      defaultValue: 180,
    }),
    currentRoundNumber: getNumber(body, "currentRoundNumber", {
      min: 1,
      max: 20,
    }),
    motionBrief: parseMotionBrief(body.motionBrief),
    debateMemory: parseDebateMemory(body.debateMemory),
  };
}

const difficultyPrompts: Record<AiDifficulty, string> = {
  easy: `You are a BEGINNER-level debate opponent. Your rebuttals should:
- Use simple but complete counter-arguments
- Challenge the student's main idea without attacking every possible layer
- Use basic vocabulary appropriate for ESL students
- Follow the duration-aware word target given later in the prompt
- Leave some strategic openings that the student can answer`,

  medium: `You are a COMPETENT debate opponent. Your rebuttals should:
- Present solid, well-structured arguments with clear clash
- Address the opponent's logic, not just their wording
- Do at least one layer of comparison or impact weighing
- Use intermediate academic vocabulary
- Follow the duration-aware word target given later in the prompt
- Challenge the student while remaining fair`,

  hard: `You are an EXPERT debate opponent (national championship level). Your rebuttals should:
- Present sophisticated, multi-layered clash
- Test assumptions, attack the mechanism, and compare impacts explicitly
- Reframe the judge's choice around comparative weighing
- Use precise, advanced but still spoken vocabulary
- Follow the duration-aware word target given later in the prompt
- Force the student to think deeply and defend their position rigorously`,
};

interface RebuttalUsageSummary {
  inputTokens?: number;
  outputTokens?: number;
  cacheHitTokens?: number;
  cacheMissTokens?: number;
  reasoningTokens?: number;
}

interface RebuttalGeneration {
  provider: AiProvider;
  modelName: string;
  text: string;
  usage?: RebuttalUsageSummary;
  latency: number;
  fallbackUsed: boolean;
  providerRequestIds?: string[];
}

function modeFromRoundLabel(roundLabel: string) {
  return roundLabel.toLowerCase().includes("closing") ? "closing" : "rebuttal";
}

function countWords(text: string) {
  return text.split(/\s+/).filter(Boolean).length;
}

function shouldRetryTruongTeenLength(params: {
  enabled: boolean;
  difficulty?: AiDifficulty;
  wordTarget: { label: string; min: number };
  rebuttal: string;
}) {
  if (!params.enabled) return false;
  if (params.difficulty !== "hard") return false;
  if (params.wordTarget.label !== "7-minute") return false;

  return countWords(params.rebuttal) < Math.max(720, params.wordTarget.min - 80);
}

function buildTruongTeenLengthRetryInstruction(wordTarget: {
  min: number;
  max: number;
}) {
  return `The previous JSON was structurally valid but too short for hard 7-minute Vietnamese mode.

Return an expanded replacement with the same JSON schema.
The "rebuttal" value must be ${wordTarget.min}-${wordTarget.max} Vietnamese words across 9-12 substantial spoken paragraphs.
Do not add Markdown headings inside the rebuttal.
Keep the same side and core stance, but add the missing depth: more mechanism attack inside each clash, clearer weighing, a short rebuild of your world, and a final crystallization.
Keep highlights as 3-5 exact quotes copied from the new rebuttal text.`;
}

interface DeepSeekRebuttalMessageParams {
  aiSide: string;
  topic: string;
  motionBriefContext: string;
  debateMemoryContext: string;
  difficultyInstructions: string;
  previousRounds?: { label: string; speaker: string; text: string }[];
  roundLabel: string;
  currentRoundNumber?: number;
  speechTimeSeconds?: number;
  wordTarget: { min: number; max: number; label: string };
  track: PracticeTrack;
  languageLabel: string;
  responseLanguageInstruction: string;
  userTranscript: string;
  roundInstructions: string;
  learnerContext: string;
  truongTeenPromptContext?: string;
  corpusContext?: string;
  evidenceHintContext?: string;
}

function buildDeepSeekRebuttalMessages(
  params: DeepSeekRebuttalMessageParams
): DeepSeekMessage[] {
  const messages: DeepSeekMessage[] = [
    {
      role: "system",
      content: `You are a debate AI playing an opponent in a Trường Teen-style practice debate.

Return ONLY valid JSON in this exact shape:
{
  "rebuttal": "the spoken rebuttal text only",
  "highlights": [
    {
      "type": "claim" | "evidence" | "impact" | "assumption",
      "quote": "an exact quote copied from the rebuttal text",
      "note": "short student-friendly reason this phrase matters"
    }
  ]
}

Rules:
- Do not judge the round.
- Do not coach the student directly.
- Highlight 3-5 exact quotes that appear verbatim in "rebuttal".
- Avoid literal translated idioms that sound unnatural in Vietnamese debate speech.`,
    },
    {
      role: "user",
      content: `## Static Debate Opponent Rules
Format: Trường Teen-style practice debate.
${params.difficultyInstructions}
${params.truongTeenPromptContext ?? ""}

## Practice Track
${params.track}

## Practice Language
${params.languageLabel}
${params.responseLanguageInstruction}`,
    },
    {
      role: "user",
      content: `## Dynamic Debate Setup
- AI side: ${params.aiSide}
- Motion: "${params.topic}"
${params.motionBriefContext}
${params.debateMemoryContext}
${params.corpusContext ?? ""}`,
    },
  ];

  params.previousRounds?.forEach((round) => {
    messages.push({
      role: round.speaker.toLowerCase().includes("ai") ? "assistant" : "user",
      content: `## Previous Round: ${round.label} (${round.speaker})
${round.text}`,
    });
  });

  messages.push({
    role: "user",
    content: `## Current Round: ${params.roundLabel}
${params.currentRoundNumber ? `Round number: ${params.currentRoundNumber}` : ""}
Opponent speech time setting: ${params.speechTimeSeconds ?? 180} seconds
Target length for your spoken response: ${params.wordTarget.min}-${params.wordTarget.max} words for a ${params.wordTarget.label} speech format

## Opponent's Latest Speech
"""
${params.userTranscript}
"""
${params.evidenceHintContext ?? ""}

## Your Task
Write a ${params.roundLabel.toLowerCase()} responding to the opponent's speech. This is a spoken debate, so write in a natural speaking style — conversational but academically sharp.

${params.roundInstructions}

Rules:
- Directly address and counter specific points from the opponent's speech
- Structure your logic around: argument label -> explanation or mechanism -> comparison or weighing -> impact -> link back to your side
- Prioritize depth over fancy wording
- Maintain your side (${params.aiSide}) and policy/model consistently across the whole debate
- Do not shift from a full ban/model to a partial ban/model, or vice versa, unless the Motion Definition explicitly defines that exception
- Review the previous rounds and Debate Memory before answering so you do not drop your own claims, contradict earlier concessions, or ignore active clashes
- Make the response proportional to the opponent's allocated speaking time; longer speeches need fuller engagement with mechanisms, examples, impacts, and weighing
- Be respectful but firm
- ${params.learnerContext}`,
  });

  return messages;
}

function getDeepSeekRebuttalPromptPrefixHash(messages: DeepSeekMessage[]) {
  return createHash("sha256")
    .update(`${messages[0]?.content ?? ""}\n\n${messages[1]?.content ?? ""}`)
    .digest("hex");
}

async function generateGeminiRebuttal(
  prompt: string,
  maxOutputTokens: number,
  timeoutMs: number,
  fallbackUsed = false
): Promise<RebuttalGeneration> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.7,
      maxOutputTokens,
    },
  });
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error("TIMEOUT")), timeoutMs);
  });

  const startTime = Date.now();
  let result;
  try {
    result = await Promise.race([
      model.generateContent(prompt),
      timeoutPromise,
    ]);
  } catch (error) {
    await recordAiProviderRequest({
      provider: "google",
      model: modelName,
      status: "error",
      sourceRoute: "/api/rebuttal",
      outputType: "rebuttal",
      latencyMs: Date.now() - startTime,
      errorCode: error instanceof Error && error.message === "TIMEOUT"
        ? "TIMEOUT"
        : "GEMINI_REBUTTAL_FAILED",
      errorMessage: error instanceof Error ? error.message : String(error),
      metadata: {
        maxOutputTokens,
        timeoutMs,
        fallbackUsed,
      },
    });
    throw error;
  }
  const latency = Date.now() - startTime;
  const usage = result.response.usageMetadata;
  const providerRequestId = await recordAiProviderRequest({
    provider: "google",
    model: modelName,
    status: "success",
    sourceRoute: "/api/rebuttal",
    outputType: "rebuttal",
    latencyMs: latency,
    usage: {
      inputTokens: usage?.promptTokenCount,
      outputTokens: usage?.candidatesTokenCount,
      totalTokens: usage?.totalTokenCount,
    },
    metadata: {
      maxOutputTokens,
      timeoutMs,
      fallbackUsed,
    },
  });

  return {
    provider: "gemini",
    modelName,
    text: result.response.text().trim(),
    usage: {
      inputTokens: usage?.promptTokenCount,
      outputTokens: usage?.candidatesTokenCount,
    },
    latency,
    fallbackUsed,
    providerRequestIds: providerRequestId ? [providerRequestId] : [],
  };
}

async function generateDeepSeekRebuttal(
  messages: DeepSeekMessage[],
  maxOutputTokens: number,
  timeoutMs: number,
  userId: string
): Promise<RebuttalGeneration> {
  const startTime = Date.now();
  const result = await createDeepSeekChatCompletion({
    messages,
    thinking: { type: "disabled" },
    responseFormat: "json_object",
    maxTokens: maxOutputTokens,
    temperature: 0.7,
    timeoutMs,
    userId,
    sourceRoute: "/api/rebuttal",
    outputType: "rebuttal",
    metadata: {
      maxOutputTokens,
      timeoutMs,
    },
  });
  const latency = Date.now() - startTime;
  const usage: DeepSeekUsage | undefined = result.usage;

  return {
    provider: "deepseek",
    modelName: result.model,
    text: result.content,
    usage: {
      inputTokens: usage?.prompt_tokens,
      outputTokens: usage?.completion_tokens,
      cacheHitTokens: usage?.prompt_cache_hit_tokens,
      cacheMissTokens: usage?.prompt_cache_miss_tokens,
      reasoningTokens: usage?.completion_tokens_details?.reasoning_tokens,
    },
    latency,
    fallbackUsed: false,
    providerRequestIds: result.providerRequestId ? [result.providerRequestId] : [],
  };
}

export async function POST(req: NextRequest) {
  let recordGenerationError: ((error: unknown) => Promise<void>) | null = null;
  let corpusRagMetadata: Record<string, unknown> = {};

  try {
    const auth = await requireRequestAuth(req);

    if (!auth.ok) {
      return auth.errorResponse;
    }

    const { supabase, user: authUser } = auth;
    if (shouldConsumeUserRateLimit(auth)) {
      const rateLimit = await consumeRateLimit(supabase, {
        scope: "rebuttal",
        limit: 10,
        windowSeconds: 60,
      });
      if (!rateLimit.success) {
        return NextResponse.json(
          { error: "Too many requests. Please wait a moment." },
          {
            status: 429,
            headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
          }
        );
      }
    }

    const requestedProvider = getRebuttalProvider();
    const hasConfiguredProvider =
      requestedProvider === "deepseek"
        ? Boolean(process.env.DEEPSEEK_API_KEY || process.env.GEMINI_API_KEY)
        : Boolean(process.env.GEMINI_API_KEY);

    if (!hasConfiguredProvider) {
      return NextResponse.json(
        { error: "API key not configured." },
        { status: 500 }
      );
    }

    const body = parseRebuttalRequest(
      await readJsonObject(req, { maxBytes: 160 * 1024 })
    );
    const {
      topic,
      side,
      userTranscript,
      roundLabel,
      difficulty,
      practiceTrack,
      practiceLanguage,
      previousRounds,
      speechTimeSeconds,
      currentRoundNumber,
      motionBrief,
      debateMemory,
    } = body;

    if (!topic || !userTranscript || !roundLabel) {
      return NextResponse.json(
        { error: "Missing required fields." },
        { status: 400 }
      );
    }

    const memoryAiSide =
      debateMemory?.aiSide ?? (side === "proposition" ? "opposition" : "proposition");
    const aiSide =
      memoryAiSide === "proposition"
        ? "Proposition (FOR)"
        : "Opposition (AGAINST)";
    const difficultyInstructions = difficultyPrompts[difficulty || "medium"];
    const track = practiceTrack || "debate";
    const languageConfig = getPracticeLanguageConfig(practiceLanguage);
    const useTruongTeenPrompt = shouldUseTruongTeenPrompt({
      practiceLanguage,
      practiceTrack: track,
    });
    const wordTarget = getTruongTeenWordTarget({
      enabled: useTruongTeenPrompt,
      difficulty,
      target: getRebuttalWordTarget(speechTimeSeconds, roundLabel),
    });
    const debateFormat = modeFromRoundLabel(roundLabel);
    const requestStartedAt = Date.now();
    recordGenerationError = async (error: unknown) => {
      if (auth.authSource === "dev-bypass") return;
      const message = error instanceof Error ? error.message : String(error);
      await recordAiQualityRun(tryCreateAdminClient() ?? supabase, {
        userId: authUser.id,
        outputType: "rebuttal",
        status: "error",
        sourceRoute: "/api/rebuttal",
        provider: getProviderLabel(requestedProvider),
        requestedProvider,
        model: getProviderModelName(requestedProvider),
        practiceTrack: track,
        practiceLanguage,
        difficulty,
        debateFormat,
        side,
        aiSide: memoryAiSide,
        topicTitle: topic,
        latencyMs: Date.now() - requestStartedAt,
        errorCode: message === "TIMEOUT" ? "TIMEOUT" : "REBUTTAL_FAILED",
        errorMessage: message,
        inputPreview: userTranscript,
        metadata: {
          roundLabel,
          currentRoundNumber,
          speechTimeSeconds,
          wordTarget,
          ...corpusRagMetadata,
          truongTeenPromptVersion: useTruongTeenPrompt
            ? TRUONG_TEEN_PROMPT_VERSION
            : undefined,
        },
      });
    };
    const maxOutputTokens = getRebuttalMaxOutputTokens(wordTarget);
    const timeoutMs =
      wordTarget.max >= 1000 ? 55000 : wordTarget.max >= 800 ? 45000 : 30000;
    const motionBriefContext = motionBrief
      ? `\n${formatMotionBriefForPrompt(motionBrief)}`
      : "";
    const debateMemoryContext = formatDebateMemoryForPrompt(
      debateMemory,
      motionBrief
    );
    const responseLanguageInstruction =
      practiceLanguage === "vi"
        ? "Write the rebuttal and highlight notes in Vietnamese. Preserve Vietnamese diacritics and use natural spoken Vietnamese debate language."
        : "Write the rebuttal and highlight notes in English for students practicing English debate.";
    const learnerContext =
      practiceLanguage === "vi"
        ? "This is for Vietnamese high school students practicing debate in Vietnamese, so be a challenging but fair practice partner."
        : "This is for Vietnamese high school students practicing debate in English, so be a challenging but fair practice partner.";
    const transcriptCorpus = [
      userTranscript,
      ...(previousRounds?.map((round) => round.text) ?? []),
    ];
    const truongTeenPromptContext = useTruongTeenPrompt
      ? buildTruongTeenRebuttalPromptAddendum({ difficulty, wordTarget })
      : "";
    const evidenceHintContext = useTruongTeenPrompt
      ? buildFuzzyEvidenceHintBlock(transcriptCorpus)
      : "";
    const adminClient = tryCreateAdminClient();
    const corpusRetrieval = await retrieveDebateCorpusContext({
      purpose: "rebuttal",
      practiceLanguage,
      practiceTrack: track,
      topic,
      side,
      transcript: userTranscript,
      roundsText: previousRounds?.map((round) => round.text),
      userId: auth.authSource === "dev-bypass" ? null : authUser.id,
      sourceRoute: "/api/rebuttal",
      supabase: adminClient ?? undefined,
    });
    corpusRagMetadata = createDebateCorpusRetrievalMetadata(corpusRetrieval);

    let contextSection = "";
    if (previousRounds && previousRounds.length > 0) {
      contextSection = "\n## Previous Rounds\n" +
        previousRounds
          .map((r) => `### ${r.label} (${r.speaker})\n${r.text}`)
          .join("\n\n");
    }

    const roundInstructions =
      roundLabel.toLowerCase().includes("closing")
        ? `This is a closing speech. Summarize the winning comparative framing, explain why your side wins on the key weighing, and crystallize the most important impacts. Do not just repeat earlier claims.`
        : `This is a rebuttal speech. Directly answer the opponent's main claims by exposing weak assumptions, breaking their mechanism, comparing worlds, and weighing impacts.`;

    const prompt = `You are a debate AI playing the ${aiSide} side in a Trường Teen-style debate.

## Topic/Motion
"${topic}"
${motionBriefContext}
${debateMemoryContext}

${difficultyInstructions}
${truongTeenPromptContext}
${corpusRetrieval.contextBlock}
${contextSection}

## Current Round: ${roundLabel}
${currentRoundNumber ? `Round number: ${currentRoundNumber}` : ""}
Opponent speech time setting: ${speechTimeSeconds ?? 180} seconds
Target length for your spoken response: ${wordTarget.min}-${wordTarget.max} words for a ${wordTarget.label} speech format
## Practice Track
${track}

## Practice Language
${languageConfig.label}
${responseLanguageInstruction}

## Opponent's Latest Speech
"""
${userTranscript}
"""
${evidenceHintContext}

## Your Task
Write a ${roundLabel.toLowerCase()} responding to the opponent's speech. This is a spoken debate, so write in a natural speaking style — conversational but academically sharp.

${roundInstructions}

Rules:
- Directly address and counter specific points from the opponent's speech
- Structure your logic around: argument label -> explanation or mechanism -> comparison or weighing -> impact -> link back to your side
- Prioritize depth over fancy wording
- Maintain your side (${aiSide}) and policy/model consistently across the whole debate
- Do not shift from a full ban/model to a partial ban/model, or vice versa, unless the Motion Definition explicitly defines that exception
- Review the previous rounds and Debate Memory before answering so you do not drop your own claims, contradict earlier concessions, or ignore active clashes
- Make the response proportional to the opponent's allocated speaking time; longer speeches need fuller engagement with mechanisms, examples, impacts, and weighing
- Be respectful but firm
- ${learnerContext}

Return ONLY valid JSON in this exact shape:
{
  "rebuttal": "the spoken rebuttal text only",
  "highlights": [
    {
      "type": "claim" | "evidence" | "impact" | "assumption",
      "quote": "an exact quote copied from the rebuttal text",
      "note": "short student-friendly reason this phrase matters"
    }
  ]
}

Highlight 3-5 exact quotes that a student should notice. Use only quote strings that appear verbatim in "rebuttal".`;

    const deepSeekMessages = buildDeepSeekRebuttalMessages({
      aiSide,
      topic,
      motionBriefContext,
      debateMemoryContext,
      difficultyInstructions,
      previousRounds,
      roundLabel,
      currentRoundNumber,
      speechTimeSeconds,
      wordTarget,
      track,
      languageLabel: languageConfig.label,
      responseLanguageInstruction,
      userTranscript,
      roundInstructions,
      learnerContext,
      truongTeenPromptContext,
      corpusContext: corpusRetrieval.contextBlock,
      evidenceHintContext,
    });
    const deepSeekPromptPrefixHash =
      getDeepSeekRebuttalPromptPrefixHash(deepSeekMessages);

    let generation: RebuttalGeneration;
    if (requestedProvider === "deepseek" && process.env.DEEPSEEK_API_KEY) {
      try {
        generation = await generateDeepSeekRebuttal(
          deepSeekMessages,
          maxOutputTokens,
          timeoutMs,
          authUser.id
        );
      } catch (error) {
        if (process.env.NODE_ENV === "development") {
          console.warn(
            "DeepSeek rebuttal failed; falling back to Gemini:",
            error instanceof Error ? error.message : error
          );
        }
        generation = await generateGeminiRebuttal(
          prompt,
          maxOutputTokens,
          timeoutMs,
          true
        );
      }
    } else {
      generation = await generateGeminiRebuttal(prompt, maxOutputTokens, timeoutMs);
    }

    let structuredResponse = normalizeStructuredRebuttalResponse(generation.text);
    let truongTeenLengthRetryUsed = false;
    if (
      shouldRetryTruongTeenLength({
        enabled: useTruongTeenPrompt,
        difficulty,
        wordTarget,
        rebuttal: structuredResponse.rebuttal,
      })
    ) {
      const retryInstruction = buildTruongTeenLengthRetryInstruction(wordTarget);
      try {
        const retryGeneration =
          generation.provider === "deepseek" && process.env.DEEPSEEK_API_KEY
            ? await generateDeepSeekRebuttal(
                [
                  ...deepSeekMessages,
                  { role: "assistant", content: generation.text },
                  { role: "user", content: retryInstruction },
                ],
                maxOutputTokens,
                timeoutMs,
                authUser.id
              )
            : await generateGeminiRebuttal(
                `${prompt}\n\n${retryInstruction}`,
                maxOutputTokens,
                timeoutMs,
                generation.fallbackUsed
              );
        generation = {
          ...retryGeneration,
          fallbackUsed: generation.fallbackUsed || retryGeneration.fallbackUsed,
          providerRequestIds: [
            ...(generation.providerRequestIds ?? []),
            ...(retryGeneration.providerRequestIds ?? []),
          ],
        };
        structuredResponse = normalizeStructuredRebuttalResponse(generation.text);
        truongTeenLengthRetryUsed = true;
      } catch (error) {
        if (process.env.NODE_ENV === "development") {
          console.warn(
            "Trường Teen length retry failed; keeping first rebuttal:",
            error instanceof Error ? error.message : error
          );
        }
      }
    }
    const aiQualityRunId =
      auth.authSource === "dev-bypass"
        ? null
        : await recordAiQualityRun(tryCreateAdminClient() ?? supabase, {
            userId: authUser.id,
            outputType: "rebuttal",
            sourceRoute: "/api/rebuttal",
            provider: getProviderLabel(generation.provider),
            requestedProvider,
            model: generation.modelName || getProviderModelName(generation.provider),
            practiceTrack: track,
            practiceLanguage,
            difficulty,
            debateFormat,
            side,
            aiSide: memoryAiSide,
            topicTitle: topic,
            latencyMs: generation.latency,
            usage: {
              inputTokens: generation.usage?.inputTokens,
              outputTokens: generation.usage?.outputTokens,
              cacheHitTokens: generation.usage?.cacheHitTokens,
              cacheMissTokens: generation.usage?.cacheMissTokens,
              reasoningTokens: generation.usage?.reasoningTokens,
            },
            providerRequestIds: generation.providerRequestIds,
            fallbackUsed: generation.fallbackUsed,
            outputText: structuredResponse.rebuttal,
            inputPreview: userTranscript,
            metadata: {
              roundLabel,
              currentRoundNumber,
              speechTimeSeconds,
              highlightCount: structuredResponse.highlights.length,
              wordTarget,
              truongTeenLengthRetryUsed,
              deepSeekPromptPrefixHash:
                generation.provider === "deepseek"
                  ? deepSeekPromptPrefixHash
                  : undefined,
              ...corpusRagMetadata,
              truongTeenPromptVersion: useTruongTeenPrompt
                ? TRUONG_TEEN_PROMPT_VERSION
                : undefined,
            },
          });
    await linkDebateCorpusRetrievalLogToAiRun(
      corpusRetrieval.logId,
      aiQualityRunId,
      adminClient ?? undefined
    );

    getPostHogServer().capture({
      distinctId: authUser.id,
      event: "$ai_generation",
      properties: {
        $ai_provider: getProviderLabel(generation.provider),
        $ai_model: generation.modelName || getProviderModelName(generation.provider),
        $ai_input_tokens: generation.usage?.inputTokens,
        $ai_output_tokens: generation.usage?.outputTokens,
        $ai_cache_hit_tokens: generation.usage?.cacheHitTokens,
        $ai_cache_miss_tokens: generation.usage?.cacheMissTokens,
        $ai_reasoning_tokens: generation.usage?.reasoningTokens,
        $ai_latency: generation.latency,
        $ai_is_error: false,
        $ai_trace_id: crypto.randomUUID(),
        $ai_fallback_used: generation.fallbackUsed,
        $ai_requested_provider: requestedProvider,
        route: "/api/rebuttal",
        speech_time_seconds: speechTimeSeconds,
        rebuttal_word_target_min: wordTarget.min,
        rebuttal_word_target_max: wordTarget.max,
        corpus_rag_enabled: corpusRetrieval.enabled,
        retrieved_corpus_count: corpusRetrieval.items.length,
        candidate_corpus_count: corpusRetrieval.candidateItems.length,
        corpus_rag_skipped_reason: corpusRetrieval.skippedReason,
        corpus_rag_top_similarity: corpusRetrieval.topSimilarity,
        corpus_rag_relevance_gate_passed: corpusRetrieval.relevanceGatePassed,
        truong_teen_prompt_version: useTruongTeenPrompt
          ? TRUONG_TEEN_PROMPT_VERSION
          : undefined,
      },
    });

    return NextResponse.json({
      ...structuredResponse,
      _aiRunId: aiQualityRunId,
      _provider: getProviderLabel(generation.provider),
      _model: generation.modelName || getProviderModelName(generation.provider),
      _latencyMs: generation.latency,
    });
  } catch (err) {
    if (err instanceof RequestValidationError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    await recordGenerationError?.(err).catch(() => {});
    if (process.env.NODE_ENV === 'development') console.error("Rebuttal API error:", err);

    if (err instanceof Error) {
      if (err.message === "TIMEOUT") {
        return NextResponse.json(
          { error: "AI response timed out. Please try again." },
          { status: 504 }
        );
      }
      if (err.message.includes("429") || err.message.includes("rate")) {
        return NextResponse.json(
          { error: "Rate limit reached. Please wait and try again." },
          { status: 429 }
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to generate AI rebuttal." },
      { status: 500 }
    );
  }
}
