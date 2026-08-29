import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/supabase";
import type { PracticeLanguage, PracticeTrack } from "@/types";
import type { DebateCorpusPurpose } from "@/lib/corpus/model";
import type { DebateCorpusRetrievalCacheEntry } from "@/lib/corpus/retrieval";

export type KnowledgeCollection =
  | "debate"
  | "ielts_rubric"
  | "ielts_exemplar"
  | "learner_history";

export type KnowledgePurpose =
  | "grading"
  | "coaching"
  | "opponent"
  | "explanation";

export interface KnowledgeEvidence {
  sourceId: string;
  version: string;
  itemType: string;
  highlight: string;
  score: number;
  reviewStatus: string;
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
  onCacheEntry?: (entry: DebateCorpusRetrievalCacheEntry) => Promise<void> | void;
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

export type KnowledgeSearchRequest =
  | DebateKnowledgeRequest
  | IeltsExemplarKnowledgeRequest
  | RubricKnowledgeRequest
  | LearnerHistoryKnowledgeRequest;

