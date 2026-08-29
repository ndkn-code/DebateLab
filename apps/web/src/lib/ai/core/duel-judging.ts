import { z } from "zod";
import { normalizeDebateDuelClashLinks } from "@/lib/debate-duels/clash-links";
import { buildDuelJudgmentPrompt } from "@/lib/prompts";
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

const DuelJudgmentSchema = z.object({
  winnerSide: z.enum(["proposition", "opposition"]),
  comparativeBallot: z.string().min(1),
  participantFeedback: z.unknown(),
}).passthrough();

/** Central durable-quality duel judge, retaining the prompt and post-processing contract. */
export async function judgeDebateDuel(
  params: DuelJudgeParams,
  userId?: string,
  onTelemetry?: (telemetry: AiQualityTelemetry) => void | Promise<void>,
): Promise<DebateDuelJudgment> {
  const result = await generateStructured({
    task: "duel_judging",
    prompt: buildDuelJudgmentPrompt(params),
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
  const judgment = result.output as unknown as DebateDuelJudgment;
  judgment.winnerParticipantId ??=
    judgment.winnerSide === "proposition"
      ? params.participants.proposition.participantId
      : params.participants.opposition.participantId;
  judgment.model ||= result.model;
  judgment.judgedAt ||= new Date().toISOString();
  judgment.qualityWarnings ??= [];
  judgment.roundBreakdown ??= [];
  judgment.clashLinks = normalizeDebateDuelClashLinks(judgment.clashLinks);
  await onTelemetry?.({
    provider: result.provider === "gemini" ? "google" : result.provider,
    requestedProvider:
      process.env.DEBATE_DUEL_JUDGE_PROVIDER === "deepseek" ? "deepseek" : "google",
    model: result.model,
    latencyMs: result.latencyMs,
    usage: result.usage,
    providerRequestIds: result.providerRequestIds,
    fallbackUsed: result.fallbackUsed,
    metadata: { traceId: result.traceId, judgePipeline: "core_structured" },
  });
  return judgment;
}
