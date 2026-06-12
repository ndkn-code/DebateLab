import "server-only";

import { createHash } from "node:crypto";
import type {
  PracticeTranscriptionAlternative,
  PracticeTranscriptionArtifact,
  PracticeTranscriptionRepairArtifact,
  PracticeTranscriptionRepairEdit,
  PracticeTranscriptionUncertainSpan,
  PracticeTranscriptionWarning,
} from "@thinkfy/shared/practice";
import type { MotionBrief, PracticeLanguage, PracticeTrack } from "@/types";
import {
  getGeminiApiKeys,
  getGeminiClientForSlot,
  runWithGeminiKeyPool,
} from "@/lib/gemini/key-pool";
import { getSttConfig } from "./config";
import { getSttWordCount } from "./consensus";

type RepairStatus = PracticeTranscriptionRepairArtifact["status"];

export interface RepairJudgeTranscriptInput {
  transcription: PracticeTranscriptionArtifact;
  practiceLanguage: PracticeLanguage;
  practiceTrack?: PracticeTrack;
  topic?: string | null;
  side?: "proposition" | "opposition" | "random" | null;
  motionBrief?: MotionBrief | null;
  prepNotes?: string | null;
  keyterms: string[];
}

type RawRepairResponse = {
  judgeTranscript?: unknown;
  edits?: unknown;
  uncertainSpans?: unknown;
  warnings?: unknown;
  hallucinationRisk?: unknown;
  status?: unknown;
};

function hashTranscript(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function clamp(value: unknown, min: number, max: number, fallback: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}

function readString(value: unknown, max = 400) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

function parseJsonObject(value: string): RawRepairResponse | null {
  const trimmed = value.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const source = fenced ?? trimmed;
  const direct = source.match(/\{[\s\S]*\}/)?.[0] ?? source;
  try {
    const parsed = JSON.parse(direct) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as RawRepairResponse)
      : null;
  } catch {
    return null;
  }
}

function normalizeEdit(value: unknown): PracticeTranscriptionRepairEdit | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  const raw = readString(source.raw, 240);
  const repaired = readString(source.repaired, 240);
  const reason = readString(source.reason, 320);
  const allowedCategories = new Set<PracticeTranscriptionRepairEdit["category"]>([
    "debate_keyterm",
    "proper_noun",
    "spacing",
    "casing",
    "filler",
    "false_start",
    "punctuation",
  ]);
  const category = readString(source.category, 80);

  if (!raw || !repaired || !reason) return null;
  return {
    raw,
    repaired,
    reason,
    confidence: clamp(source.confidence, 0, 1, 0.5),
    category: allowedCategories.has(category as PracticeTranscriptionRepairEdit["category"])
      ? (category as PracticeTranscriptionRepairEdit["category"])
      : "punctuation",
  };
}

function normalizeSpan(value: unknown): PracticeTranscriptionUncertainSpan | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  const text = readString(source.text, 400);
  const reason = readString(source.reason, 320);
  if (!text || !reason) return null;
  return {
    text,
    reason,
    confidence: clamp(source.confidence, 0, 1, 0.4),
  };
}

function buildRepairWarnings(input: {
  status: RepairStatus;
  hallucinationRisk: number;
  uncertainSpanCount: number;
}) {
  const warnings: PracticeTranscriptionWarning[] = [];
  if (input.status === "skipped" || input.status === "failed") {
    warnings.push("repair_skipped");
  }
  if (input.status === "uncertain" || input.uncertainSpanCount > 0) {
    warnings.push("repair_uncertain");
  }
  if (input.status === "hallucination_risk" || input.hallucinationRisk >= 0.35) {
    warnings.push("repair_hallucination_risk");
  }
  return warnings;
}

function hasMeaningfulText(value: string) {
  return getSttWordCount(value) >= 20;
}

function shouldRunRepair(input: RepairJudgeTranscriptInput) {
  const config = getSttConfig();
  const track = input.practiceTrack ?? "debate";
  if (
    !config.judgeTranscriptRepairShadowEnabled &&
    !config.judgeTranscriptRepairUseForJudge
  ) {
    return false;
  }
  if (!config.repairLanguages.includes(input.practiceLanguage)) return false;
  if (!config.repairTracks.includes(track)) return false;
  return hasMeaningfulText(input.transcription.transcript);
}

function buildRepairPrompt(input: RepairJudgeTranscriptInput) {
  const alternatives = (input.transcription.alternatives ?? [])
    .filter((alternative): alternative is PracticeTranscriptionAlternative =>
      Boolean(alternative.transcript?.trim())
    )
    .slice(0, 4)
    .map((alternative) => ({
      provider: alternative.provider,
      model: alternative.model,
      selected: alternative.selected,
      confidence: alternative.confidence,
      qualityFlags: alternative.qualityFlags ?? [],
      transcript: alternative.transcript.slice(0, 12000),
    }));

  return `You repair automatic speech-to-text transcripts for Vietnamese high-school debate judging.

Return exactly one JSON object. Do not include markdown.

Core rule: preserve the speaker's meaning. Never add claims, examples, statistics, numbers, impacts, concessions, or evidence that are not supported by the transcript candidates.

Allowed repair categories:
- debate_keyterm: common debate words such as clash, weighing, impact, rebuttal, burden, mechanism, WSDC
- proper_noun: motion terms, named people, countries, organizations, acronyms
- spacing: obvious split or merged words
- casing: acronym/proper noun formatting
- filler: ums/uhs/repeated filler only
- false_start: remove abandoned self-correction only when the final intended phrase remains
- punctuation: punctuation that clarifies existing text

If uncertain, keep the original wording and add an uncertain span. If a repair could change the argument, do not make it.

Context:
${JSON.stringify({
    practiceLanguage: input.practiceLanguage,
    practiceTrack: input.practiceTrack ?? "debate",
    topic: input.topic ?? null,
    side: input.side ?? null,
    motionBrief: input.motionBrief
      ? {
          keyTerms: input.motionBrief.keyTerms,
          scope: input.motionBrief.scope,
          propositionBurden: input.motionBrief.propositionBurden,
          oppositionBurden: input.motionBrief.oppositionBurden,
          modelClarification: input.motionBrief.modelClarification,
        }
      : null,
    keyterms: input.keyterms.slice(0, 50),
    prepNotes: input.prepNotes?.slice(0, 1200) ?? null,
  })}

Selected transcript:
${input.transcription.transcript.slice(0, 16000)}

Raw transcript:
${(input.transcription.rawTranscript ?? input.transcription.transcript).slice(0, 16000)}

Provider alternatives:
${JSON.stringify(alternatives)}

Return shape:
{
  "status": "repaired" | "uncertain" | "hallucination_risk",
  "judgeTranscript": "transcript for judging",
  "edits": [{"raw": "exact source text", "repaired": "replacement", "category": "debate_keyterm|proper_noun|spacing|casing|filler|false_start|punctuation", "reason": "why this is safe", "confidence": 0.0}],
  "uncertainSpans": [{"text": "exact uncertain source text", "reason": "why uncertain", "confidence": 0.0}],
  "warnings": ["short plain warning strings"],
  "hallucinationRisk": 0.0
}`;
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  onTimeout: () => T
) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<T>((resolve) => {
    timeoutId = setTimeout(() => resolve(onTimeout()), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

function createRepairArtifact(input: {
  status: RepairStatus;
  mode: PracticeTranscriptionRepairArtifact["mode"];
  provider: string;
  model: string;
  rawTranscriptHash: string;
  latencyMs: number;
  edits?: PracticeTranscriptionRepairEdit[];
  uncertainSpans?: PracticeTranscriptionUncertainSpan[];
  hallucinationRisk?: number;
}) {
  const hallucinationRisk = clamp(input.hallucinationRisk, 0, 1, 0);
  const uncertainSpans = input.uncertainSpans ?? [];
  const warnings = buildRepairWarnings({
    status: input.status,
    hallucinationRisk,
    uncertainSpanCount: uncertainSpans.length,
  });
  return {
    version: getSttConfig().repairVersion,
    provider: input.provider,
    model: input.model,
    status: input.status,
    mode: input.mode,
    latencyMs: Math.max(0, Math.round(input.latencyMs)),
    rawTranscriptHash: input.rawTranscriptHash,
    edits: (input.edits ?? []).slice(0, 80),
    uncertainSpans: uncertainSpans.slice(0, 40),
    warnings,
    hallucinationRisk,
    repairedAt: new Date().toISOString(),
  } satisfies PracticeTranscriptionRepairArtifact;
}

export async function repairJudgeTranscript(
  input: RepairJudgeTranscriptInput
): Promise<{
  judgeTranscript: string | null;
  repair: PracticeTranscriptionRepairArtifact;
}> {
  const config = getSttConfig();
  const startedAt = Date.now();
  const rawTranscript = input.transcription.rawTranscript ?? input.transcription.transcript;
  const rawTranscriptHash = hashTranscript(rawTranscript);
  const mode = config.judgeTranscriptRepairUseForJudge ? "judge" : "shadow";

  if (!shouldRunRepair(input)) {
    return {
      judgeTranscript: null,
      repair: createRepairArtifact({
        status: "skipped",
        mode,
        provider: "none",
        model: config.repairModel,
        rawTranscriptHash,
        latencyMs: Date.now() - startedAt,
      }),
    };
  }

  if (getGeminiApiKeys().length === 0) {
    return {
      judgeTranscript: null,
      repair: createRepairArtifact({
        status: "failed",
        mode,
        provider: "google",
        model: config.repairModel,
        rawTranscriptHash,
        latencyMs: Date.now() - startedAt,
      }),
    };
  }

  const runRepair = runWithGeminiKeyPool({
    seed: `${rawTranscriptHash}:stt-repair:${config.repairModel}`,
    run: async (attempt) => {
      const model = getGeminiClientForSlot(attempt.slot).getGenerativeModel({
        model: config.repairModel,
        generationConfig: {
          temperature: 0,
          responseMimeType: "application/json",
        },
      });
      const result = await model.generateContent(buildRepairPrompt(input));
      return result.response.text();
    },
  });

  const text = await withTimeout(runRepair, config.repairTimeoutMs, () => "");
  const parsed = text ? parseJsonObject(text) : null;

  if (!parsed) {
    return {
      judgeTranscript: null,
      repair: createRepairArtifact({
        status: text ? "failed" : "skipped",
        mode,
        provider: "google",
        model: config.repairModel,
        rawTranscriptHash,
        latencyMs: Date.now() - startedAt,
      }),
    };
  }

  const judgeTranscript = readString(parsed.judgeTranscript, 40_000);
  const edits = Array.isArray(parsed.edits)
    ? parsed.edits
        .map(normalizeEdit)
        .filter(
          (edit): edit is PracticeTranscriptionRepairEdit => edit !== null
        )
    : [];
  const uncertainSpans = Array.isArray(parsed.uncertainSpans)
    ? parsed.uncertainSpans
        .map(normalizeSpan)
        .filter(
          (span): span is PracticeTranscriptionUncertainSpan => span !== null
        )
    : [];
  const hallucinationRisk = clamp(parsed.hallucinationRisk, 0, 1, 0);
  const status =
    parsed.status === "hallucination_risk" || hallucinationRisk >= 0.35
      ? "hallucination_risk"
      : parsed.status === "uncertain" || uncertainSpans.length > 0
        ? "uncertain"
        : judgeTranscript && judgeTranscript !== input.transcription.transcript
          ? "repaired"
          : "skipped";

  return {
    judgeTranscript:
      status === "hallucination_risk" || !judgeTranscript
        ? null
        : judgeTranscript,
    repair: createRepairArtifact({
      status,
      mode,
      provider: "google",
      model: config.repairModel,
      rawTranscriptHash,
      latencyMs: Date.now() - startedAt,
      edits,
      uncertainSpans,
      hallucinationRisk,
    }),
  };
}

export function selectTranscriptForJudging(input: {
  transcript: string;
  transcription?: PracticeTranscriptionArtifact | null;
  practiceLanguage?: PracticeLanguage;
  practiceTrack?: PracticeTrack;
}) {
  const config = getSttConfig();
  if (!config.judgeTranscriptRepairUseForJudge) return input.transcript;
  if (!input.transcription?.judgeTranscript) return input.transcript;
  if (input.transcription.repair?.status === "hallucination_risk") {
    return input.transcript;
  }
  if (
    input.practiceLanguage &&
    !config.repairLanguages.includes(input.practiceLanguage)
  ) {
    return input.transcript;
  }
  if (input.practiceTrack && !config.repairTracks.includes(input.practiceTrack)) {
    return input.transcript;
  }
  return input.transcription.judgeTranscript;
}
