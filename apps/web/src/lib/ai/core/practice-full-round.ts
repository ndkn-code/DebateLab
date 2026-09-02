import { z } from "zod";

import { getDebateFeedbackDepthTarget } from "@/lib/feedback/depth";
import { normalizeRebuttalText } from "@/lib/rebuttal/structured-response";
import type { DebateRound, PracticeLanguage, PracticeTrack } from "@/types";

export const DURABLE_PRACTICE_ANALYSIS_SOURCE_ROUTE =
  "gcp:ai-grading-worker/practice-analysis" as const;

export interface PracticeFullRoundSelectionInput {
  practiceTrack?: PracticeTrack;
  isFullRound?: boolean;
  rounds?: DebateRound[];
  providerAudit?: { sourceRoute?: string };
}

export function shouldUsePracticeFullRoundCompoundJudgment(
  input: PracticeFullRoundSelectionInput,
  environment: Record<string, string | undefined> = process.env as Record<
    string,
    string | undefined
  >,
): boolean {
  return (
    environment.PRACTICE_FULL_ROUND_CORE_STAGED_ENABLED !== "false" &&
    input.providerAudit?.sourceRoute ===
      DURABLE_PRACTICE_ANALYSIS_SOURCE_ROUTE &&
    input.practiceTrack === "debate" &&
    input.isFullRound === true &&
    (input.rounds?.length ?? 0) >= 2
  );
}

type SchemaInput = PracticeFullRoundSelectionInput & {
  topic: string;
  transcript: string;
  practiceLanguage?: PracticeLanguage;
  actualDuration?: number;
};

const nonempty = z.string().trim().min(1);
const speakerSchema = z.enum(["user", "ai"]);
const annotationTagSchema = z.enum([
  "stance",
  "clarity",
  "mechanism",
  "evidence",
  "logic",
  "rebuttal",
  "clash",
  "weighing",
  "impact",
  "structure",
  "delivery",
]);
const clashTagSchema = z.enum([
  "clash",
  "rebuttal",
  "weighing",
  "logic",
  "evidence",
]);

const categoryRationaleSchema = z.object({
  score: z.number().finite().min(0),
  maxScore: z.number().finite().positive(),
  rationale: nonempty,
  whyNotHigher: nonempty,
  nextStep: nonempty,
});

const argumentBreakdownSchema = z.object({
  name: nonempty,
  summary: nonempty,
  whatWorked: nonempty,
  missingLayer: nonempty,
  betterVersion: nonempty,
});

const transcriptAnnotationSchema = z.object({
  quote: nonempty,
  roundNumber: z.number().int().positive(),
  speaker: speakerSchema,
  tag: annotationTagSchema,
  severity: z.enum(["strength", "improvement", "warning"]),
  feedback: nonempty,
  suggestion: nonempty,
});

const clashLinkSchema = z
  .object({
    id: nonempty,
    sourceRoundNumber: z.number().int().positive(),
    sourceSpeaker: speakerSchema,
    responseRoundNumber: z.number().int().positive().nullable(),
    responseSpeaker: speakerSchema.nullable(),
    sourceQuote: nonempty,
    responseQuote: nonempty.nullable(),
    outcome: z.enum([
      "answered",
      "dropped",
      "misanswered",
      "turned",
      "weighed",
    ]),
    judgeRead: nonempty,
    suggestion: nonempty,
    tag: clashTagSchema,
  })
  .superRefine((link, context) => {
    const responseParts = [
      link.responseRoundNumber !== null,
      link.responseSpeaker !== null,
      link.responseQuote !== null,
    ];
    if (responseParts.some(Boolean) && !responseParts.every(Boolean)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["responseQuote"],
        message:
          "A clash response quote and its round/speaker identity must appear together",
      });
    }
    if (link.outcome === "dropped" && responseParts.some(Boolean)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["responseQuote"],
        message: "A dropped clash cannot claim a response",
      });
    }
    if (link.outcome !== "dropped" && !responseParts.every(Boolean)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["responseQuote"],
        message: "A resolved clash outcome requires an anchored response",
      });
    }
  });

const debateFeedbackBaseSchema = z
  .object({
    content: z.object({
      score: z.number().finite().min(0).max(40),
      claimClarity: z.number().finite().min(0).max(10),
      evidenceSupport: z.number().finite().min(0).max(10),
      logicCoherence: z.number().finite().min(0).max(10),
      counterArgument: z.number().finite().min(0).max(10),
    }),
    structure: z.object({
      score: z.number().finite().min(0).max(25),
      introduction: z.number().finite().min(0).max(8),
      bodyOrganization: z.number().finite().min(0).max(9),
      conclusion: z.number().finite().min(0).max(8),
    }),
    language: z.object({
      score: z.number().finite().min(0).max(25),
      vocabulary: z.number().finite().min(0).max(8),
      grammar: z.number().finite().min(0).max(9),
      fluency: z.number().finite().min(0).max(9),
    }),
    persuasion: z.object({
      score: z.number().finite().min(0).max(10),
      audienceAwareness: z.number().finite().min(0).max(5),
      impactfulness: z.number().finite().min(0).max(5),
    }),
    totalScore: z.number().finite().min(0).max(100),
    overallBand: z.enum([
      "Novice",
      "Developing",
      "Competent",
      "Proficient",
      "Expert",
    ]),
    summary: nonempty,
    strengths: z.array(nonempty).min(1),
    improvements: z.array(nonempty).min(1),
    sampleArguments: z.array(nonempty).min(1),
    detailedFeedback: z.object({
      contentFeedback: nonempty,
      structureFeedback: nonempty,
      languageFeedback: nonempty,
      persuasionFeedback: nonempty,
    }),
    debateVerdict: z.object({
      winner: z.enum(["user", "ai", "tie"]),
      confidence: z.number().finite().min(0).max(1),
      summary: nonempty,
      decidingReasons: z.array(nonempty).min(1),
      nextMove: nonempty,
    }),
    scoreRationale: z.object({
      overall: nonempty,
      content: categoryRationaleSchema,
      structure: categoryRationaleSchema,
      language: categoryRationaleSchema,
      persuasion: categoryRationaleSchema,
    }),
  })
  .passthrough();

function declaredRoundText(round: DebateRound): string {
  return round.type === "user-speech"
    ? (round.transcript ?? "")
    : normalizeRebuttalText(round.aiResponse ?? "");
}

function declaredRoundSpeaker(round: DebateRound): "user" | "ai" {
  return round.type === "user-speech" ? "user" : "ai";
}

function comparable(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function lowSignalAnchor(quote: string, topic: string): boolean {
  const normalized = comparable(quote);
  const words = normalized.match(/[\p{L}\p{N}]+/gu) ?? [];
  const normalizedTopic = comparable(topic);
  if (quote.trim().length < 12 || words.length < 3) return true;
  if (
    normalizedTopic &&
    (normalized === normalizedTopic || normalizedTopic.includes(normalized))
  ) {
    return true;
  }
  return /^(hello|hi everyone|good (morning|afternoon|evening)|thank you|today i|i think that|this house|the motion|xin chào|chào mọi người|kính thưa|cảm ơn|tôi nghĩ rằng|kiến nghị)/iu.test(
    normalized,
  );
}

function validateQuote(params: {
  quote: string;
  roundNumber: number;
  speaker: "user" | "ai";
  input: SchemaInput;
}): string | null {
  const round = params.input.rounds?.find(
    (candidate) =>
      candidate.roundNumber === params.roundNumber &&
      declaredRoundSpeaker(candidate) === params.speaker,
  );
  if (!round) return "Quote round/speaker is not declared in the input debate";
  if (lowSignalAnchor(params.quote, params.input.topic)) {
    return "Quote is a low-signal greeting, motion title, filler, or generic opening";
  }
  if (!declaredRoundText(round).includes(params.quote)) {
    return "Quote is not an exact contiguous excerpt from the declared round/speaker";
  }
  return null;
}

export function createPracticeFullRoundCompoundSchema(input: SchemaInput) {
  const target = getDebateFeedbackDepthTarget({
    isFullRound: true,
    actualDuration: input.actualDuration,
    roundCount: input.rounds?.length,
  });
  const schema = z
    .object({
      speechMap: z.object({
        speechMap: z
          .array(
            z.object({
              roundNumber: z.number().int().positive(),
              label: nonempty,
              speaker: speakerSchema,
              mainClaims: z.array(nonempty).min(1),
              responses: z.array(nonempty),
              evidence: z.array(nonempty),
              strategicNotes: nonempty,
            }),
          )
          .min(1),
        macroClashes: z
          .array(
            z.object({
              id: nonempty,
              name: nonempty,
              studentPosition: nonempty,
              aiPosition: nonempty,
              judgeRead: nonempty,
              studentMissingResponse: z.string(),
            }),
          )
          .min(1),
        judgingFocus: z.array(nonempty).min(1),
      }),
      feedback: debateFeedbackBaseSchema.extend({
        argumentBreakdowns: z
          .array(argumentBreakdownSchema)
          .min(target.minArgumentBreakdowns)
          .max(target.maxArgumentBreakdowns),
        transcriptAnnotations: z
          .array(transcriptAnnotationSchema)
          .min(target.minAnnotations)
          .max(target.maxAnnotations),
        clashLinks: z
          .array(clashLinkSchema)
          .min(target.minClashLinks)
          .max(target.maxClashLinks),
      }),
    })
    .superRefine((compound, context) => {
      const declaredRounds = new Set(
        (input.rounds ?? []).map(
          (round) => `${round.roundNumber}:${declaredRoundSpeaker(round)}`,
        ),
      );
      const mappedRounds = new Set<string>();
      compound.speechMap.speechMap.forEach((speech, index) => {
        const identity = `${speech.roundNumber}:${speech.speaker}`;
        if (!declaredRounds.has(identity) || mappedRounds.has(identity)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["speechMap", "speechMap", index],
            message:
              "Speech map round/speaker must uniquely match the declared debate",
          });
        }
        mappedRounds.add(identity);
      });
      if (
        mappedRounds.size !== declaredRounds.size ||
        [...declaredRounds].some((identity) => !mappedRounds.has(identity))
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["speechMap", "speechMap"],
          message: "Speech map must cover every declared debate round",
        });
      }

      compound.feedback.transcriptAnnotations.forEach((annotation, index) => {
        const error = validateQuote({
          quote: annotation.quote,
          roundNumber: annotation.roundNumber,
          speaker: annotation.speaker,
          input,
        });
        if (error) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["feedback", "transcriptAnnotations", index, "quote"],
            message: error,
          });
        }
      });

      compound.feedback.clashLinks.forEach((link, index) => {
        const sourceError = validateQuote({
          quote: link.sourceQuote,
          roundNumber: link.sourceRoundNumber,
          speaker: link.sourceSpeaker,
          input,
        });
        if (sourceError) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["feedback", "clashLinks", index, "sourceQuote"],
            message: sourceError,
          });
        }
        if (
          link.responseQuote !== null &&
          link.responseRoundNumber !== null &&
          link.responseSpeaker !== null
        ) {
          const responseError = validateQuote({
            quote: link.responseQuote,
            roundNumber: link.responseRoundNumber,
            speaker: link.responseSpeaker,
            input,
          });
          if (responseError) {
            context.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["feedback", "clashLinks", index, "responseQuote"],
              message: responseError,
            });
          }
        }
      });
    });
  return { schema, target };
}

export function buildPracticeFullRoundCompoundPrompt(params: {
  basePrompt: string;
  practiceLanguage?: PracticeLanguage;
  minimums: {
    minArgumentBreakdowns: number;
    minAnnotations: number;
    minClashLinks: number;
  };
}): string {
  const language =
    params.practiceLanguage === "vi"
      ? "Write every learner-facing explanation in natural Vietnamese with diacritics; preserve exact transcript quotes."
      : "Write every learner-facing explanation in natural English; preserve exact transcript quotes.";
  return `${params.basePrompt}

## Durable Full-Round Compound Judgment (supersedes the earlier root shape)
Return one JSON object with exactly two top-level fields: speechMap and feedback.
First map every declared speech and the macro clashes, then judge from that map in the same response. Do not perform or request a later repair stage.
${language}

Required compound shape:
{
  "speechMap": {
    "speechMap": [{"roundNumber": 1, "label": "...", "speaker": "user|ai", "mainClaims": ["..."], "responses": [], "evidence": [], "strategicNotes": "..."}],
    "macroClashes": [{"id": "clash-1", "name": "...", "studentPosition": "...", "aiPosition": "...", "judgeRead": "...", "studentMissingResponse": ""}],
    "judgingFocus": ["..."]
  },
  "feedback": { "...": "the complete feedback shape required above" }
}

feedback must include at least ${params.minimums.minArgumentBreakdowns} argumentBreakdowns, ${params.minimums.minAnnotations} exact transcriptAnnotations, and ${params.minimums.minClashLinks} clashLinks, plus debateVerdict and complete scoreRationale. Every quote must be an exact contiguous, high-signal excerpt from the declared round and speaker; never use a greeting, filler, generic opening, or the motion title. JSON only.`;
}
