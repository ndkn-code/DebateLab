/**
 * The IELTS Speaking scorer prompt bundle (WS-3.2).
 *
 * Encodes the four official criteria (authoring spec §5: Fluency & Coherence,
 * Lexical Resource, Grammatical Range & Accuracy, Pronunciation) and forces
 * strict JSON matching {@link ieltsSpeakingModelOutputSchema}. Transparency by
 * construction: the model returns per-criterion bands + rationales + the
 * verbatim transcript excerpts where marks were lost; the deterministic Speaking
 * band (mean of 4, half-band rounded) is computed by us in
 * `lib/scoring/ielts-speaking` — never taken from the model as one opaque
 * number. The transcript is ASR-derived, so the prompt flags that Pronunciation
 * is judged cautiously from text unless an Azure phoneme signal (WS-3.3) is
 * present. Pure (string-building only) + unit tested.
 */
import type { SpeakingPronunciationSignal } from "./phoneme-contract";

/** Hand-authored reference material that grounds scoring. */
export interface SpeakingScorerGrounding {
  /** A hand-authored Band-9 sample answer for THIS question, if any. */
  questionSampleAnswer: string | null;
  /** Per-criterion examiner notes for this question. */
  examinerNotes: string[];
  /** Band-9 sample answers of the same part type (style reference). */
  peerSampleAnswers: string[];
}

export interface SpeakingScorerPromptParams {
  partNumber: 1 | 2 | 3;
  questionType: string;
  questionPrompt: string;
  /** Part 2 cue-card bullets, when present. */
  cueCardBullets?: string[];
  transcript: string;
  wordCount: number;
  /** Audio duration (seconds), when known — informs speech-rate judgement. */
  durationSeconds?: number | null;
  /** ASR caveats surfaced by the STT layer (low confidence, no speech, …). */
  sttWarnings?: string[];
  feedbackLanguage: "en" | "vi";
  grounding: SpeakingScorerGrounding;
  /** Azure phoneme signal (WS-3.3) when present; else Pronunciation is text-only. */
  pronunciation?: SpeakingPronunciationSignal | null;
}

const PART_CONTEXT: Record<1 | 2 | 3, string> = {
  1: "Part 1 (Introduction & Interview): short personal Q&A on familiar topics. Expect concise but extended answers, not one-word replies.",
  2: "Part 2 (Long turn / cue card): a 1-2 minute monologue from a cue card after 1 minute of prep. Reward sustained, organised, on-topic speech that covers the bullets.",
  3: "Part 3 (Two-way discussion): abstract discussion tied to the Part 2 topic. Reward developed, speculative, well-supported answers.",
};

function criteriaDescriptors(hasPhonemeSignal: boolean): string {
  const pron = hasPhonemeSignal
    ? "pronunciation (Pronunciation): individual sounds, word + sentence stress, intonation, and intelligibility. An automated phoneme assessment is provided below — weight it together with the transcript."
    : "pronunciation (Pronunciation): individual sounds, word + sentence stress, intonation, and intelligibility. No phoneme analysis is available, so judge conservatively from the transcript + ASR signals and avoid over-penalising what may be transcription noise.";
  return `Score each of the four criteria 0-9 (half-bands allowed), applying the official public band descriptors (each criterion weighted 25%):
- fluencyCoherence (Fluency & Coherence): speech rate + continuity, the amount/type of hesitation (content- vs language-related), self-correction/repetition, and how logically ideas connect and extend (range of cohesive devices/discourse markers).
- lexicalResource (Lexical Resource): range and precision of vocabulary, paraphrase, collocation, and idiomatic/topic-appropriate usage.
- grammaticalRangeAccuracy (Grammatical Range & Accuracy): range of structures (simple AND complex), and the frequency + communicative effect of errors.
- ${pron}`;
}

function transcriptionCaveat(sttWarnings: string[] | undefined): string {
  const base =
    "The transcript was produced by automatic speech recognition. Treat odd spellings, missing punctuation, or filler markers as possible ASR artifacts rather than candidate errors when judging Lexical Resource and Grammar.";
  if (!sttWarnings || sttWarnings.length === 0) return base;
  return `${base}\nThe STT layer flagged: ${sttWarnings.join(", ")}.`;
}

function speechRateLine(params: SpeakingScorerPromptParams): string {
  if (!params.durationSeconds || params.durationSeconds <= 0) {
    return `Transcript word count: ${params.wordCount}.`;
  }
  const wpm = Math.round((params.wordCount / params.durationSeconds) * 60);
  return `Transcript word count: ${params.wordCount}; spoken duration ≈ ${Math.round(params.durationSeconds)}s (≈ ${wpm} words/min) — use this for the Fluency pace judgement.`;
}

function cueCardSection(bullets: string[] | undefined): string {
  if (!bullets || bullets.length === 0) return "";
  return `\nCUE CARD BULLETS (the candidate should address these):\n${bullets
    .map((bullet) => `- ${bullet}`)
    .join("\n")}\n`;
}

function pronunciationSection(
  signal: SpeakingPronunciationSignal | null | undefined,
): string {
  if (!signal) return "";
  const scores = [
    ["overall", signal.pronunciationScore],
    ["accuracy", signal.accuracyScore],
    ["fluency", signal.fluencyScore],
    ["completeness", signal.completenessScore],
    ["prosody", signal.prosodyScore],
  ]
    .filter(([, value]) => value != null)
    .map(([label, value]) => `${label} ${value}/100`)
    .join(", ");
  const words =
    signal.mispronouncedWords.length > 0
      ? `\nFlagged words: ${signal.mispronouncedWords.join(", ")}.`
      : "";
  return `\nPHONEME ASSESSMENT (automated, Azure Speech — 0-100 scale; map onto the 0-9 Pronunciation band):\n${scores || "no aggregate scores"}.${words}\n`;
}

function groundingSection(grounding: SpeakingScorerGrounding): string {
  const parts: string[] = [];
  if (grounding.questionSampleAnswer) {
    parts.push(
      `Hand-authored Band-9 sample answer for this exact question (calibration anchor):\n"""\n${grounding.questionSampleAnswer}\n"""`,
    );
  }
  if (grounding.examinerNotes.length > 0) {
    parts.push(
      `Examiner notes for this question:\n${grounding.examinerNotes
        .map((note) => `- ${note}`)
        .join("\n")}`,
    );
  }
  if (grounding.peerSampleAnswers.length > 0) {
    parts.push(
      `Additional Band-9 sample answers of the same part type (style reference only):\n${grounding.peerSampleAnswers
        .map((answer, index) => `Sample ${index + 1}:\n"""\n${answer}\n"""`)
        .join("\n\n")}`,
    );
  }
  return parts.length > 0
    ? `\nGROUNDING (hand-authored reference material)\n${parts.join("\n\n")}\n`
    : "";
}

function jsonSkeleton(feedbackLanguage: "en" | "vi"): string {
  const vnLine =
    feedbackLanguage === "vi"
      ? `"vietnameseSummary": "<REQUIRED: a clear Vietnamese-language explanation of the result for a VN learner>"`
      : `"vietnameseSummary": "<optional Vietnamese-language explanation>"`;
  return `{
  "criteria": {
    "fluencyCoherence": { "band": <number 0-9, e.g. 6.5>, "rationale": "<why this band, citing transcript evidence>" },
    "lexicalResource": { "band": <number 0-9>, "rationale": "<why>" },
    "grammaticalRangeAccuracy": { "band": <number 0-9>, "rationale": "<why>" },
    "pronunciation": { "band": <number 0-9>, "rationale": "<why>" }
  },
  "overallSummary": "<2-4 sentence overall assessment>",
  "strengths": ["<concrete strength>"],
  "improvements": ["<concrete lever to reach the next band>"],
  "excerptFeedback": [
    { "excerpt": "<verbatim span from the transcript where marks were lost>", "criterion": "fluencyCoherence|lexicalResource|grammaticalRangeAccuracy|pronunciation", "issue": "<what went wrong>", "suggestion": "<a stronger way to say it>" }
  ],
  ${vnLine}
}`;
}

export function buildSpeakingScorerPrompt(
  params: SpeakingScorerPromptParams,
): string {
  const hasPhonemeSignal = Boolean(params.pronunciation);
  const vnInstruction =
    params.feedbackLanguage === "vi"
      ? "- Write rationales/feedback in English, and provide a Vietnamese-language summary in vietnameseSummary (the learner is Vietnamese-first)."
      : "- You may optionally add a Vietnamese-language summary in vietnameseSummary.";

  return `You are a senior IELTS examiner scoring a candidate's spoken Speaking response (question type: ${params.questionType}).

${PART_CONTEXT[params.partNumber]}

${criteriaDescriptors(hasPhonemeSignal)}

QUESTION / PROMPT
"""
${params.questionPrompt}
"""
${cueCardSection(params.cueCardBullets)}
CANDIDATE TRANSCRIPT
"""
${params.transcript}
"""
${speechRateLine(params)}
${transcriptionCaveat(params.sttWarnings)}
${pronunciationSection(params.pronunciation)}${groundingSection(params.grounding)}
INSTRUCTIONS
- Give an honest per-criterion band 0-9 (half-bands allowed) with a specific rationale for each. Be calibrated, not generous.
- Point to the exact lines where marks were lost: each excerptFeedback item must quote a verbatim transcript span, name the criterion it hurts, the issue, and a stronger alternative.
- Give overall strengths + the highest-leverage improvements to reach the next band.
- Do NOT output an overall band or the average of the criteria — the system computes the Speaking band (mean of the four, rounded to the nearest half-band) from your four sub-scores.
${vnInstruction}

Return ONLY a JSON object with exactly this shape (no markdown, no commentary):
${jsonSkeleton(params.feedbackLanguage)}`;
}
