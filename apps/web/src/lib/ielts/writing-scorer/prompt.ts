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
}

const CRITERIA_DESCRIPTORS = `Score each of the four criteria 0-9 (half-bands allowed), applying the official 2024 public band descriptors:
- taskResponse (${"Task Response (Task 2) / Task Achievement (Task 1)"}): does it fully address all parts of the task with a clear position (Task 2) or a clear overview + accurate key features (Task 1), and relevant, extended, well-supported ideas?
- coherenceCohesion (Coherence & Cohesion): logical organization and progression, effective paragraphing, and natural — not mechanical or over-used — cohesive devices.
- lexicalResource (Lexical Resource): range, precision and collocation; less common vocabulary; accurate spelling and word formation.
- grammaticalRangeAccuracy (Grammatical Range & Accuracy): range of structures (simple and complex), the frequency and communicative effect of errors, and punctuation.`;

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

${CRITERIA_DESCRIPTORS}

TASK PROMPT
"""
${params.questionPrompt}
"""

CANDIDATE RESPONSE (${params.wordCount} words; ${taskLabel} expects at least ${minWords} words).${underLength}
"""
${params.essay}
"""
${groundingSection(params.grounding)}
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
