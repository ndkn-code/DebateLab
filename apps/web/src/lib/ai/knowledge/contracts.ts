import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/supabase";
import type { PracticeLanguage, PracticeTrack } from "@/types";
import type { DebateCorpusPurpose } from "@/lib/corpus/model";
import type { DebateCorpusRetrievalCacheEntry } from "@/lib/corpus/retrieval";

export type KnowledgeCollection =
  | "debate"
  | "debate_en"
  | "knowledge"
  | "ielts_rubric"
  | "ielts_exemplar"
  | "learner_history";

export type KnowledgePurpose =
  | "grading"
  | "coaching"
  | "opponent"
  | "explanation";

export interface KnowledgeEvidence {
  /** Generic knowledge item id. Kept as sourceId for backwards compatibility. */
  sourceId: string;
  version: string;
  itemType: string;
  highlight: string;
  score: number;
  reviewStatus: string;
  sourceLocator?: string | null;
  authorityTier?: string | null;
  rightsStatus?: string | null;
  usableFor?: string[];
  metadata?: Record<string, unknown>;
}

export interface KnowledgeResult<T = unknown> {
  collection: KnowledgeCollection;
  context: string;
  evidence: KnowledgeEvidence[];
  data: T;
  cacheKey: string | null;
  cacheHit: boolean;
  latencyMs: number;
  skippedReason?: string;
}

interface KnowledgeRequestBase {
  purpose: KnowledgePurpose;
  language: PracticeLanguage;
  sourceRoute: string;
  userId?: string | null;
  deadlineMs?: number;
  limit?: number;
  supabase?: SupabaseClient<Database>;
}

export interface DebateKnowledgeRequest extends KnowledgeRequestBase {
  collection: "debate";
  query: string;
  topic: string;
  side?: "proposition" | "opposition";
  practiceTrack?: PracticeTrack;
  debatePurpose: DebateCorpusPurpose;
  roundsText?: string[];
  cacheEntry?: DebateCorpusRetrievalCacheEntry | null;
  onCacheEntry?: (
    entry: DebateCorpusRetrievalCacheEntry,
  ) => Promise<void> | void;
}

export interface IeltsExemplarKnowledgeRequest extends KnowledgeRequestBase {
  collection: "ielts_exemplar";
  skill: "speaking" | "writing";
  questionId: string;
  questionType: Database["public"]["Enums"]["ielts_question_type"];
}

export interface RubricKnowledgeRequest extends KnowledgeRequestBase {
  collection: "ielts_rubric";
  rubricKey: string;
  rubricVersion: number;
}

export interface LearnerHistoryKnowledgeRequest extends KnowledgeRequestBase {
  collection: "learner_history";
  query: string;
  contextType?: string | null;
  contextId?: string | null;
}

export interface IeltsRubricToolRequest extends Omit<
  KnowledgeRequestBase,
  "purpose"
> {
  purpose: "grading" | "coaching" | "explanation";
  skill?: "speaking" | "writing";
  rubricKey?: string;
  rubricVersion?: number;
  criterion?: string;
  query?: string;
}

export interface IeltsBandExamplesToolRequest extends Omit<
  KnowledgeRequestBase,
  "purpose"
> {
  purpose: "grading" | "coaching";
  skill: "speaking" | "writing";
  taskType: string;
  criteria?: string[];
  targetBands?: number[];
  query: string;
  /** Optional exact-question fallback for the legacy exemplar corpus. */
  questionId?: string;
  questionType?: Database["public"]["Enums"]["ielts_question_type"];
}

export interface DebatePatternsToolRequest extends Omit<
  KnowledgeRequestBase,
  "purpose" | "language"
> {
  purpose: "grading" | "coaching" | "opponent" | "explanation";
  query: string;
  format?: string;
  motion?: string;
  side?: "proposition" | "opposition" | "neutral";
  language?: PracticeLanguage;
}

export interface DebateRebuttalToolRequest extends Omit<
  DebatePatternsToolRequest,
  "purpose"
> {
  purpose: "grading" | "coaching" | "opponent" | "explanation";
  targetArgument?: string;
}

export interface StudentSkillHistoryToolRequest extends Omit<
  KnowledgeRequestBase,
  "purpose"
> {
  purpose: "coaching" | "grading" | "explanation";
  query: string;
  skill?: string;
  contextType?: string | null;
  contextId?: string | null;
}

export type KnowledgeSearchRequest =
  | DebateKnowledgeRequest
  | IeltsExemplarKnowledgeRequest
  | RubricKnowledgeRequest
  | LearnerHistoryKnowledgeRequest;
