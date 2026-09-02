/**
 * Pure view-model types for the IELTS post-attempt results experience (WS-2.2).
 *
 * Two layers:
 *  - `*Input` types are the de-DB-typed bundle the results repository
 *    (`lib/api/ielts/results-repository.ts`) hands the pure builder. Keeping them
 *    free of `Tables<>` lets the builder be unit-tested without a database.
 *  - The remaining types are the display view-model the server page passes to the
 *    (client) results components. Everything here is serialisable.
 *
 * Answer keys never reach the client raw: the repository resolves them, on the
 * server, into the formatted `correctAnswer` strings on each review item.
 */
import type {
  IeltsQuestionView,
  IeltsVerdict,
} from "@/lib/ielts/question-types/types";
import type {
  IeltsQuestionView as IeltsPlayerQuestionView,
  IeltsResponseMap,
} from "@/lib/ielts/question-contract";
import type { IeltsQuestionGroupView } from "@/lib/ielts/question-types/groups";
import type { BandConversionRow } from "@/lib/scoring/ielts/band-conversion";
import type { WritingResponseStatus } from "@/lib/ielts/writing-scorer/status";
import type { EffectiveScoreSource } from "@/lib/api/ielts/effective-score-contract";

export type IeltsSkillKey = "listening" | "reading" | "writing" | "speaking";
export type IeltsModuleKey = "academic" | "general_training";
export type ObjectiveSkillKey = "listening" | "reading";

/** Per-skill readiness on the results screen. */
export type SkillResultStatus = "scored" | "in_progress" | "not_attempted";

// ── Repository → builder input bundle ────────────────────────────────────────

/** One objective question + the learner's response + the (server-read) key. */
export interface ResultsObjectiveQuestion {
  view: IeltsQuestionView;
  /** Stored response envelope (jsonb), or null if the learner left it blank. */
  response: unknown;
  isCorrect: boolean | null;
  awardedPoints: number | null;
  /** Secret key fields, read server-side only — formatted away before client. */
  correctAnswer: unknown;
  acceptVariants: unknown;
  explanationEn: string | null;
  explanationVi: string | null;
  /** Optional Reading passage / Listening transcript text for source-context review. */
  source?: ObjectiveSourceInput | null;
  /** Optional author-key metadata used to locate the answer span, never rendered raw. */
  sourceHints?: unknown[];
  /** `ielts_questions.group_key` — joins the question to its {@link IeltsQuestionGroupView}. */
  groupKey?: string | null;
}

export interface ResultsWritingTask {
  questionId: string;
  prompt: string | null;
  taskNumber: number;
  status: WritingResponseStatus;
  essay: string;
  wordCount: number;
  taskResponseBand: number | null;
  coherenceCohesionBand: number | null;
  lexicalResourceBand: number | null;
  grammarBand: number | null;
  taskBand: number | null;
  criteriaFeedback: unknown;
  inlineCorrections: unknown;
  paragraphFeedback: unknown;
  modelAnswer: string | null;
  feedbackLanguage: string;
  /** Versioned grader provenance for a future evidence/confidence presentation. */
  gradingMetadata?: unknown;
  /** Published teacher note; drafts are never included in learner reads. */
  teacherFeedback?: string | null;
  /** Published teacher criterion comments; drafts are never projected. */
  teacherCriterionFeedback?: unknown;
}

export interface ResultsSpeakingPart {
  questionId: string;
  prompt: string | null;
  partNumber: number | null;
  status: WritingResponseStatus;
  transcript: string;
  fluencyCoherenceBand: number | null;
  lexicalResourceBand: number | null;
  grammarBand: number | null;
  pronunciationBand: number | null;
  speakingBand: number | null;
  feedback: unknown;
  feedbackLanguage: string;
  modelAnswer: string | null;
  phonemeReport: unknown;
  /** Short-lived signed URL of the learner's recording (server-created), or null. */
  audioUrl?: string | null;
  /** Versioned grader provenance for a future evidence/confidence presentation. */
  gradingMetadata?: unknown;
  /** Published teacher note; drafts are never included in learner reads. */
  teacherFeedback?: string | null;
  /** Published teacher criterion comments; drafts are never projected. */
  teacherCriterionFeedback?: unknown;
}

export interface AttemptResultsInput {
  attemptId: string;
  /** Server-only owner id, used to resolve the learner's active target plan. */
  userId: string;
  testTitle: string;
  testSlug: string;
  module: IeltsModuleKey;
  attemptStatus: string;
  submittedAt: string | null;
  /** Skills the test covers, in blueprint order (drives totals + sections). */
  skillsInTest: IeltsSkillKey[];
  /** Stored objective rollups from `attempt_band_scores` (immutable record). */
  listeningRaw: number | null;
  readingRaw: number | null;
  listeningBand: number | null;
  readingBand: number | null;
  storedWritingBand: number | null;
  storedSpeakingBand: number | null;
  /** Teacher-aware score authority. Partial averages are explicitly provisional. */
  publishedOverallBand?: number | null;
  provisionalBand?: number | null;
  overallIsProvisional?: boolean;
  scoreSource?: EffectiveScoreSource;
  objectiveQuestions: ResultsObjectiveQuestion[];
  bandConversions: BandConversionRow[];
  writingTasks: ResultsWritingTask[];
  speakingParts: ResultsSpeakingPart[];
  /**
   * Question groups of the sitting (frozen snapshot first, live fallback),
   * ordered by `orderIndex`. Absent/empty for legacy attempts.
   */
  questionGroups?: IeltsQuestionGroupView[];
}

// ── Display view-model ───────────────────────────────────────────────────────

export interface SkillBandRow {
  skill: IeltsSkillKey;
  label: string;
  band: number | null;
  raw: number | null;
  rawMax: number | null;
  status: SkillResultStatus;
}

export interface OverallBandSummary {
  band: number | null;
  isProvisional: boolean;
  presentCount: number;
  totalSkills: number;
}

export interface BandBreakdownRow {
  band: number;
  rawMin: number;
  rawMax: number;
  /** True for the row whose range contains the learner's raw score. */
  isLearnerRow: boolean;
}

export interface SkillBandBreakdown {
  skill: ObjectiveSkillKey;
  label: string;
  module: IeltsModuleKey | null;
  raw: number;
  rawMax: number;
  band: number | null;
  conversionKey: string;
  rows: BandBreakdownRow[];
}

export interface ObjectiveSourceInput {
  kind: ObjectiveSkillKey;
  title: string | null;
  text: string;
  /** Stable id of the passage / listening section this question belongs to. */
  partId?: string | null;
  /** Listening only: public URL of the section's generated audio, when ready. */
  audioUrl?: string | null;
}

export interface ResultsTextSegment {
  text: string;
  highlighted: boolean;
}

export interface ObjectiveSourceContext {
  kind: ObjectiveSkillKey;
  label: string;
  title: string | null;
  segments: ResultsTextSegment[];
  answerLocation: string | null;
}

/** Character offsets of the located answer inside the part's full `sourceText`. */
export interface ObjectiveSourceRange {
  start: number;
  end: number;
}

export interface ObjectiveReviewItem {
  questionId: string;
  /** First question number this row occupies (per skill, sequential). */
  number: number;
  /** Display number: "7", or "21–22" when the row spans several numbers. */
  numberLabel: string;
  questionType: string;
  prompt: string;
  groupInstructions: string | null;
  /** `group_key` of the question's set, joining it to `AttemptResultsViewModel.groups`. */
  groupKey: string | null;
  /**
   * Learner answer for display. Bank ids are mapped to the group bank's labels
   * ("A", "iii") when the question's group has a bank; otherwise to option text.
   */
  learnerAnswer: string;
  correctAnswer: string;
  answered: boolean;
  isCorrect: boolean;
  awardedPoints: number;
  maxPoints: number;
  /** Per-blank verdict recomputed from the key (null while the key is withheld). */
  verdict: IeltsVerdict | null;
  explanationEn: string | null;
  explanationVi: string | null;
  sourceContext: ObjectiveSourceContext | null;
  /** Offsets of the located answer in the owning part's `sourceText`, if found. */
  sourceRange: ObjectiveSourceRange | null;
  /** Seconds into the part's audio where the answer is heard (not yet available). */
  audioTimestamp: number | null;
}

/** One passage (Reading) or section (Listening) of the sitting, with its items. */
export interface ObjectiveReviewPart {
  partId: string;
  title: string;
  /** Full passage body / transcript, or null when the source is unavailable. */
  sourceText: string | null;
  /** Listening: public URL of the section audio; null otherwise. */
  audioUrl: string | null;
  items: ObjectiveReviewItem[];
  /**
   * Player-shaped question views (with placement fields), parallel to `items`,
   * so the review can rebuild group blocks and render the set widgets read-only.
   */
  questions: IeltsPlayerQuestionView[];
}

export interface ObjectiveReviewSection {
  skill: ObjectiveSkillKey;
  label: string;
  correctCount: number;
  totalCount: number;
  /** Flat, skill-ordered items (kept for existing consumers). */
  items: ObjectiveReviewItem[];
  /** The same items split by passage / listening section, in sitting order. */
  parts: ObjectiveReviewPart[];
}

export interface CriterionScore {
  key: string;
  label: string;
  band: number | null;
  rationale: string | null;
}

/** Display projection of a scorer inline correction (errorType kept as text). */
export interface ResultsInlineCorrection {
  original: string;
  suggestion: string;
  errorType: string;
  explanation: string;
  paragraph: number | null;
}

export interface ResultsParagraphFeedback {
  paragraph: number;
  comment: string;
  strengths: string[];
  improvements: string[];
}

export interface WritingEssayParagraph {
  paragraph: number;
  text: string;
  feedback: ResultsParagraphFeedback | null;
  corrections: ResultsInlineCorrection[];
}

export interface WritingTaskResult {
  questionId: string;
  prompt: string | null;
  taskNumber: number;
  status: WritingResponseStatus;
  essay: string;
  wordCount: number;
  taskBand: number | null;
  criteria: CriterionScore[];
  summary: string | null;
  vietnameseSummary: string | null;
  inlineCorrections: ResultsInlineCorrection[];
  paragraphFeedback: ResultsParagraphFeedback[];
  essayParagraphs: WritingEssayParagraph[];
  modelAnswer: string | null;
  feedbackLanguage: string;
  gradingMetadata?: unknown;
  /** Published teacher rationale, kept separate from the AI summary. */
  teacherFeedback?: string | null;
  teacherCriterionFeedback?: unknown;
}

export interface WritingResult {
  band: number | null;
  isComplete: boolean;
  anyPending: boolean;
  tasks: WritingTaskResult[];
}

export interface SpeakingPartResult {
  questionId: string;
  prompt: string | null;
  partNumber: number | null;
  status: WritingResponseStatus;
  transcript: string;
  band: number | null;
  criteria: CriterionScore[];
  summary: string | null;
  modelAnswer: string | null;
  pronunciationHeatmap: SpeakingPronunciationHeatmap | null;
  /** Signed (1h) URL of the learner's recording, or null when unavailable. */
  audioUrl: string | null;
  gradingMetadata?: unknown;
  /** Published teacher rationale, kept separate from the AI summary. */
  teacherFeedback?: string | null;
  teacherCriterionFeedback?: unknown;
}

export interface SpeakingResult {
  band: number | null;
  isComplete: boolean;
  anyPending: boolean;
  parts: SpeakingPartResult[];
}

export type PronunciationHeatmapLevel = "strong" | "watch" | "focus";

export interface SpeakingPronunciationHeatmapPhoneme {
  phoneme: string;
  accuracy: number;
  level: PronunciationHeatmapLevel;
}

export interface SpeakingPronunciationHeatmapWord {
  word: string;
  accuracy: number;
  errorType: string;
  level: PronunciationHeatmapLevel;
  phonemes: SpeakingPronunciationHeatmapPhoneme[];
}

export interface SpeakingPronunciationHeatmap {
  provider: string;
  locale: string;
  overall: {
    accuracy: number;
    fluency: number;
    completeness: number | null;
    prosody: number | null;
    pronunciation: number;
  } | null;
  words: SpeakingPronunciationHeatmapWord[];
}

export interface AttemptResultsViewModel {
  attemptId: string;
  testTitle: string;
  testSlug: string;
  module: IeltsModuleKey;
  attemptStatus: string;
  submittedAt: string | null;
  overall: OverallBandSummary;
  skills: SkillBandRow[];
  breakdowns: SkillBandBreakdown[];
  objective: ObjectiveReviewSection[];
  /** Question groups (shared banks / stimuli) referenced by `groupKey` on items. */
  groups: IeltsQuestionGroupView[];
  /** questionId → the learner's stored response envelope (objective questions only). */
  responses: IeltsResponseMap;
  writing: WritingResult | null;
  speaking: SpeakingResult | null;
}

export const SKILL_LABELS: Record<IeltsSkillKey, string> = {
  listening: "Listening",
  reading: "Reading",
  writing: "Writing",
  speaking: "Speaking",
};
