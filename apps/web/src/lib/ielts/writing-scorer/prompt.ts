/**
 * The IELTS Writing scorer prompt bundle (WS-3.1).
 *
 * Encodes the four official criteria (authoring spec §5) and forces strict JSON
 * matching {@link ieltsWritingModelOutputSchema}. Transparency by construction:
 * the model returns per-criterion bands + rationales + correction spans +
 * paragraph notes + a Band-9 rewrite; the deterministic task band, the
 * Task-2-weighted overall, and half-band rounding are computed by us in
 * `lib/scoring/ielts-writing` — never taken from the model as one opaque number.
 *
 * Pure (string-building only) + unit tested.
 */

import type { IeltsVisual } from "@/lib/api/ielts/visual";

/** General Training Task 1 letter brief (from `ielts_questions.metadata.letter`). */
export interface WritingScorerLetterBrief {
  recipient: string;
  register: string;
  bullets: string[];
}

/** Hand-authored reference material that grounds scoring + the model rewrite. */
export interface WritingScorerGrounding {
  /** The Band-9 model answer hand-authored for THIS question, if any. */
  questionModelAnswer: string | null;
  /** Per-criterion examiner notes for this question. */
  examinerNotes: string[];
  /** Band-9 exemplars of the same task type (other questions). */
  peerModelAnswers: string[];
}

export interface WritingScorerPromptParams {
  taskNumber: 1 | 2;
  taskType: string;
  questionPrompt: string;
  essay: string;
  wordCount: number;
  feedbackLanguage: "en" | "vi";
  grounding: WritingScorerGrounding;
  /** Approved, versioned rubric/exemplar context from the generic knowledge layer. */
  evidenceContext?: string;
  /** Authored Task 1 stimulus (chart / table / image / described), when any. */
  visual?: IeltsVisual | null;
  /** General Training Task 1 letter brief, when any. */
  letter?: WritingScorerLetterBrief | null;
}

const GENERAL_TASK1_TYPE = "writing_task1_general";

function taskAchievementLine(taskType: string): string {
  if (taskType === GENERAL_TASK1_TYPE) {
    return `- taskResponse (Task Achievement — General Training Task 1 letter): is the purpose of the letter stated clearly and early; is the tone/register consistent throughout and appropriate to the required register; are ALL bullet points in the brief covered and extended; and does it follow letter conventions (suitable greeting and closing)?`;
  }
  return `- taskResponse (${"Task Response (Task 2) / Task Achievement (Task 1)"}): does it fully address all parts of the task with a clear position (Task 2) or a clear overview + accurate key features (Task 1), and relevant, extended, well-supported ideas?`;
}

/** The four official criteria; Task Achievement is task-type specific. */
export function criteriaDescriptors(taskType: string): string {
  return `Score each of the four criteria 0-9 (half-bands allowed), applying the official 2024 public band descriptors:
${taskAchievementLine(taskType)}
- coherenceCohesion (Coherence & Cohesion): logical organization and progression, effective paragraphing, and natural — not mechanical or over-used — cohesive devices.
- lexicalResource (Lexical Resource): range, precision and collocation; less common vocabulary; accurate spelling and word formation.
- grammaticalRangeAccuracy (Grammatical Range & Accuracy): range of structures (simple and complex), the frequency and communicative effect of errors, and punctuation.`;
}

function pipeCell(value: unknown): string {
  return String(value ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ").trim();
}

function pipeTable(headers: string[], rows: string[][]): string {
  const width = Math.max(headers.length, ...rows.map((row) => row.length), 1);
  const pad = (row: string[]) =>
    [...row, ...Array<string>(Math.max(0, width - row.length)).fill("")];
  const line = (row: string[]) => `| ${pad(row).map(pipeCell).join(" | ")} |`;
  const head = headers.length > 0 ? headers : Array<string>(width).fill("");
  return [line(head), `| ${Array<string>(width).fill("---").join(" | ")} |`, ...rows.map(line)].join("\n");
}

/** Render the authored Task 1 visual as text the model can read. */
export function visualSection(visual: IeltsVisual | null | undefined): string {
  if (!visual) return "";
  let body: string;
  switch (visual.type) {
    case "table":
      body = `${visual.caption ? `${visual.caption}\n` : ""}${pipeTable(visual.headers, visual.rows)}`;
      break;
    case "chart": {
      const xKey = visual.xAxisKey ?? null;
      const headers = [xKey ?? "x", ...visual.series.map((series) => series.label)];
      const rows = visual.data.map((datum, index) => [
        xKey ? String(datum[xKey] ?? "") : String(index + 1),
        ...visual.series.map((series) => String(datum[series.dataKey] ?? "")),
      ]);
      body = [
        `Chart type: ${visual.chartType}${visual.title ? ` — ${visual.title}` : ""}`,
        `X axis: ${xKey ?? "(unlabelled)"}`,
        pipeTable(headers, rows),
        "Check every figure, trend and comparison the candidate states against this data; inaccurate or invented data counts against taskResponse (Task Achievement).",
      ].join("\n");
      break;
    }
    case "image":
      body = `Image (not viewable here): ${visual.alt}${visual.caption ? `\nCaption: ${visual.caption}` : ""}\nURL: ${visual.url}`;
      break;
    case "described":
      body = visual.description;
      break;
  }
  return `\nVISUAL (the data/stimulus the candidate had to describe)\n${body}\n`;
}

/** Render the General Training letter brief. */
export function letterSection(letter: WritingScorerLetterBrief | null | undefined): string {
  if (!letter) return "";
  return `\nLETTER BRIEF
Recipient: ${letter.recipient}
Required register: ${letter.register.replace(/_/g, "-")}
Bullet points the letter must cover:
${letter.bullets.map((bullet) => `- ${bullet}`).join("\n")}
`;
}

function jsonSkeleton(feedbackLanguage: "en" | "vi"): string {
  const vnLine =
    feedbackLanguage === "vi"
      ? `"vietnameseSummary": "<REQUIRED: a clear Vietnamese-language explanation of the result for a VN learner>"`
      : `"vietnameseSummary": "<optional Vietnamese-language explanation>"`;
  return `{
  "criteria": {
    "taskResponse": { "band": <number 0-9, e.g. 6.5>, "rationale": "<why this band, citing the descriptor evidence>" },
    "coherenceCohesion": { "band": <number 0-9>, "rationale": "<why>" },
    "lexicalResource": { "band": <number 0-9>, "rationale": "<why>" },
    "grammaticalRangeAccuracy": { "band": <number 0-9>, "rationale": "<why>" }
  },
  "overallSummary": "<2-4 sentence overall assessment>",
  "inlineCorrections": [
    { "original": "<verbatim text span from the essay>", "suggestion": "<corrected version>", "errorType": "grammar|lexical|cohesion|spelling|punctuation|task", "explanation": "<short reason>", "paragraph": <0-based paragraph index, optional> }
  ],
  "paragraphFeedback": [
    { "paragraph": <0-based index>, "comment": "<feedback on this paragraph>", "strengths": ["<...>"], "improvements": ["<...>"] }
  ],
  "modelAnswer": "<a full Band-9 rewrite of the candidate's essay answering the same prompt>",
  ${vnLine}
}`;
}

function groundingSection(grounding: WritingScorerGrounding): string {
  const parts: string[] = [];
  if (grounding.questionModelAnswer) {
    parts.push(
      `Hand-authored Band-9 model answer for this exact question (use as the calibration anchor and to inform — not copy — your rewrite):\n"""\n${grounding.questionModelAnswer}\n"""`,
    );
  }
  if (grounding.examinerNotes.length > 0) {
    parts.push(
      `Examiner notes for this question:\n${grounding.examinerNotes.map((note) => `- ${note}`).join("\n")}`,
    );
  }
  if (grounding.peerModelAnswers.length > 0) {
    parts.push(
      `Additional Band-9 exemplars of the same task type (style reference only):\n${grounding.peerModelAnswers
        .map((answer, index) => `Exemplar ${index + 1}:\n"""\n${answer}\n"""`)
        .join("\n\n")}`,
    );
  }
  return parts.length > 0
    ? `\nGROUNDING (hand-authored reference material)\n${parts.join("\n\n")}\n`
    : "";
}

export function buildWritingScorerPrompt(
  params: WritingScorerPromptParams,
): string {
  const minWords = params.taskNumber === 1 ? 150 : 250;
  const taskLabel =
    params.taskNumber === 1 ? "Writing Task 1" : "Writing Task 2";
  const underLength =
    params.wordCount < minWords
      ? ` The response is under the ${minWords}-word minimum (${params.wordCount} words); penalise length under taskResponse per the descriptors.`
      : "";

  return `You are a senior IELTS examiner scoring a candidate's ${taskLabel} response (task type: ${params.taskType}).

${criteriaDescriptors(params.taskType)}

TASK PROMPT
"""
${params.questionPrompt}
"""
${visualSection(params.visual)}${letterSection(params.letter)}
CANDIDATE RESPONSE (${params.wordCount} words; ${taskLabel} expects at least ${minWords} words).${underLength}
"""
${params.essay}
"""
${groundingSection(params.grounding)}${
    params.evidenceContext
      ? `\nAPPROVED IELTS KNOWLEDGE EVIDENCE\n${params.evidenceContext}\n`
      : ""
  }
INSTRUCTIONS
- Give an honest per-criterion band 0-9 (half-bands allowed) with a specific rationale for each. Be calibrated, not generous.
- Identify concrete inline corrections (verbatim error span -> suggestion) tagged by errorType, each with a short explanation.
- Give paragraph-level feedback.
- Write a Band-9 model rewrite ("modelAnswer") of the candidate's essay answering the same prompt.
- Do NOT output an overall band or the average of the criteria — the system computes the task band and the Task-2-weighted overall from your four sub-scores.
${
  params.feedbackLanguage === "vi"
    ? "- Write rationales/feedback in English, and provide a Vietnamese-language summary in vietnameseSummary (the learner is Vietnamese-first)."
    : "- You may optionally add a Vietnamese-language summary in vietnameseSummary."
}

Return ONLY a JSON object with exactly this shape (no markdown, no commentary):
${jsonSkeleton(params.feedbackLanguage)}`;
}
