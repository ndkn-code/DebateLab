/**
 * Authoring shape for the IELTS format-showcase fixtures (self-contained so
 * content can be written independently of the importer).
 *
 * One `AuthoredQuestion` == one numbered question == one `ielts_questions` row.
 * Set-level stimulus (shared bank, summary text with blanks, table/flow-chart,
 * image with hotspots) lives on an `AuthoredGroup`; members point at it with
 * `groupKey` and (optionally) `slot`.
 */

export type ShowcaseSkill = "listening" | "reading" | "writing" | "speaking";
export type ShowcaseAccent = "uk" | "us";

export type ShowcaseQuestionType =
  | "mcq_single"
  | "mcq_multi"
  | "true_false_notgiven"
  | "yes_no_notgiven"
  | "matching_headings"
  | "matching_information"
  | "matching_features"
  | "matching_sentence_endings"
  | "sentence_completion"
  | "summary_completion"
  | "note_table_form_flowchart_completion"
  | "short_answer"
  | "diagram_label"
  | "map_plan_label"
  | "writing_task1_academic"
  | "writing_task1_general"
  | "writing_task2_essay"
  | "speaking_part1"
  | "speaking_part2_cuecard"
  | "speaking_part3";

export interface AuthoredAsset {
  /** Referenced by `AuthoredGroup.stimulus.assetImportId`. */
  importId: string;
  /** File name under scripts/ielts/format-showcase/assets/. */
  file: string;
  contentType: "image/svg+xml" | "image/png";
  alt: string;
}

export interface AuthoredPassage {
  importId: string;
  orderIndex: number;
  title: string;
  /** Plain text; paragraphs separated by a blank line. Lettered paragraphs start with "A\n". */
  body: string;
  genre: string;
}

export interface AuthoredListeningSection {
  importId: string;
  sectionNumber: 1 | 2 | 3 | 4;
  title: string;
  /**
   * Script in the TTS format used by lib/ielts/listening-audio/script-parser:
   * one line per turn, `Speaker Name: text`. Narration lines use `Narrator:`.
   */
  script: string;
  accent: ShowcaseAccent;
  speakers: Array<{ name: string; accent: ShowcaseAccent }>;
}

/** A bank option: bare string (auto label A, B, … / i, ii, …) or explicit. */
export type AuthoredBankOption = string | { id: string; label?: string; text: string };

export type AuthoredGroupStimulus =
  | { kind: "text"; heading?: string; body: string } // __BLANK_<slot>__ markers
  | {
      kind: "table";
      caption?: string;
      headers: string[];
      rows: Array<Array<string | { gap: string; label?: string }>>;
    }
  | { kind: "flowchart"; title?: string; direction?: "down" | "right"; steps: Array<{ text: string }> }
  | {
      kind: "image";
      assetImportId: string;
      alt: string;
      caption?: string;
      hotspots: Array<{ slot: string; x: number; y: number; label?: string }>;
    };

export interface AuthoredGroup {
  importId: string;
  /** ^[a-z0-9][a-z0-9_-]*$ — unique within the test. */
  groupKey: string;
  skill: ShowcaseSkill;
  passageImportId?: string;
  sectionImportId?: string;
  orderIndex: number;
  /** e.g. "Questions 1–6". */
  title: string;
  instructions: string;
  stimulus?: AuthoredGroupStimulus;
  bank?: AuthoredBankOption[];
  /** "NB You may use any letter more than once." */
  bankReuse?: boolean;
  answerMode?: "select" | "text";
  /** Members are graded set-wise ("IN ANY ORDER"). */
  anyOrder?: boolean;
}

export interface AuthoredCueCard {
  topic: string;
  bullets: string[];
  closing?: string;
  prepSeconds?: number;
  speakSeconds?: number;
}

export interface AuthoredLetter {
  recipient: string;
  register: "formal" | "semi_formal" | "informal";
  bullets: string[];
}

export type AuthoredVisual =
  | { type: "image"; assetImportId: string; alt: string; caption?: string }
  | { type: "table"; headers: string[]; rows: string[][]; caption?: string }
  | {
      type: "chart";
      chartType: "line" | "bar" | "area" | "pie";
      title?: string;
      xAxisKey?: string;
      data: Array<Record<string, string | number>>;
      series: Array<{ dataKey: string; label: string }>;
    }
  | { type: "described"; description: string };

export interface AuthoredQuestion {
  importId: string;
  skill: ShowcaseSkill;
  questionType: ShowcaseQuestionType;
  /** 0-based within the skill, in test order. */
  orderIndex: number;
  /**
   * The question stem. For sentence completion use `__BLANK_0__` for the
   * blank; for group-stimulus completion the prompt is a short label such as
   * "Question 7" and the blank lives in the group stimulus.
   */
  prompt: string;
  passageImportId?: string;
  sectionImportId?: string;
  groupKey?: string;
  /** Shown above the first question of a run when there is no group. */
  groupInstructions?: string;
  /** Which stimulus blank / hotspot this row answers (defaults to position in group). */
  slot?: string;
  /** Per-question options (MCQ); matching questions use the group bank instead. */
  options?: AuthoredBankOption[];
  /** mcq_multi: how many to choose. */
  selectCount?: number;
  /** mcq_multi row occupying N question numbers ("21–22"); maxPoints must equal it. */
  numberSpan?: number;
  maxPoints?: number;
  wordLimit?: number;
  /** "ONE WORD AND/OR A NUMBER". */
  allowNumber?: boolean;
  /**
   * Objective key. Select-mode answers use the option id (bank id or "A"…);
   * text answers are the canonical string, with `/` alternatives allowed
   * ("roof-top/rooftop"). Multi-select is an array of option ids.
   */
  correctAnswer?: string | string[];
  /** Extra accepted spellings/forms. */
  acceptVariants?: string[];
  explanationEn: string;
  explanationVi: string;
  /** Verbatim substring of the script/passage that justifies the key (objective only). */
  support?: string;
  /** Writing/Speaking only. */
  visual?: AuthoredVisual;
  cueCard?: AuthoredCueCard;
  letter?: AuthoredLetter;
  modelAnswer?: string;
  examinerNotes?: Record<string, string>;
  /**
   * For the verify script: learner inputs that MUST be accepted / rejected by
   * the marking upgrades (articles, number words, hyphen/space, "/" alternatives,
   * allowNumber). Points are per question (0 or maxPoints unless partial).
   */
  markingCases?: Array<{ input: string | string[]; expectedPoints: number; note: string }>;
}

export interface AuthoredTest {
  slug: string;
  title: string;
  description: string;
  module: "academic" | "general_training";
  kind: "full_mock" | "skill_set";
  /** Required for skill_set tests. */
  skill?: ShowcaseSkill;
  /** ielts_tests.metadata.band_conversion_key. */
  bandConversionKey: string;
  timeLimitSeconds: number;
  assets: AuthoredAsset[];
  passages: AuthoredPassage[];
  listeningSections: AuthoredListeningSection[];
  groups: AuthoredGroup[];
  questions: AuthoredQuestion[];
}
