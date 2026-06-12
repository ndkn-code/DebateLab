import type { DebateRound, PracticeLanguage, PracticeTrack } from "@/types";
import {
  getBoolean,
  getEnum,
  getNumber,
  getString,
  getJsonRecord,
  isPlainRecord,
  RequestValidationError,
  type JsonRecord,
} from "@/lib/api/request-validation";
import { normalizeRebuttalText } from "@/lib/rebuttal/structured-response";
import type { PracticeAnalysisInput } from "./types";
import type { ClubPracticeContext, DebateMemory, MotionBrief } from "@/types";
import type {
  PracticeTranscriptionAlternative,
  PracticeTranscriptionArtifact,
  PracticeTranscriptionNormalizationHint,
  PracticeTranscriptionProvider,
  PracticeTranscriptionRepairArtifact,
  PracticeTranscriptionRepairEdit,
  PracticeTranscriptionUncertainSpan,
  PracticeTranscriptionWarning,
} from "@thinkfy/shared/practice";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseRound(value: unknown, index: number): DebateRound {
  if (!isPlainRecord(value)) {
    throw new RequestValidationError(`rounds[${index}] is invalid.`);
  }

  const roundNumber =
    typeof value.roundNumber === "number" && Number.isFinite(value.roundNumber)
      ? Math.max(1, Math.floor(value.roundNumber))
      : index + 1;
  const type =
    value.type === "ai-rebuttal" || value.type === "user-speech"
      ? value.type
      : "user-speech";
  const label =
    typeof value.label === "string"
      ? value.label.trim().slice(0, 80)
      : `Round ${roundNumber}`;
  const transcript =
    typeof value.transcript === "string"
      ? value.transcript.trim().slice(0, 12000)
      : undefined;
  const aiResponse =
    typeof value.aiResponse === "string"
      ? normalizeRebuttalText(value.aiResponse).slice(0, 12000)
      : undefined;
  const duration =
    typeof value.duration === "number" && Number.isFinite(value.duration)
      ? Math.max(0, Math.min(7200, Math.floor(value.duration)))
      : undefined;

  return { roundNumber, type, label, transcript, aiResponse, duration };
}

function getOptionalUuid(body: JsonRecord, key: string) {
  const value = getString(body, key, { maxLength: 64 });
  if (!value) return undefined;
  if (!UUID_PATTERN.test(value)) {
    throw new RequestValidationError(`${key} is invalid.`);
  }
  return value;
}

function getOptionalString(body: JsonRecord, key: string, maxLength: number) {
  return getString(body, key, { maxLength });
}

function readStringArray(value: unknown, maxItems: number, maxLength: number) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim().slice(0, maxLength) : ""))
    .filter(Boolean)
    .slice(0, maxItems);
}

function parseMotionBrief(value: unknown): MotionBrief | undefined {
  if (!isPlainRecord(value)) return undefined;
  const keyTerms = readStringArray(value.keyTerms, 8, 240);
  const scope = typeof value.scope === "string" ? value.scope.trim().slice(0, 1200) : "";
  const propositionBurden =
    typeof value.propositionBurden === "string"
      ? value.propositionBurden.trim().slice(0, 1200)
      : "";
  const oppositionBurden =
    typeof value.oppositionBurden === "string"
      ? value.oppositionBurden.trim().slice(0, 1200)
      : "";
  const modelClarification =
    typeof value.modelClarification === "string"
      ? value.modelClarification.trim().slice(0, 1200)
      : "";

  if (
    keyTerms.length === 0 ||
    !scope ||
    !propositionBurden ||
    !oppositionBurden ||
    !modelClarification
  ) {
    return undefined;
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
  if (!isPlainRecord(value)) return undefined;
  const aiSide =
    value.aiSide === "proposition" || value.aiSide === "opposition"
      ? value.aiSide
      : null;
  const studentSide =
    value.studentSide === "proposition" || value.studentSide === "opposition"
      ? value.studentSide
      : null;
  const policyModel =
    typeof value.policyModel === "string"
      ? value.policyModel.trim().slice(0, 1200)
      : "";

  if (!aiSide || !studentSide || !policyModel) return undefined;

  return {
    aiSide,
    studentSide,
    policyModel,
    priorAiClaims: readStringArray(value.priorAiClaims, 12, 500),
    concessions: readStringArray(value.concessions, 8, 500),
    activeClashes: readStringArray(value.activeClashes, 12, 500),
    droppedClaims: readStringArray(value.droppedClaims, 8, 500),
  };
}

function parseClubContext(body: JsonRecord): ClubPracticeContext | undefined {
  const raw = getJsonRecord(body, "clubContext", { maxBytes: 2048 });
  const context: ClubPracticeContext = {};
  if (typeof raw.clubId === "string" && UUID_PATTERN.test(raw.clubId)) {
    context.clubId = raw.clubId;
  }
  if (typeof raw.classId === "string" && UUID_PATTERN.test(raw.classId)) {
    context.classId = raw.classId;
  }
  if (typeof raw.assignmentId === "string" && UUID_PATTERN.test(raw.assignmentId)) {
    context.assignmentId = raw.assignmentId;
  }
  if (typeof raw.assignmentTitle === "string") {
    context.assignmentTitle = raw.assignmentTitle.trim().slice(0, 200);
  }
  return Object.keys(context).length > 0 ? context : undefined;
}

const TRANSCRIPTION_PROVIDERS = new Set<PracticeTranscriptionProvider>([
  "deepgram",
  "groq",
  "deepgram_groq_consensus",
  "deepgram_groq_shadow",
]);
const TRANSCRIPTION_WARNINGS = new Set<PracticeTranscriptionWarning>([
  "no_speech_detected",
  "short_transcript",
  "low_confidence",
  "possible_stt_artifacts",
  "fallback_transcript_used",
  "groq_unavailable",
  "provider_disagreement",
  "repair_skipped",
  "repair_uncertain",
  "repair_hallucination_risk",
]);

function clampConfidence(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(1, value))
    : null;
}

function readTranscriptionProvider(value: unknown): PracticeTranscriptionProvider {
  return typeof value === "string" && TRANSCRIPTION_PROVIDERS.has(value as PracticeTranscriptionProvider)
    ? (value as PracticeTranscriptionProvider)
    : "deepgram";
}

function parseTranscriptionAlternative(value: unknown): PracticeTranscriptionAlternative | null {
  if (!isPlainRecord(value)) return null;
  const transcript = typeof value.transcript === "string" ? value.transcript.trim().slice(0, 45000) : "";
  if (!transcript) return null;
  return {
    provider: readTranscriptionProvider(value.provider),
    model: typeof value.model === "string" ? value.model.trim().slice(0, 120) : "unknown",
    transcript,
    confidence: clampConfidence(value.confidence),
    requestId: typeof value.requestId === "string" ? value.requestId.trim().slice(0, 160) : null,
    selected: value.selected === true,
    errorCode: typeof value.errorCode === "string" ? value.errorCode.trim().slice(0, 80) : undefined,
    qualityFlags: readStringArray(value.qualityFlags, 12, 80),
  };
}

function parseNormalizationHint(value: unknown): PracticeTranscriptionNormalizationHint | null {
  if (!isPlainRecord(value)) return null;
  const raw = typeof value.raw === "string" ? value.raw.trim().slice(0, 120) : "";
  const normalized =
    typeof value.normalized === "string" ? value.normalized.trim().slice(0, 120) : "";
  if (!raw || !normalized) return null;
  return {
    raw,
    normalized,
    reason:
      typeof value.reason === "string"
        ? value.reason.trim().slice(0, 240)
        : "Likely speech-to-text artifact.",
    confidence:
      typeof value.confidence === "number" && Number.isFinite(value.confidence)
        ? Math.max(0, Math.min(1, value.confidence))
        : 0.75,
    source:
      value.source === "motion_context" || value.source === "provider_consensus"
        ? value.source
        : "static_glossary",
  };
}

function parseRepairEdit(value: unknown): PracticeTranscriptionRepairEdit | null {
  if (!isPlainRecord(value)) return null;
  const raw = typeof value.raw === "string" ? value.raw.trim().slice(0, 240) : "";
  const repaired =
    typeof value.repaired === "string" ? value.repaired.trim().slice(0, 240) : "";
  const reason =
    typeof value.reason === "string"
      ? value.reason.trim().slice(0, 320)
      : "Conservative STT repair.";
  const allowedCategories: PracticeTranscriptionRepairEdit["category"][] = [
    "debate_keyterm",
    "proper_noun",
    "spacing",
    "casing",
    "filler",
    "false_start",
    "punctuation",
  ];
  const category = allowedCategories.includes(
    value.category as PracticeTranscriptionRepairEdit["category"]
  )
    ? (value.category as PracticeTranscriptionRepairEdit["category"])
    : "punctuation";
  if (!raw || !repaired) return null;
  return {
    raw,
    repaired,
    reason,
    category,
    confidence:
      typeof value.confidence === "number" && Number.isFinite(value.confidence)
        ? Math.max(0, Math.min(1, value.confidence))
        : 0.5,
  };
}

function parseUncertainSpan(value: unknown): PracticeTranscriptionUncertainSpan | null {
  if (!isPlainRecord(value)) return null;
  const text = typeof value.text === "string" ? value.text.trim().slice(0, 400) : "";
  const reason =
    typeof value.reason === "string"
      ? value.reason.trim().slice(0, 320)
      : "Transcript span remained uncertain.";
  if (!text) return null;
  return {
    text,
    reason,
    confidence:
      typeof value.confidence === "number" && Number.isFinite(value.confidence)
        ? Math.max(0, Math.min(1, value.confidence))
        : 0.4,
  };
}

function parseRepairArtifact(value: unknown): PracticeTranscriptionRepairArtifact | undefined {
  if (!isPlainRecord(value)) return undefined;
  const statuses: PracticeTranscriptionRepairArtifact["status"][] = [
    "not_attempted",
    "skipped",
    "repaired",
    "uncertain",
    "hallucination_risk",
    "failed",
  ];
  const status = statuses.includes(value.status as PracticeTranscriptionRepairArtifact["status"])
    ? (value.status as PracticeTranscriptionRepairArtifact["status"])
    : "failed";
  const warnings = Array.isArray(value.warnings)
    ? value.warnings
        .filter((item): item is PracticeTranscriptionWarning =>
          typeof item === "string" && TRANSCRIPTION_WARNINGS.has(item as PracticeTranscriptionWarning)
        )
        .slice(0, 8)
    : [];
  return {
    version:
      typeof value.version === "number" && Number.isFinite(value.version)
        ? Math.max(1, Math.round(value.version))
        : 1,
    provider: typeof value.provider === "string" ? value.provider.trim().slice(0, 80) : "unknown",
    model: typeof value.model === "string" ? value.model.trim().slice(0, 120) : "unknown",
    status,
    mode: value.mode === "judge" ? "judge" : "shadow",
    latencyMs:
      typeof value.latencyMs === "number" && Number.isFinite(value.latencyMs)
        ? Math.max(0, Math.round(value.latencyMs))
        : 0,
    rawTranscriptHash:
      typeof value.rawTranscriptHash === "string"
        ? value.rawTranscriptHash.trim().slice(0, 128)
        : "",
    edits: Array.isArray(value.edits)
      ? value.edits.map(parseRepairEdit).filter((item): item is PracticeTranscriptionRepairEdit => item !== null).slice(0, 80)
      : [],
    uncertainSpans: Array.isArray(value.uncertainSpans)
      ? value.uncertainSpans.map(parseUncertainSpan).filter((item): item is PracticeTranscriptionUncertainSpan => item !== null).slice(0, 40)
      : [],
    warnings,
    hallucinationRisk:
      typeof value.hallucinationRisk === "number" && Number.isFinite(value.hallucinationRisk)
        ? Math.max(0, Math.min(1, value.hallucinationRisk))
        : 0,
    repairedAt:
      typeof value.repairedAt === "string"
        ? value.repairedAt.trim().slice(0, 80)
        : new Date().toISOString(),
  };
}

export function parseTranscriptionArtifact(value: unknown): PracticeTranscriptionArtifact | undefined {
  if (!isPlainRecord(value)) return undefined;
  const transcript = typeof value.transcript === "string" ? value.transcript.trim().slice(0, 45000) : "";
  if (!transcript) return undefined;
  const language =
    value.language === "vi" || value.language === "en" ? value.language : undefined;
  if (!language) return undefined;
  const warnings = Array.isArray(value.warnings)
    ? value.warnings
        .filter((item): item is PracticeTranscriptionWarning =>
          typeof item === "string" && TRANSCRIPTION_WARNINGS.has(item as PracticeTranscriptionWarning)
        )
        .slice(0, 12)
    : [];
  const alternatives = Array.isArray(value.alternatives)
    ? value.alternatives
        .map(parseTranscriptionAlternative)
        .filter(
          (item): item is PracticeTranscriptionAlternative => item !== null
        )
        .slice(0, 4)
    : undefined;
  const normalizationHints = Array.isArray(value.normalizationHints)
    ? value.normalizationHints
        .map(parseNormalizationHint)
        .filter(
          (item): item is PracticeTranscriptionNormalizationHint =>
            item !== null
        )
        .slice(0, 24)
    : undefined;

  return {
    transcript,
    judgeTranscript:
      typeof value.judgeTranscript === "string"
        ? value.judgeTranscript.trim().slice(0, 45000)
        : undefined,
    rawTranscript:
      typeof value.rawTranscript === "string"
        ? value.rawTranscript.trim().slice(0, 45000)
        : undefined,
    normalizedTranscript:
      typeof value.normalizedTranscript === "string"
        ? value.normalizedTranscript.trim().slice(0, 45000)
        : undefined,
    confidence: clampConfidence(value.confidence),
    wordCount:
      typeof value.wordCount === "number" && Number.isFinite(value.wordCount)
        ? Math.max(0, Math.round(value.wordCount))
        : transcript.split(/\s+/).filter(Boolean).length,
    provider: readTranscriptionProvider(value.provider),
    model: typeof value.model === "string" ? value.model.trim().slice(0, 120) : "unknown",
    requestId: typeof value.requestId === "string" ? value.requestId.trim().slice(0, 160) : null,
    language,
    warnings,
    alternatives,
    normalizationHints,
    repair: parseRepairArtifact(value.repair),
    audioBucket: "practice-audio",
    audioStoragePath:
      typeof value.audioStoragePath === "string"
        ? value.audioStoragePath.trim().slice(0, 600)
        : "",
    durationSeconds:
      typeof value.durationSeconds === "number" && Number.isFinite(value.durationSeconds)
        ? Math.max(0, Math.round(value.durationSeconds))
        : 0,
    transcribedAt:
      typeof value.transcribedAt === "string"
        ? value.transcribedAt.trim().slice(0, 80)
        : new Date().toISOString(),
  };
}

export function parsePracticeAnalysisInput(body: JsonRecord): PracticeAnalysisInput {
  const transcript = getString(body, "transcript", {
    required: true,
    minLength: 1,
    maxLength: 45000,
  })!;
  const topic = getString(body, "topic", {
    required: true,
    minLength: 2,
    maxLength: 300,
  })!;
  const side = getEnum(body, "side", ["proposition", "opposition"] as const, {
    required: true,
  })!;
  const practiceTrack = getEnum(
    body,
    "practiceTrack",
    ["speaking", "debate"] as const,
    { defaultValue: "debate" }
  ) as PracticeTrack;
  const practiceLanguage = getEnum(
    body,
    "practiceLanguage",
    ["en", "vi"] as const,
    { defaultValue: "en" }
  ) as PracticeLanguage;
  const mode = getEnum(body, "mode", ["quick", "full"] as const, {
    defaultValue: practiceTrack === "speaking" ? "quick" : "full",
  })!;
  const roundsValue = body.rounds;
  const rounds =
    roundsValue == null
      ? undefined
      : Array.isArray(roundsValue) && roundsValue.length <= 12
        ? roundsValue.map(parseRound)
        : (() => {
            throw new RequestValidationError("rounds is invalid.");
          })();

  return {
    attemptId: getOptionalUuid(body, "attemptId"),
    transcript,
    topic,
    side,
    speechType: getString(body, "speechType", {
      maxLength: 80,
      defaultValue: practiceTrack === "speaking" ? "Speaking Practice" : "Opening Statement",
    })!,
    timeLimit: getNumber(body, "timeLimit", {
      min: 0,
      max: 7200,
      defaultValue: 2,
    })!,
    actualDuration: getNumber(body, "actualDuration", {
      min: 0,
      max: 7200,
      defaultValue: 0,
    })!,
    practiceTrack,
    practiceLanguage,
    isFullRound: Boolean(getBoolean(body, "isFullRound", false)),
    rounds,
    motionBrief: parseMotionBrief(body.motionBrief),
    debateMemory: parseDebateMemory(body.debateMemory),
    transcription: parseTranscriptionArtifact(body.transcription),
    mode,
    prepTime: getNumber(body, "prepTime", {
      min: 0,
      max: 7200,
      defaultValue: 0,
    })!,
    speechTime: getNumber(body, "speechTime", {
      min: 0,
      max: 7200,
      defaultValue: 0,
    })!,
    prepNotes: getOptionalString(body, "prepNotes", 12000),
    aiDifficulty: getEnum(body, "aiDifficulty", ["easy", "medium", "hard"] as const),
    topicId: getOptionalUuid(body, "topicId"),
    practiceTopicKey: getOptionalString(body, "practiceTopicKey", 160),
    topicCategory: getString(body, "topicCategory", {
      maxLength: 120,
      defaultValue: "Practice",
    })!,
    topicCategoryKey: getOptionalString(body, "topicCategoryKey", 160),
    topicDifficulty: getEnum(
      body,
      "topicDifficulty",
      ["beginner", "intermediate", "advanced"] as const,
      { defaultValue: "intermediate" }
    )!,
    audioStoragePath: getOptionalString(body, "audioStoragePath", 600),
    clubContext: parseClubContext(body),
  };
}

export function getPracticeAnalysisWordCount(input: Pick<PracticeAnalysisInput, "transcript">) {
  return input.transcript.split(/\s+/).filter((word) => word.length > 0).length;
}
