import { z } from "zod";
import { normalizeDebateDuelClashLinks } from "@/lib/debate-duels/clash-links";
import { buildDuelJudgmentMessages } from "@/lib/prompts";
import type { AiQualityTelemetry } from "@/lib/ai/quality-model";
import type { DebateDuelJudgment, PracticeLanguage } from "@/types";
import { generateStructured } from "./execute";

type DuelJudgeParams = {
  motion: string;
  topicCategory: string;
  practiceLanguage?: PracticeLanguage;
  participants: {
    proposition: { participantId: string | null; displayName: string };
    opposition: { participantId: string | null; displayName: string };
  };
  speeches: Array<{
    id: string;
    roundNumber: number;
    speechType: "opening" | "rebuttal";
    side: "proposition" | "opposition";
    label: string;
    transcript: string;
    durationSeconds: number;
    qualityFlags?: string[];
  }>;
};

const criterionSchema = z.object({
  winnerSide: z.enum(["proposition", "opposition", "tie"]),
  reason: z.string().min(1),
});
const feedbackSchema = z.object({
  strengths: z.array(z.string()),
  improvements: z.array(z.string()),
  summary: z.string().min(1),
});
const DuelJudgmentSchema = z.object({
  winnerSide: z.enum(["proposition", "opposition"]),
  winnerParticipantId: z.string().nullable().optional(),
  confidence: z.number().min(0).max(1),
  decisionSummary: z.string().min(1),
  comparativeBallot: z.object({
    caseQuality: criterionSchema,
    logic: criterionSchema,
    rebuttal: criterionSchema,
    weighing: criterionSchema,
    evidence: criterionSchema,
    delivery: criterionSchema,
  }),
  participantFeedback: z.object({
    proposition: feedbackSchema,
    opposition: feedbackSchema,
  }),
  roundBreakdown: z.array(z.object({
    roundNumber: z.number().int().positive(),
    label: z.string().min(1),
    winnerSide: z.enum(["proposition", "opposition", "tie"]),
    reason: z.string().min(1),
  })),
  clashLinks: z.array(z.object({
    id: z.string().min(1),
    sourceSpeechId: z.string().min(1),
    responseSpeechId: z.string().nullable(),
    sourceQuote: z.string().min(1),
    responseQuote: z.string().nullable(),
    outcome: z.enum(["answered", "dropped", "misanswered", "turned", "weighed"]),
    judgeRead: z.string().min(1),
    suggestion: z.string().min(1),
    tag: z.enum(["clash", "rebuttal", "weighing", "logic", "evidence"]),
  })).optional(),
  summary: z.string().min(1),
  qualityWarnings: z.array(z.string()),
}).passthrough();

function assertJudgmentReferences(
  judgment: z.infer<typeof DuelJudgmentSchema>,
  params: DuelJudgeParams,
) {
  const expectedWinner = params.participants[judgment.winnerSide].participantId;
  if (judgment.winnerParticipantId && judgment.winnerParticipantId !== expectedWinner) {
    throw new Error("Duel judgment winner does not match the winning side");
  }
  const speeches = new Map(params.speeches.map((speech) => [speech.id, speech.transcript]));
  const validRounds = new Set(params.speeches.map((speech) => speech.roundNumber));
  const seenRounds = new Set<number>();
  for (const round of judgment.roundBreakdown) {
    if (!validRounds.has(round.roundNumber) || seenRounds.has(round.roundNumber)) {
      throw new Error("Duel judgment referenced an invalid or duplicate round");
    }
    seenRounds.add(round.roundNumber);
  }
  for (const link of judgment.clashLinks ?? []) {
    const source = speeches.get(link.sourceSpeechId);
    const response = link.responseSpeechId ? speeches.get(link.responseSpeechId) : null;
    if (!source || (link.responseSpeechId && !response)) {
      throw new Error("Duel judgment referenced an unknown speech");
    }
    if (!source.includes(link.sourceQuote)) {
      throw new Error("Duel judgment contained an inexact source quote");
    }
    if (link.responseQuote !== null && !response?.includes(link.responseQuote)) {
      throw new Error("Duel judgment contained an inexact response quote");
    }
  }
}

/** Central durable-quality duel judge, retaining the prompt and post-processing contract. */
export async function judgeDebateDuel(
  params: DuelJudgeParams,
  userId?: string,
  onTelemetry?: (telemetry: AiQualityTelemetry) => void | Promise<void>,
): Promise<DebateDuelJudgment> {
  const messages = buildDuelJudgmentMessages(params);
  const result = await generateStructured({
    task: "duel_judging",
    prompt: messages.user,
    messages: [
      { role: "system", content: messages.system },
      { role: "user", content: messages.user },
    ],
    schema: DuelJudgmentSchema,
    context: {
      task: "duel_judging",
      sourceRoute: "/api/debate-duels/judge",
      outputType: "duel_judging",
      userId,
      metadata: {
        speechCount: params.speeches.length,
        practiceLanguage: params.practiceLanguage ?? null,
      },
    },
  });
  assertJudgmentReferences(result.output, params);
  const judgment = result.output as unknown as DebateDuelJudgment;
  judgment.winnerParticipantId ??=
    judgment.winnerSide === "proposition"
      ? params.participants.proposition.participantId
      : params.participants.opposition.participantId;
  // Provider identity and timestamps are server-owned evidence. Never trust
  // model-authored fields for persistence or analytics.
  judgment.model = result.model;
  judgment.judgedAt = new Date().toISOString();
  judgment.qualityWarnings ??= [];
  judgment.roundBreakdown ??= [];
  judgment.clashLinks = normalizeDebateDuelClashLinks(judgment.clashLinks);
  await onTelemetry?.({
    provider: result.provider === "gemini" ? "google" : result.provider,
    requestedProvider: "groq",
    model: result.model,
    latencyMs: result.latencyMs,
    usage: result.usage,
    providerRequestIds: result.providerRequestIds,
    fallbackUsed: result.fallbackUsed,
    metadata: { traceId: result.traceId, judgePipeline: "core_structured" },
  });
  return judgment;
}
