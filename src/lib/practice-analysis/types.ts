import type {
  AiDifficulty,
  ClubPracticeContext,
  DebateRound,
  PracticeLanguage,
  PracticeTrack,
} from "@/types";
import type { DebateScore } from "@/types/feedback";

export type PracticeAttemptStatus =
  | "draft"
  | "submitted"
  | "analyzing"
  | "completed"
  | "failed";

export type AnalysisJobStatus =
  | "queued"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled";

export interface PracticeAnalysisInput {
  attemptId?: string;
  transcript: string;
  topic: string;
  side: "proposition" | "opposition";
  speechType: string;
  timeLimit: number;
  actualDuration: number;
  practiceTrack: PracticeTrack;
  practiceLanguage: PracticeLanguage;
  isFullRound: boolean;
  rounds?: DebateRound[];
  mode: "quick" | "full";
  prepTime: number;
  speechTime: number;
  prepNotes?: string;
  aiDifficulty?: AiDifficulty;
  topicId?: string;
  practiceTopicKey?: string;
  topicCategory: string;
  topicCategoryKey?: string;
  topicDifficulty: "beginner" | "intermediate" | "advanced";
  audioStoragePath?: string;
  clubContext?: ClubPracticeContext;
}

export interface PracticeAttemptSnapshot {
  schemaVersion: 1;
  capturedAt: string;
  analysisParams: {
    transcript: string;
    topic: string;
    side: "proposition" | "opposition";
    speechType: string;
    timeLimit: number;
    actualDuration: number;
    practiceTrack: PracticeTrack;
    practiceLanguage: PracticeLanguage;
    isFullRound: boolean;
    rounds?: DebateRound[];
  };
  session: {
    mode: "quick" | "full";
    prepTime: number;
    speechTime: number;
    prepNotes: string | null;
    aiDifficulty: AiDifficulty | null;
    topicId: string | null;
    practiceTopicKey: string | null;
    topicCategory: string;
    topicCategoryKey: string | null;
    topicDifficulty: "beginner" | "intermediate" | "advanced";
    audioStoragePath: string | null;
    clubContext: ClubPracticeContext | null;
  };
}

export interface PracticeAnalysisQueueMessage {
  jobId: string;
  attemptId: string;
  userId: string;
}

export interface CompletedPracticeAnalysis {
  attemptId: string;
  jobId: string;
  feedback: DebateScore;
  modelName: string;
  legacySessionId: string | null;
}

export interface PracticeAnalysisJobResponse {
  id: string;
  attemptId: string;
  status: AnalysisJobStatus;
  attemptStatus: PracticeAttemptStatus;
  feedback: DebateScore | null;
  modelName: string | null;
  legacySessionId: string | null;
  error: string | null;
}

export interface PracticeAttemptRecord {
  id: string;
  user_id: string;
  status: PracticeAttemptStatus;
  practice_track: PracticeTrack;
  practice_language: PracticeLanguage;
  topic_id: string | null;
  practice_topic_key: string | null;
  topic_title: string;
  topic_category: string;
  topic_category_key: string | null;
  topic_difficulty: "beginner" | "intermediate" | "advanced";
  side: "proposition" | "opposition";
  mode: "quick" | "full";
  prep_time: number;
  speech_time: number;
  duration_seconds: number;
  transcript: string;
  prep_notes: string | null;
  ai_difficulty: AiDifficulty | null;
  rounds: DebateRound[] | null;
  audio_storage_path: string | null;
  attempt_snapshot: PracticeAttemptSnapshot;
  input_hash: string | null;
  prompt_hash: string | null;
  prompt_bundle_key: string;
  prompt_bundle_version: number;
  rubric_key: string;
  rubric_version: number;
  model_provider: string | null;
  model_name: string | null;
  feedback: DebateScore | null;
  total_score: number | null;
  overall_band: string | null;
  legacy_debate_session_id: string | null;
  error_code: string | null;
  error_message: string | null;
  submitted_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AnalysisJobRecord {
  id: string;
  attempt_id: string;
  user_id: string;
  job_type: string;
  status: AnalysisJobStatus;
  queue_topic: string;
  queue_message_id: string | null;
  idempotency_key: string;
  delivery_count: number;
  max_attempts: number;
  input_hash: string | null;
  prompt_hash: string | null;
  model_provider: string | null;
  model_name: string | null;
  started_at: string | null;
  finished_at: string | null;
  next_retry_at: string | null;
  error_code: string | null;
  error_message: string | null;
  result: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}
