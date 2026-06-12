import type { AiDifficulty, DebateTopic } from "./types";
import type { DebateScore, PracticeLanguage, PracticeTrack } from "./feedback";
import {
  DEFAULT_PRACTICE_LANGUAGE,
  coercePracticeLanguage,
} from "./language";
import {
  SOLO_PREP_DURATION,
  SOLO_SPEECH_DURATION,
  clampDurationSeconds,
} from "./durations";

export const MOBILE_PRACTICE_AUDIO_BUCKET = "practice-audio";
export const MOBILE_PRACTICE_AUDIO_FOLDER = "mobile-practice";
export const MOBILE_PRACTICE_AUDIO_CONTENT_TYPE = "audio/mp4";
export const MOBILE_PRACTICE_AUDIO_EXTENSION = ".m4a";
export const MOBILE_PRACTICE_AUDIO_MIME_TYPES = [
  "audio/webm",
  "audio/webm;codecs=opus",
  "audio/mp4",
  "audio/m4a",
  "audio/x-m4a",
  "audio/aac",
] as const;

export type PracticeSide = "proposition" | "opposition" | "random";
export type ResolvedPracticeSide = Exclude<PracticeSide, "random">;
export type PracticeMode = "quick" | "full";
export type PracticeSessionPhase =
  | "setup"
  | "mic-check"
  | "prep"
  | "speaking"
  | "complete";

export interface PracticeSessionConfig {
  topic: DebateTopic;
  side: PracticeSide;
  resolvedSide: ResolvedPracticeSide;
  practiceTrack: PracticeTrack;
  practiceLanguage: PracticeLanguage;
  mode: PracticeMode;
  prepTime: number;
  speechTime: number;
  aiDifficulty: AiDifficulty;
  createdAt: string;
}

export interface PracticeRecordingArtifact {
  recordingId: string;
  uri: string;
  durationSeconds: number;
  mimeType: "audio/mp4" | "audio/m4a";
  fileExtension: ".m4a";
  byteSize: number | null;
  createdAt: string;
  localOnly: true;
}

export interface PracticeUploadArtifact {
  bucket: typeof MOBILE_PRACTICE_AUDIO_BUCKET;
  path: string;
  recordingId: string;
  byteSize: number;
  contentType: typeof MOBILE_PRACTICE_AUDIO_CONTENT_TYPE;
  uploadedAt: string;
}

export type PracticeTranscriptionWarning =
  | "no_speech_detected"
  | "short_transcript"
  | "low_confidence"
  | "possible_stt_artifacts"
  | "fallback_transcript_used"
  | "groq_unavailable"
  | "provider_disagreement"
  | "repair_skipped"
  | "repair_uncertain"
  | "repair_hallucination_risk";

export type PracticeTranscriptionProvider =
  | "deepgram"
  | "groq"
  | "deepgram_groq_consensus"
  | "deepgram_groq_shadow";

export interface PracticeTranscriptionAlternative {
  provider: PracticeTranscriptionProvider;
  model: string;
  transcript: string;
  confidence: number | null;
  requestId: string | null;
  selected: boolean;
  errorCode?: string;
  qualityFlags?: string[];
}

export interface PracticeTranscriptionNormalizationHint {
  raw: string;
  normalized: string;
  reason: string;
  confidence: number;
  source: "static_glossary" | "motion_context" | "provider_consensus";
}

export type PracticeTranscriptionRepairStatus =
  | "not_attempted"
  | "skipped"
  | "repaired"
  | "uncertain"
  | "hallucination_risk"
  | "failed";

export type PracticeTranscriptionRepairMode = "shadow" | "judge";

export interface PracticeTranscriptionRepairEdit {
  raw: string;
  repaired: string;
  reason: string;
  confidence: number;
  category:
    | "debate_keyterm"
    | "proper_noun"
    | "spacing"
    | "casing"
    | "filler"
    | "false_start"
    | "punctuation";
}

export interface PracticeTranscriptionUncertainSpan {
  text: string;
  reason: string;
  confidence: number;
}

export interface PracticeTranscriptionRepairArtifact {
  version: number;
  provider: string;
  model: string;
  status: PracticeTranscriptionRepairStatus;
  mode: PracticeTranscriptionRepairMode;
  latencyMs: number;
  rawTranscriptHash: string;
  edits: PracticeTranscriptionRepairEdit[];
  uncertainSpans: PracticeTranscriptionUncertainSpan[];
  warnings: PracticeTranscriptionWarning[];
  hallucinationRisk: number;
  repairedAt: string;
}

export interface PracticeTranscriptionArtifact {
  transcript: string;
  judgeTranscript?: string;
  rawTranscript?: string;
  normalizedTranscript?: string;
  confidence: number | null;
  wordCount: number;
  provider: PracticeTranscriptionProvider;
  model: string;
  requestId: string | null;
  language: PracticeLanguage;
  warnings: PracticeTranscriptionWarning[];
  alternatives?: PracticeTranscriptionAlternative[];
  normalizationHints?: PracticeTranscriptionNormalizationHint[];
  repair?: PracticeTranscriptionRepairArtifact;
  audioBucket: typeof MOBILE_PRACTICE_AUDIO_BUCKET;
  audioStoragePath: string;
  durationSeconds: number;
  transcribedAt: string;
}

export type PracticeFeedbackAnalysisStatus =
  | "idle"
  | "submitting"
  | "queued"
  | "processing"
  | "completed"
  | "failed"
  | "timeout"
  | "insufficient_credits";

export interface PracticeFeedbackAnalysisState {
  status: PracticeFeedbackAnalysisStatus;
  attemptId: string | null;
  jobId: string | null;
  attemptStatus: string | null;
  feedback: DebateScore | null;
  modelName: string | null;
  legacySessionId: string | null;
  chargedCredits: number | null;
  orbBalance: number | null;
  error: string | null;
  retryCount: number;
  requestedAt: string | null;
  completedAt: string | null;
  updatedAt: string | null;
}

export type PracticeProcessingStatus =
  | "idle"
  | "uploading"
  | "uploaded"
  | "transcribing"
  | "transcribed"
  | "failed";

export interface PracticeProcessingError {
  stage: "upload" | "transcription";
  message: string;
  code: string | null;
  occurredAt: string;
}

export interface PracticeProcessingState {
  status: PracticeProcessingStatus;
  upload: PracticeUploadArtifact | null;
  transcription: PracticeTranscriptionArtifact | null;
  analysis: PracticeFeedbackAnalysisState;
  lastError: PracticeProcessingError | null;
  retryCount: number;
  updatedAt: string | null;
}

export interface PracticeSessionDraft {
  config: PracticeSessionConfig;
  phase: PracticeSessionPhase;
  recording: PracticeRecordingArtifact | null;
  processing: PracticeProcessingState;
  updatedAt: string;
}

function createRandomId() {
  if (
    typeof globalThis.crypto !== "undefined" &&
    "randomUUID" in globalThis.crypto
  ) {
    return globalThis.crypto.randomUUID();
  }

  return `recording-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function createPracticeRecordingId() {
  return createRandomId();
}

export function createIdlePracticeProcessingState(): PracticeProcessingState {
  return {
    status: "idle",
    upload: null,
    transcription: null,
    analysis: createIdlePracticeFeedbackAnalysisState(),
    lastError: null,
    retryCount: 0,
    updatedAt: null,
  };
}

export function createIdlePracticeFeedbackAnalysisState(): PracticeFeedbackAnalysisState {
  return {
    status: "idle",
    attemptId: null,
    jobId: null,
    attemptStatus: null,
    feedback: null,
    modelName: null,
    legacySessionId: null,
    chargedCredits: null,
    orbBalance: null,
    error: null,
    retryCount: 0,
    requestedAt: null,
    completedAt: null,
    updatedAt: null,
  };
}

export function createMobilePracticeAudioPath(
  userId: string,
  recordingId: string
) {
  const safeUserId = userId.trim();
  const safeRecordingId = recordingId
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .slice(0, 120);

  return `${safeUserId}/${MOBILE_PRACTICE_AUDIO_FOLDER}/${safeRecordingId}${MOBILE_PRACTICE_AUDIO_EXTENSION}`;
}

export function isMobilePracticeAudioPathForUser(path: string, userId: string) {
  return path.startsWith(`${userId}/${MOBILE_PRACTICE_AUDIO_FOLDER}/`);
}

export function resolvePracticeSide(side: PracticeSide): ResolvedPracticeSide {
  if (side === "random") {
    return Math.random() > 0.5 ? "proposition" : "opposition";
  }

  return side;
}

export function coercePracticeMode(
  mode: unknown,
  practiceTrack: PracticeTrack
): PracticeMode {
  if (practiceTrack === "speaking") {
    return "quick";
  }

  return mode === "quick" ? "quick" : "full";
}

export function createPracticeSessionConfig(input: {
  topic: DebateTopic;
  side?: PracticeSide;
  practiceTrack?: PracticeTrack;
  practiceLanguage?: PracticeLanguage;
  mode?: PracticeMode;
  prepTime?: number;
  speechTime?: number;
  aiDifficulty?: AiDifficulty;
  createdAt?: string;
}): PracticeSessionConfig {
  const practiceTrack = input.practiceTrack ?? "debate";
  const side = input.side ?? "random";

  return {
    topic: input.topic,
    side,
    resolvedSide: resolvePracticeSide(side),
    practiceTrack,
    practiceLanguage: coercePracticeLanguage(
      input.practiceLanguage,
      DEFAULT_PRACTICE_LANGUAGE
    ),
    mode: coercePracticeMode(input.mode, practiceTrack),
    prepTime: clampDurationSeconds(input.prepTime, SOLO_PREP_DURATION),
    speechTime: clampDurationSeconds(input.speechTime, SOLO_SPEECH_DURATION),
    aiDifficulty: input.aiDifficulty ?? "medium",
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
}
