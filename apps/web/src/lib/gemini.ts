import { GoogleGenerativeAI } from "@google/generative-ai";
import type { DebateScore, TranscriptAnnotation } from "@/types/feedback";
import type {
  DebateMemory,
  DebateDuelJudgment,
  DebateRound,
  MotionBrief,
  PracticeLanguage,
  PracticeTrack,
} from "@/types";
import {
  getDuelJudgeProvider,
  getPracticeFeedbackProvider,
  getProviderLabel,
} from "@/lib/ai/provider-selection";
import type { AiQualityTelemetry } from "@/lib/ai/quality-model";
import type { PracticeTranscriptionArtifact } from "@thinkfy/shared/practice";
import { buildAnalysisPrompt, buildDuelJudgmentPrompt } from "./prompts";
import {
  buildFuzzyEvidenceHintBlock,
  buildTruongTeenJudgingPromptAddendum,
  shouldUseTruongTeenPrompt,
} from "./truong-teen/debate-dna";
import { normalizeDebateDuelClashLinks } from "./debate-duels/clash-links";
import {
  normalizeDebateClashLinks,
  normalizeDebateVerdict,
} from "./feedback/debate-review";
import { normalizeTranscriptAnnotations } from "./feedback/annotations";
import {
  getDebateFeedbackDepthTarget,
  isFeedbackBelowDepthTarget,
  normalizeScoreRationale,
} from "./feedback/depth";
import { needsVietnameseProseRepair } from "./feedback/language-repair";
import { getPostHogServer } from "./posthog-server";
import { buildSttJudgeGuardrailBlock } from "./stt/prompt";

let genAI: GoogleGenerativeAI | null = null;

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }
  genAI ??= new GoogleGenerativeAI(apiKey);
  return genAI;
}

async function loadDeepSeekChatCompletion() {
  return (await import("@/lib/ai/deepseek")).createDeepSeekChatCompletion;
}

function buildCompactDeepSeekAnalysisPrompt(params: {
  transcript: string;
  topic: string;
  side: "proposition" | "opposition";
  speechType: string;
  timeLimit: number;
  actualDuration: number;
  practiceTrack?: PracticeTrack;
  practiceLanguage?: PracticeLanguage;
  isFullRound?: boolean;
  rounds?: DebateRound[];
  motionBrief?: MotionBrief;
  debateMemory?: DebateMemory | null;
  corpusContext?: string;
  transcription?: PracticeTranscriptionArtifact | null;
}, verdictDraft?: unknown) {
  if (params.practiceTrack === "speaking") {
    return buildAnalysisPrompt(params);
  }

  const language =
    params.practiceLanguage === "vi"
      ? "Write all user-facing prose in natural Vietnamese with diacritics. Keep JSON keys and enum literals in English."
      : "Write all user-facing prose in natural English. Keep JSON keys and enum literals in English.";
  const useTruongTeenPrompt = shouldUseTruongTeenPrompt({
    practiceLanguage: params.practiceLanguage,
    practiceTrack: params.practiceTrack ?? "debate",
  });
  const rounds = params.rounds?.length
    ? params.rounds
        .map((round) => {
          const speaker = round.type === "ai-rebuttal" ? "ai" : "user";
          const text = round.transcript || round.aiResponse || "";
          return `[${round.roundNumber}. ${round.label} | ${speaker}]\n${text}`;
        })
        .join("\n\n")
    : params.transcript;
  const truongTeenJudgingContext = useTruongTeenPrompt
    ? buildTruongTeenJudgingPromptAddendum()
    : "";
  const evidenceHintContext = useTruongTeenPrompt
    ? buildFuzzyEvidenceHintBlock([
        params.transcript,
        ...(params.rounds?.map(
          (round) => round.transcript || round.aiResponse || ""
        ) ?? []),
      ])
    : "";
  const motionBrief = params.motionBrief
    ? `Key terms: ${params.motionBrief.keyTerms.join("; ")}
Scope: ${params.motionBrief.scope}
Proposition burden: ${params.motionBrief.propositionBurden}
Opposition burden: ${params.motionBrief.oppositionBurden}
Model note: ${params.motionBrief.modelClarification}`
    : "No motion brief provided.";
  const debateMemory = params.debateMemory
    ? `AI side: ${params.debateMemory.aiSide}
Student side: ${params.debateMemory.studentSide}
AI model/policy: ${params.debateMemory.policyModel}
Prior AI claims: ${params.debateMemory.priorAiClaims.join("; ") || "none"}
Active clashes: ${params.debateMemory.activeClashes.join("; ") || "none"}
Dropped claims: ${params.debateMemory.droppedClaims.join("; ") || "none"}`
    : "No debate memory provided.";
  const sttGuardrail = buildSttJudgeGuardrailBlock(params.transcription);

  return `You are Thinkfy's strict debate feedback engine.

## Task
Judge the student's debate performance and return one valid JSON object only.
Practice format: Trường Teen-style 1v1 practice debate. Use WSDC-style principles for clash, mechanism, weighing, and impact.
Motion: ${params.topic}
Student side: ${params.side}
Speech type: ${params.speechType}
Full round: ${Boolean(params.isFullRound)}
Time setting: ${params.timeLimit} minutes
Actual duration: ${params.actualDuration} seconds
${language}
${sttGuardrail}
${truongTeenJudgingContext}
${params.corpusContext ?? ""}

## Motion Brief
${motionBrief}

## Debate Memory
${debateMemory}

## Transcript
${rounds}
${evidenceHintContext}

## Judge Verdict To Preserve
${verdictDraft ? JSON.stringify(verdictDraft) : "No prior verdict draft."}

## Scoring Calibration
- Score the student/user only. The AI may win the debate while the student still receives a fair skill score.
- If the student loses because of repetition, weak evidence, unclear structure, or failure to answer the main clash, totalScore should usually be below 65.
- Content above 25/40 requires mechanisms, examples, and weighing.
- Structure above 17/25 requires clear development across speeches, not repeated claims.
- Language above 18/25 requires mostly clear wording despite speech-to-text errors.
- Persuasion above 7/10 requires direct comparison of worlds and why the student's side wins.
- Do not reward sympathy for the student's side unless the speech proves it.
- If a Judge Verdict draft is provided, preserve its winner, confidence, totalScore, category score totals, and deciding logic unless it violates the numeric schema.

## Required JSON Shape
{
  "content": {"score": 0-40, "claimClarity": 0-10, "evidenceSupport": 0-10, "logicCoherence": 0-10, "counterArgument": 0-10},
  "structure": {"score": 0-25, "introduction": 0-8, "bodyOrganization": 0-9, "conclusion": 0-8},
  "language": {"score": 0-25, "vocabulary": 0-8, "grammar": 0-8, "fluency": 0-9},
  "persuasion": {"score": 0-10, "audienceAwareness": 0-5, "impactfulness": 0-5},
  "totalScore": sum of the four category scores,
  "overallBand": "Novice" | "Developing" | "Competent" | "Proficient" | "Expert",
  "summary": "2-4 sentence judge summary",
  "strengths": ["3 specific strengths"],
  "improvements": ["3 specific improvements"],
  "sampleArguments": ["2 improved argument examples"],
  "practiceTrack": "debate",
  "practiceLanguage": "${params.practiceLanguage ?? "en"}",
  "caseSummary": "student case in one sentence",
  "stanceFeedback": "stance and burden feedback",
  "argumentBreakdowns": [
    {"name": "argument/clash name", "summary": "what happened", "whatWorked": "specific", "missingLayer": "specific", "betterVersion": "stronger version"}
  ],
  "missingLayers": ["3 missing layers"],
  "weighingFeedback": "how the student weighed or failed to weigh",
  "clashFeedback": "how the student handled direct clash",
  "strongerRebuilds": ["2 stronger rebuilds"],
  "transcriptAnnotations": [
    {"quote": "exact short quote from transcript", "roundNumber": 1, "speaker": "user" | "ai", "tag": "stance|clarity|mechanism|evidence|logic|rebuttal|clash|weighing|impact|structure|delivery", "severity": "strength|improvement|warning", "feedback": "judge read", "suggestion": "specific next step"}
  ],
  "debateVerdict": {"winner": "user" | "ai" | "tie", "confidence": 0-1, "summary": "why", "decidingReasons": ["3 reasons"], "nextMove": "next drill"},
  "clashLinks": [
    {"id": "clash-1", "sourceRoundNumber": 1, "sourceSpeaker": "user" | "ai", "responseRoundNumber": 2 or null, "responseSpeaker": "user" | "ai" or null, "sourceQuote": "exact quote", "responseQuote": "exact quote or null", "outcome": "answered|dropped|misanswered|turned|weighed", "judgeRead": "what the judge thinks", "suggestion": "how to improve", "tag": "clash|rebuttal|weighing|logic|evidence"}
  ],
  "scoreRationale": {
    "overall": "strict rationale",
    "content": {"score": 0-40, "maxScore": 40, "rationale": "why", "whyNotHigher": "cap reason", "nextStep": "next action"},
    "structure": {"score": 0-25, "maxScore": 25, "rationale": "why", "whyNotHigher": "cap reason", "nextStep": "next action"},
    "language": {"score": 0-25, "maxScore": 25, "rationale": "why", "whyNotHigher": "cap reason", "nextStep": "next action"},
    "persuasion": {"score": 0-10, "maxScore": 10, "rationale": "why", "whyNotHigher": "cap reason", "nextStep": "next action"}
  },
  "detailedFeedback": {"contentFeedback": "specific", "structureFeedback": "specific", "languageFeedback": "specific", "persuasionFeedback": "specific"}
}

For full rounds, include at least 3 argumentBreakdowns, 4 transcriptAnnotations, and 3 clashLinks. Use exact transcript quotes only. JSON only.`;
}

function buildDeepSeekVerdictPrompt(params: {
  transcript: string;
  topic: string;
  side: "proposition" | "opposition";
  speechType: string;
  actualDuration: number;
  practiceLanguage?: PracticeLanguage;
  isFullRound?: boolean;
  rounds?: DebateRound[];
  motionBrief?: MotionBrief;
  debateMemory?: DebateMemory | null;
  corpusContext?: string;
  transcription?: PracticeTranscriptionArtifact | null;
}) {
  const language =
    params.practiceLanguage === "vi"
      ? "Write Vietnamese prose with diacritics."
      : "Write English prose.";
  const useTruongTeenPrompt = shouldUseTruongTeenPrompt({
    practiceLanguage: params.practiceLanguage,
    practiceTrack: "debate",
  });
  const rounds = params.rounds?.length
    ? params.rounds
        .map((round) => {
          const speaker = round.type === "ai-rebuttal" ? "ai" : "user";
          const text = round.transcript || round.aiResponse || "";
          return `[${round.roundNumber}. ${round.label} | ${speaker}]\n${text}`;
        })
        .join("\n\n")
    : params.transcript;
  const truongTeenJudgingContext = useTruongTeenPrompt
    ? buildTruongTeenJudgingPromptAddendum()
    : "";
  const evidenceHintContext = useTruongTeenPrompt
    ? buildFuzzyEvidenceHintBlock([
        params.transcript,
        ...(params.rounds?.map(
          (round) => round.transcript || round.aiResponse || ""
        ) ?? []),
      ])
    : "";
  const motionBrief = params.motionBrief
    ? `Scope: ${params.motionBrief.scope}
Proposition burden: ${params.motionBrief.propositionBurden}
Opposition burden: ${params.motionBrief.oppositionBurden}
Model note: ${params.motionBrief.modelClarification}`
    : "No motion brief provided.";
  const debateMemory = params.debateMemory
    ? `AI side: ${params.debateMemory.aiSide}
Student side: ${params.debateMemory.studentSide}
Active clashes: ${params.debateMemory.activeClashes.join("; ") || "none"}`
    : "No debate memory provided.";
  const sttGuardrail = buildSttJudgeGuardrailBlock(params.transcription);

  return `You are a strict debate judge. Think carefully, then return compact JSON only.
${language}
${sttGuardrail}

Motion: ${params.topic}
Student side: ${params.side}
Format: Trường Teen-style 1v1 practice debate; use WSDC-style clash, weighing, and burden analysis.
Full round: ${Boolean(params.isFullRound)}
Speech type: ${params.speechType}
Actual duration: ${params.actualDuration} seconds
${truongTeenJudgingContext}
${params.corpusContext ?? ""}

Motion brief:
${motionBrief}

Debate memory:
${debateMemory}

Transcript:
${rounds}
${evidenceHintContext}

Calibration:
- Judge the debate, but score the student/user only.
- If the user repeats claims, lacks evidence, or misses the main clash, totalScore is usually below 65.
- If the student mainly lists pressure, tutoring, fear of mistakes, or personal experience but does not prove that rote memorization causes those harms, the student has not met the burden.
- If the AI/opponent distinguishes "memorization as foundation" from "exam pressure" and the student does not directly defeat that distinction, the AI/opponent usually wins the main clash.
- Without external evidence, concrete mechanisms, and direct weighing, cap content at 24/40 and totalScore at 64 even if the topic is emotionally persuasive.
- Content above 25/40 requires mechanisms, examples, and weighing.
- Structure above 17/25 requires development across speeches.
- Persuasion above 7/10 requires direct world comparison and clear reason the student's side wins.

Return this JSON:
{
  "winner": "user" | "ai" | "tie",
  "confidence": 0-1,
  "totalScore": 0-100,
  "overallBand": "Novice" | "Developing" | "Competent" | "Proficient" | "Expert",
  "summary": "2-3 sentence strict judge read",
  "decidingReasons": ["3 reasons"],
  "categoryScores": {
    "content": {"score": 0-40, "rationale": "why"},
    "structure": {"score": 0-25, "rationale": "why"},
    "language": {"score": 0-25, "rationale": "why"},
    "persuasion": {"score": 0-10, "rationale": "why"}
  },
  "strengths": ["3 strengths"],
  "improvements": ["3 improvements"],
  "clashAnalysis": [
    {"clash": "clash name", "winner": "user" | "ai" | "tie", "judgeRead": "why"}
  ],
  "nextMove": "one concrete drill"
}`;
}

function parseDeepSeekJsonObject(text: string) {
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Invalid response: could not find JSON in DeepSeek output");
    }
    return JSON.parse(jsonMatch[0]) as Record<string, unknown>;
  }
}

async function parseDeepSeekJsonObjectWithRetry(
  generateText: (prompt: string) => Promise<string>,
  prompt: string,
  text: string
) {
  try {
    return parseDeepSeekJsonObject(text);
  } catch (error) {
    const retryPrompt = `${prompt}

## JSON Regeneration Instruction
Your previous response could not be parsed as valid JSON: ${error instanceof Error ? error.message : "Malformed JSON"}.

Previous response:
${text.slice(0, 6000)}

Return the same compact verdict JSON again as valid JSON only. No Markdown fences, comments, trailing commas, or prose outside the JSON object.`;
    return parseDeepSeekJsonObject(await generateText(retryPrompt));
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readText(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function hasVietnameseDiacritics(value: string) {
  return /[ăâđêôơưáàảãạắằẳẵặấầẩẫậéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/i.test(
    value
  );
}

function readLocalizedText(value: unknown, fallback: string, vi: boolean) {
  const text = readText(value, fallback);
  return vi && !hasVietnameseDiacritics(text) ? fallback : text;
}

function readTextArray(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) return fallback;
  const strings = value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
  return strings.length > 0 ? strings : fallback;
}

function readLocalizedTextArray(value: unknown, fallback: string[], vi: boolean) {
  const strings = readTextArray(value, fallback);
  return vi && strings.every((item) => !hasVietnameseDiacritics(item))
    ? fallback
    : strings;
}

function readScoreValue(value: unknown, fallback: number, max: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(max, Math.round(value)))
    : fallback;
}

function deriveOverallBand(totalScore: number): DebateScore["overallBand"] {
  if (totalScore >= 85) return "Expert";
  if (totalScore >= 70) return "Proficient";
  if (totalScore >= 55) return "Competent";
  if (totalScore >= 40) return "Developing";
  return "Novice";
}

function splitScore(score: number, buckets: number[], maxes: number[]) {
  const total = buckets.reduce((sum, value) => sum + value, 0) || 1;
  return buckets.map((weight, index) =>
    Math.max(0, Math.min(maxes[index], Math.round((score * weight) / total)))
  );
}

function getTranscriptQuoteSeeds(params: {
  transcript: string;
  rounds?: DebateRound[];
}) {
  const fromRounds =
    params.rounds
      ?.map((round) => ({
        quote: (round.transcript || round.aiResponse || "").trim(),
        roundNumber: round.roundNumber,
        speaker: round.type === "ai-rebuttal" ? "ai" : "user",
      }))
      .filter((item) => item.quote.length > 0) ?? [];

  if (fromRounds.length > 0) {
    return fromRounds.map((item) => ({
      ...item,
      quote: item.quote.split(/(?<=[.!?。])\s+/)[0]?.slice(0, 220) || item.quote.slice(0, 220),
    }));
  }

  const sentences =
    params.transcript
      .replace(/\s+/g, " ")
      .match(/(?:\[[^\]]+\]\s*)?[^.!?。]+[.!?。]?/g)
      ?.map((quote, index) => ({
        quote: quote.trim().slice(0, 220),
        roundNumber: index + 1,
        speaker: quote.includes("[AI") ? "ai" : "user",
      }))
      .filter((item) => item.quote.length >= 20) ?? [];

  return sentences.slice(0, 6);
}

function buildDebateScoreFromDeepSeekVerdict(
  params: {
    transcript: string;
    topic: string;
    side: "proposition" | "opposition";
    practiceLanguage?: PracticeLanguage;
    rounds?: DebateRound[];
  },
  verdictDraft: Record<string, unknown>
): DebateScore {
  const vi = params.practiceLanguage === "vi";
  const categoryScores = asRecord(verdictDraft.categoryScores);
  const contentDraft = asRecord(categoryScores.content);
  const structureDraft = asRecord(categoryScores.structure);
  const languageDraft = asRecord(categoryScores.language);
  const persuasionDraft = asRecord(categoryScores.persuasion);

  const contentScore = readScoreValue(contentDraft.score, 23, 40);
  const structureScore = readScoreValue(structureDraft.score, 15, 25);
  const languageScore = readScoreValue(languageDraft.score, 17, 25);
  const persuasionScore = readScoreValue(persuasionDraft.score, 6, 10);
  const fallbackTotal =
    contentScore + structureScore + languageScore + persuasionScore;
  const totalScore = readScoreValue(verdictDraft.totalScore, fallbackTotal, 100);
  const [claimClarity, evidenceSupport, logicCoherence, counterArgument] =
    splitScore(contentScore, [3, 2, 3, 2], [10, 10, 10, 10]);
  const [introduction, bodyOrganization, conclusion] = splitScore(
    structureScore,
    [2, 4, 2],
    [8, 9, 8]
  );
  const [vocabulary, grammar, fluency] = splitScore(
    languageScore,
    [3, 2, 3],
    [8, 8, 9]
  );
  const [audienceAwareness, impactfulness] = splitScore(
    persuasionScore,
    [1, 1],
    [5, 5]
  );

  const defaultStrengths = vi
    ? ["Nêu đúng vấn đề áp lực học tập", "Có ví dụ gần với trải nghiệm học sinh", "Giữ lập trường nhất quán"]
    : ["Names the core pressure issue", "Uses relatable student examples", "Maintains a consistent stance"];
  const defaultImprovements = vi
    ? ["Định nghĩa rõ hơn thế nào là quá chú trọng", "Thêm bằng chứng cụ thể", "So sánh trực tiếp hơn với thế giới của phe đối lập"]
    : ["Define the excessive burden more clearly", "Add specific evidence", "Compare more directly against the opposition world"];
  const strengths = readLocalizedTextArray(verdictDraft.strengths, defaultStrengths, vi).slice(0, 3);
  const improvements = readLocalizedTextArray(verdictDraft.improvements, defaultImprovements, vi).slice(0, 3);
  const decidingReasons = readLocalizedTextArray(verdictDraft.decidingReasons, improvements, vi).slice(0, 3);
  const clashAnalysis = Array.isArray(verdictDraft.clashAnalysis)
    ? verdictDraft.clashAnalysis.map(asRecord).slice(0, 3)
    : [];
  const quoteSeeds = getTranscriptQuoteSeeds(params);
  const summary = readLocalizedText(
    verdictDraft.summary,
    vi
      ? "Bài nói có vấn đề rõ nhưng cần cơ chế, bằng chứng và so sánh clash cụ thể hơn."
      : "The speech has a clear concern but needs stronger mechanisms, evidence, and clash comparison.",
    vi
  );
  const nextMove = readLocalizedText(
    verdictDraft.nextMove,
    vi
      ? "Viết lại một clash chính theo cấu trúc claim, mechanism, weighing, impact."
      : "Rewrite one main clash using claim, mechanism, weighing, and impact.",
    vi
  );

  const argumentBreakdowns = (clashAnalysis.length ? clashAnalysis : decidingReasons.map((reason) => ({ clash: reason, judgeRead: reason }))).map(
    (clash, index) => ({
      name: readText(clash.clash, vi ? `Clash ${index + 1}` : `Clash ${index + 1}`),
      summary: readLocalizedText(clash.judgeRead, decidingReasons[index] ?? summary, vi),
      whatWorked: strengths[index % strengths.length],
      missingLayer: improvements[index % improvements.length],
      betterVersion: vi
        ? `Biến ý này thành cơ chế rõ: vì sao nó xảy ra, ai bị ảnh hưởng, và tại sao nó quan trọng hơn phản biện của đối thủ.`
        : `Turn this into a clear mechanism: why it happens, who is affected, and why it matters more than the opponent's response.`,
    })
  );

  const transcriptAnnotations = quoteSeeds.slice(0, 4).map((seed, index) => ({
    quote: seed.quote,
    roundNumber: seed.roundNumber,
    speaker: seed.speaker as "user" | "ai",
    tag: (index % 2 === 0 ? "claim" : "clash") as TranscriptAnnotation["tag"],
    severity: (seed.speaker === "user" && index < 2
      ? "strength"
      : "improvement") as TranscriptAnnotation["severity"],
    feedback:
      seed.speaker === "user"
        ? strengths[index % strengths.length]
        : vi
          ? "Đây là phản biện quan trọng mà người học cần trả lời trực tiếp hơn."
          : "This is an important response the learner needs to answer more directly.",
    suggestion: improvements[index % improvements.length],
  }));

  const clashLinks = (clashAnalysis.length ? clashAnalysis : argumentBreakdowns).map(
    (clash, index) => {
      const source = quoteSeeds[index % Math.max(quoteSeeds.length, 1)];
      const response = quoteSeeds[(index + 1) % Math.max(quoteSeeds.length, 1)];
      return {
        id: `clash-${index + 1}`,
        sourceRoundNumber: source?.roundNumber ?? index + 1,
        sourceSpeaker: (source?.speaker ?? "user") as "user" | "ai",
        responseRoundNumber: response?.roundNumber ?? null,
        responseSpeaker: (response?.speaker ?? null) as "user" | "ai" | null,
        sourceQuote: source?.quote ?? params.transcript.slice(0, 160),
        responseQuote: response?.quote ?? null,
        outcome: "misanswered" as const,
        judgeRead: readLocalizedText(asRecord(clash).judgeRead, decidingReasons[index] ?? summary, vi),
        suggestion: improvements[index % improvements.length],
        tag: "clash" as const,
      };
    }
  );

  return {
    content: {
      score: contentScore,
      claimClarity,
      evidenceSupport,
      logicCoherence,
      counterArgument,
    },
    structure: {
      score: structureScore,
      introduction,
      bodyOrganization,
      conclusion,
    },
    language: {
      score: languageScore,
      vocabulary,
      grammar,
      fluency,
    },
    persuasion: {
      score: persuasionScore,
      audienceAwareness,
      impactfulness,
    },
    totalScore,
    overallBand: deriveOverallBand(totalScore),
    summary,
    strengths,
    improvements,
    sampleArguments: improvements.map((improvement) =>
      vi
        ? `Thay vì chỉ khẳng định, hãy nói: ${improvement}, rồi nối sang tác động và so sánh với phe đối lập.`
        : `Instead of only asserting the point, say: ${improvement}, then connect it to impact and compare against the opposition.`
    ),
    practiceTrack: "debate",
    practiceLanguage: params.practiceLanguage ?? "en",
    caseSummary: vi
      ? `Người học bảo vệ phe ${params.side} trong motion "${params.topic}".`
      : `The learner defended the ${params.side} side on "${params.topic}".`,
    stanceFeedback: vi
      ? "Lập trường rõ, nhưng cần chứng minh gánh nặng bằng cơ chế và bằng chứng cụ thể hơn."
      : "The stance is clear, but the burden needs stronger mechanisms and concrete evidence.",
    argumentBreakdowns,
    missingLayers: improvements,
    weighingFeedback: vi
      ? "Phần cân đo còn thiếu: cần giải thích tại sao tác hại hoặc lợi ích của phe mình quan trọng hơn phản biện của đối thủ."
      : "Weighing is still thin: explain why your side's harm or benefit matters more than the opponent's answer.",
    clashFeedback: summary,
    strongerRebuilds: sampleRebuilds(vi, improvements),
    transcriptAnnotations,
    debateVerdict: {
      winner:
        verdictDraft.winner === "user" ||
        verdictDraft.winner === "ai" ||
        verdictDraft.winner === "tie"
          ? verdictDraft.winner
          : "tie",
      confidence:
        typeof verdictDraft.confidence === "number"
          ? Math.max(0, Math.min(1, verdictDraft.confidence))
          : 0.65,
      summary,
      decidingReasons,
      nextMove,
    },
    clashLinks,
    scoreRationale: {
      overall: summary,
      content: buildScoreRationaleCategory(contentScore, 40, contentDraft, improvements[0], vi),
      structure: buildScoreRationaleCategory(structureScore, 25, structureDraft, improvements[1] ?? improvements[0], vi),
      language: buildScoreRationaleCategory(languageScore, 25, languageDraft, improvements[2] ?? improvements[0], vi),
      persuasion: buildScoreRationaleCategory(persuasionScore, 10, persuasionDraft, improvements[0], vi),
    },
    detailedFeedback: {
      contentFeedback: readLocalizedText(contentDraft.rationale, summary, vi),
      structureFeedback: readLocalizedText(structureDraft.rationale, improvements[1] ?? summary, vi),
      languageFeedback: readLocalizedText(languageDraft.rationale, improvements[2] ?? summary, vi),
      persuasionFeedback: readLocalizedText(persuasionDraft.rationale, improvements[0] ?? summary, vi),
    },
  };
}

function sampleRebuilds(vi: boolean, improvements: string[]) {
  return improvements.slice(0, 2).map((improvement) =>
    vi
      ? `Rebuild: ${improvement}. Sau đó thêm ví dụ cụ thể, giải thích cơ chế, và kết bằng câu so sánh vì sao phe mình thắng clash.`
      : `Rebuild: ${improvement}. Then add a concrete example, explain the mechanism, and end with a comparison showing why your side wins the clash.`
  );
}

function buildScoreRationaleCategory(
  score: number,
  maxScore: number,
  draft: Record<string, unknown>,
  nextStep: string,
  vi: boolean
) {
  const rationale = readLocalizedText(
    draft.rationale,
    vi
      ? "Điểm phản ánh chất lượng hiện tại của lập luận trong bài."
      : "The score reflects the current quality of the argument.",
    vi
  );
  return {
    score,
    maxScore,
    rationale,
    whyNotHigher: vi
      ? "Chưa đủ cơ chế, bằng chứng hoặc cân đo để đạt mức cao hơn."
      : "It lacks enough mechanism, evidence, or weighing for the next band.",
    nextStep,
  };
}

type AnalyzeDebateParams = {
  transcript: string;
  topic: string;
  side: "proposition" | "opposition";
  speechType: string;
  timeLimit: number;
  actualDuration: number;
  practiceTrack?: PracticeTrack;
  practiceLanguage?: PracticeLanguage;
  isFullRound?: boolean;
  rounds?: DebateRound[];
  motionBrief?: MotionBrief;
  debateMemory?: DebateMemory | null;
  corpusContext?: string;
  transcription?: PracticeTranscriptionArtifact | null;
};

type AiTelemetryCallback = (telemetry: AiQualityTelemetry) => void | Promise<void>;

async function emitAiTelemetry(
  onTelemetry: AiTelemetryCallback | undefined,
  telemetry: AiQualityTelemetry
) {
  if (!onTelemetry) return;
  await onTelemetry(telemetry);
}

export async function analyzeDebate(
  params: AnalyzeDebateParams,
  userId?: string,
  onTelemetry?: AiTelemetryCallback
): Promise<DebateScore> {
  const provider = getPracticeFeedbackProvider(params.practiceTrack ?? "debate");
  let fallbackFromDeepSeek = false;

  if (provider === "deepseek") {
    try {
      return await analyzeDebateWithDeepSeek(params, userId, onTelemetry);
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.warn(
          process.env.DEEPSEEK_ANALYSIS_FALLBACK === "gemini"
            ? "DeepSeek analysis failed; falling back to Gemini:"
            : "DeepSeek analysis failed:",
          error instanceof Error ? error.message : error
        );
      }
      if (process.env.DEEPSEEK_ANALYSIS_FALLBACK !== "gemini") {
        throw error;
      }
      fallbackFromDeepSeek = true;
    }
  }

  return analyzeDebateWithGemini(params, userId, onTelemetry, fallbackFromDeepSeek);
}

async function analyzeDebateWithGemini(
  params: AnalyzeDebateParams,
  userId?: string,
  onTelemetry?: AiTelemetryCallback,
  fallbackUsed = false
): Promise<DebateScore> {
  const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const model = getGeminiClient().getGenerativeModel({
    model: modelName,
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.3,
      maxOutputTokens:
        params.practiceTrack !== "speaking" && params.isFullRound ? 12000 : 4096,
    },
  });

  const prompt = buildAnalysisPrompt(params);
  const startTime = Date.now();
  const result = await model.generateContent(prompt);
  const latency = Date.now() - startTime;
  const text = result.response.text();

  if (userId) {
    const usage = result.response.usageMetadata;
    getPostHogServer().capture({
      distinctId: userId,
      event: "$ai_generation",
      properties: {
        $ai_provider: "google",
        $ai_model: modelName,
        $ai_input_tokens: usage?.promptTokenCount,
        $ai_output_tokens: usage?.candidatesTokenCount,
        $ai_latency: latency,
        $ai_is_error: false,
        $ai_trace_id: crypto.randomUUID(),
        route: "/api/analyze",
      },
    });
  }
  await emitAiTelemetry(onTelemetry, {
    provider: "google",
    requestedProvider: getProviderLabel(getPracticeFeedbackProvider(params.practiceTrack ?? "debate")),
    model: modelName,
    latencyMs: latency,
    fallbackUsed,
    usage: {
      inputTokens: result.response.usageMetadata?.promptTokenCount,
      outputTokens: result.response.usageMetadata?.candidatesTokenCount,
    },
  });

  let parsed = await parseGeminiFeedbackWithRetry(model, prompt, text);

  // Validate essential fields exist
  if (
    typeof parsed.totalScore !== "number" ||
    !parsed.overallBand ||
    !parsed.content ||
    !parsed.structure ||
    !parsed.language ||
    !parsed.persuasion
  ) {
    throw new Error("Invalid response structure from Gemini");
  }

  parsed = normalizeDebateScore(parsed, params);

  const depthTarget = getDebateFeedbackDepthTarget({
    isFullRound: params.practiceTrack !== "speaking" && params.isFullRound,
    actualDuration: params.actualDuration,
    roundCount: params.rounds?.length,
  });

  if (
    params.practiceTrack !== "speaking" &&
    params.isFullRound &&
    isFeedbackBelowDepthTarget(parsed, depthTarget)
  ) {
    const repairPrompt = `${prompt}

## Existing Feedback To Repair
${JSON.stringify(parsed)}

## Repair Instruction
The existing feedback is too shallow for a full-round debate. Return the full JSON schema again, preserving valid scores when reasonable, but expand coverage to at least ${depthTarget.minArgumentBreakdowns} argumentBreakdowns, ${depthTarget.minAnnotations} transcriptAnnotations, ${depthTarget.minClashLinks} clashLinks, and a complete scoreRationale. Do not invent transcript quotes; use exact quotes from the transcript above.`;
    const repairResult = await model.generateContent(repairPrompt);
    parsed = normalizeDebateScore(
      await parseGeminiFeedbackWithRetry(
        model,
        repairPrompt,
        repairResult.response.text()
      ),
      params
    );
  }

  if (
    params.practiceLanguage === "vi" &&
    needsVietnameseProseRepair(parsed)
  ) {
    const languageRepairPrompt = `${prompt}

## Previous JSON With Language Violation
${JSON.stringify(parsed)}

## Vietnamese Repair Instruction
The previous JSON used English in user-facing prose even though the practice language is Vietnamese. Return the full JSON schema again.

Hard rules:
- Keep every schema key and enum literal in English exactly as specified.
- Keep numeric scores, round numbers, winner, confidence, tags, severities, speakers, outcomes, and ids unchanged unless a score is outside its allowed range.
- Keep exact transcript quote fields unchanged: quote, sourceQuote, and responseQuote must remain exact copied text.
- Rewrite every user-facing explanation in natural Vietnamese: summary, strengths, improvements, sampleArguments, case feedback, argumentBreakdowns text, missingLayers, weighingFeedback, clashFeedback, strongerRebuilds, detailedFeedback, debateVerdict prose, clashLinks judgeRead/suggestion, transcriptAnnotations feedback/suggestion, and scoreRationale prose.
- JSON only.`;
    const languageRepairResult = await model.generateContent(languageRepairPrompt);
    parsed = normalizeDebateScore(
      await parseGeminiFeedbackWithRetry(
        model,
        languageRepairPrompt,
        languageRepairResult.response.text()
      ),
      params
    );
  }

  return parsed;
}

async function analyzeDebateWithDeepSeek(
  params: AnalyzeDebateParams,
  userId?: string,
  onTelemetry?: AiTelemetryCallback
): Promise<DebateScore> {
  const createDeepSeekChatCompletion = await loadDeepSeekChatCompletion();
  const isDebateFeedback = params.practiceTrack !== "speaking";
  const verdictPrompt = isDebateFeedback
    ? buildDeepSeekVerdictPrompt(params)
    : null;
  const generateVerdictText = (nextPrompt: string) =>
    createDeepSeekChatCompletion({
      messages: [
        {
          role: "system",
          content:
            "You are Thinkfy's rigorous debate judge. Return compact valid JSON only.",
        },
        { role: "user", content: nextPrompt },
      ],
      thinking: { type: "disabled" },
      responseFormat: "json_object",
      maxTokens: 1800,
      userId,
      timeoutMs: 18000,
    }).then((retryResult) => retryResult.content);
  let verdictDraft: Record<string, unknown> | null = null;
  if (isDebateFeedback && verdictPrompt) {
    const verdictStart = Date.now();
    const verdictResult = await createDeepSeekChatCompletion({
              messages: [
                {
                  role: "system",
                  content:
                    "You are Thinkfy's rigorous debate judge. Return compact valid JSON only.",
                },
                { role: "user", content: verdictPrompt },
              ],
              thinking: { type: "enabled" },
              responseFormat: "json_object",
              maxTokens: 4096,
              userId,
              timeoutMs: 28000,
    });
    const verdictLatency = Date.now() - verdictStart;
    await emitAiTelemetry(onTelemetry, {
      provider: getProviderLabel("deepseek"),
      requestedProvider: getProviderLabel("deepseek"),
      model: verdictResult.model,
      latencyMs: verdictLatency,
      usage: {
        inputTokens: verdictResult.usage?.prompt_tokens,
        outputTokens: verdictResult.usage?.completion_tokens,
        totalTokens: verdictResult.usage?.total_tokens,
        cacheHitTokens: verdictResult.usage?.prompt_cache_hit_tokens,
        cacheMissTokens: verdictResult.usage?.prompt_cache_miss_tokens,
        reasoningTokens:
          verdictResult.usage?.completion_tokens_details?.reasoning_tokens,
      },
    });
    verdictDraft = await parseDeepSeekJsonObjectWithRetry(
      generateVerdictText,
      verdictPrompt,
      verdictResult.content
    );
  }

  if (isDebateFeedback && verdictDraft) {
    return normalizeDebateScore(
      buildDebateScoreFromDeepSeekVerdict(params, verdictDraft),
      params
    );
  }

  const prompt = buildCompactDeepSeekAnalysisPrompt(params, verdictDraft);
  const maxTokens =
    params.practiceTrack !== "speaking" && params.isFullRound ? 7000 : 4096;
  const thinking = { type: "disabled" } as const;
  const generateText = (nextPrompt: string) =>
    createDeepSeekChatCompletion({
      messages: [
        {
          role: "system",
          content:
            "You are Thinkfy's AI feedback engine. Return only valid JSON matching the requested schema.",
        },
        { role: "user", content: nextPrompt },
      ],
      thinking: { type: "disabled" },
      responseFormat: "json_object",
      maxTokens: Math.min(maxTokens, 4096),
      userId,
      timeoutMs: 30000,
    }).then((retryResult) => retryResult.content);

  const startTime = Date.now();
  const result = await createDeepSeekChatCompletion({
    messages: [
      {
        role: "system",
        content:
          "You are Thinkfy's AI feedback engine. Return only valid JSON matching the requested schema.",
      },
      { role: "user", content: prompt },
    ],
    thinking,
    responseFormat: "json_object",
    maxTokens,
    userId,
    timeoutMs: 24000,
  });
  const latency = Date.now() - startTime;

  if (userId) {
    const usage = result.usage;
    getPostHogServer().capture({
      distinctId: userId,
      event: "$ai_generation",
      properties: {
        $ai_provider: getProviderLabel("deepseek"),
        $ai_model: result.model,
        $ai_input_tokens: usage?.prompt_tokens,
        $ai_output_tokens: usage?.completion_tokens,
        $ai_cache_hit_tokens: usage?.prompt_cache_hit_tokens,
        $ai_cache_miss_tokens: usage?.prompt_cache_miss_tokens,
        $ai_reasoning_tokens: usage?.completion_tokens_details?.reasoning_tokens,
        $ai_latency: latency,
        $ai_is_error: false,
        $ai_trace_id: crypto.randomUUID(),
        route: "/api/analyze",
      },
    });
  }
  await emitAiTelemetry(onTelemetry, {
    provider: getProviderLabel("deepseek"),
    requestedProvider: getProviderLabel("deepseek"),
    model: result.model,
    latencyMs: latency,
    usage: {
      inputTokens: result.usage?.prompt_tokens,
      outputTokens: result.usage?.completion_tokens,
      totalTokens: result.usage?.total_tokens,
      cacheHitTokens: result.usage?.prompt_cache_hit_tokens,
      cacheMissTokens: result.usage?.prompt_cache_miss_tokens,
      reasoningTokens: result.usage?.completion_tokens_details?.reasoning_tokens,
    },
  });

  let parsed = await parseDeepSeekFeedbackWithRetry(
    generateText,
    prompt,
    result.content
  );

  if (
    typeof parsed.totalScore !== "number" ||
    !parsed.overallBand ||
    !parsed.content ||
    !parsed.structure ||
    !parsed.language ||
    !parsed.persuasion
  ) {
    throw new Error("Invalid response structure from DeepSeek");
  }

  parsed = normalizeDebateScore(parsed, params);

  const depthTarget = getDebateFeedbackDepthTarget({
    isFullRound: params.practiceTrack !== "speaking" && params.isFullRound,
    actualDuration: params.actualDuration,
    roundCount: params.rounds?.length,
  });

  const allowRepairPasses =
    process.env.DEEPSEEK_ENABLE_FEEDBACK_REPAIR === "true";

  if (
    allowRepairPasses &&
    params.practiceTrack !== "speaking" &&
    params.isFullRound &&
    isFeedbackBelowDepthTarget(parsed, depthTarget)
  ) {
    const repairPrompt = `${prompt}

## Existing Feedback To Repair
${JSON.stringify(parsed)}

## Repair Instruction
The existing feedback is too shallow for a full-round debate. Return the full JSON schema again, preserving valid scores when reasonable, but expand coverage to at least ${depthTarget.minArgumentBreakdowns} argumentBreakdowns, ${depthTarget.minAnnotations} transcriptAnnotations, ${depthTarget.minClashLinks} clashLinks, and a complete scoreRationale. Do not invent transcript quotes; use exact quotes from the transcript above.`;
    parsed = normalizeDebateScore(
      await parseDeepSeekFeedbackWithRetry(
        generateText,
        repairPrompt,
        await generateText(repairPrompt)
      ),
      params
    );
  }

  if (
    allowRepairPasses &&
    params.practiceLanguage === "vi" &&
    needsVietnameseProseRepair(parsed)
  ) {
    const languageRepairPrompt = `${prompt}

## Previous JSON With Language Violation
${JSON.stringify(parsed)}

## Vietnamese Repair Instruction
The previous JSON used English in user-facing prose even though the practice language is Vietnamese. Return the full JSON schema again.

Hard rules:
- Keep every schema key and enum literal in English exactly as specified.
- Keep numeric scores, round numbers, winner, confidence, tags, severities, speakers, outcomes, and ids unchanged unless a score is outside its allowed range.
- Keep exact transcript quote fields unchanged: quote, sourceQuote, and responseQuote must remain exact copied text.
- Rewrite every user-facing explanation in natural Vietnamese: summary, strengths, improvements, sampleArguments, case feedback, argumentBreakdowns text, missingLayers, weighingFeedback, clashFeedback, strongerRebuilds, detailedFeedback, debateVerdict prose, clashLinks judgeRead/suggestion, transcriptAnnotations feedback/suggestion, and scoreRationale prose.
- JSON only.`;
    parsed = normalizeDebateScore(
      await parseDeepSeekFeedbackWithRetry(
        generateText,
        languageRepairPrompt,
        await generateText(languageRepairPrompt)
      ),
      params
    );
  }

  return parsed;
}

function parseGeminiFeedback(text: string): DebateScore {
  try {
    return JSON.parse(text) as DebateScore;
  } catch {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Invalid response: could not find JSON in Gemini output");
    }
    try {
      return JSON.parse(jsonMatch[0]) as DebateScore;
    } catch {
      throw new Error("Invalid response: Gemini returned malformed JSON");
    }
  }
}

async function parseGeminiFeedbackWithRetry(
  model: {
    generateContent: (
      prompt: string
    ) => Promise<{ response: { text: () => string } }>;
  },
  prompt: string,
  text: string
): Promise<DebateScore> {
  try {
    return parseGeminiFeedback(text);
  } catch (error) {
    const retryPrompt = `${prompt}

## JSON Regeneration Instruction
Your previous response could not be parsed as valid JSON: ${error instanceof Error ? error.message : "Malformed JSON"}.
Return the full requested JSON schema again as valid JSON only.
Do not use Markdown fences, comments, trailing commas, unescaped newlines inside strings, or prose outside the JSON object.`;
    const retryResult = await model.generateContent(retryPrompt);
    return parseGeminiFeedback(retryResult.response.text());
  }
}

async function parseDeepSeekFeedbackWithRetry(
  generateText: (prompt: string) => Promise<string>,
  prompt: string,
  text: string
): Promise<DebateScore> {
  try {
    return parseGeminiFeedback(text);
  } catch (error) {
    const retryPrompt = `${prompt}

## JSON Regeneration Instruction
Your previous response could not be parsed as valid JSON: ${error instanceof Error ? error.message : "Malformed JSON"}.
Return the full requested JSON schema again as valid JSON only.
Do not use Markdown fences, comments, trailing commas, unescaped newlines inside strings, or prose outside the JSON object.`;
    return parseGeminiFeedback(await generateText(retryPrompt));
  }
}

function clampNumber(value: unknown, min: number, max: number, fallback = min) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(min, Math.min(max, value))
    : fallback;
}

function clampSectionScores(parsed: DebateScore) {
  parsed.content.claimClarity = clampNumber(parsed.content.claimClarity, 0, 10);
  parsed.content.evidenceSupport = clampNumber(parsed.content.evidenceSupport, 0, 10);
  parsed.content.logicCoherence = clampNumber(parsed.content.logicCoherence, 0, 10);
  parsed.content.counterArgument = clampNumber(parsed.content.counterArgument, 0, 10);
  parsed.content.score = clampNumber(parsed.content.score, 0, 40);

  parsed.structure.introduction = clampNumber(parsed.structure.introduction, 0, 8);
  parsed.structure.bodyOrganization = clampNumber(parsed.structure.bodyOrganization, 0, 9);
  parsed.structure.conclusion = clampNumber(parsed.structure.conclusion, 0, 8);
  parsed.structure.score = clampNumber(parsed.structure.score, 0, 25);

  parsed.language.vocabulary = clampNumber(parsed.language.vocabulary, 0, 8);
  parsed.language.grammar = clampNumber(parsed.language.grammar, 0, 9);
  parsed.language.fluency = clampNumber(parsed.language.fluency, 0, 8);
  parsed.language.score = clampNumber(parsed.language.score, 0, 25);

  parsed.persuasion.audienceAwareness = clampNumber(
    parsed.persuasion.audienceAwareness,
    0,
    5
  );
  parsed.persuasion.impactfulness = clampNumber(
    parsed.persuasion.impactfulness,
    0,
    5
  );
  parsed.persuasion.score = clampNumber(parsed.persuasion.score, 0, 10);

  const categoryTotal =
    parsed.content.score +
    parsed.structure.score +
    parsed.language.score +
    parsed.persuasion.score;
  parsed.totalScore = clampNumber(categoryTotal, 0, 100);
}

function normalizeDebateScore(
  parsed: DebateScore,
  params: {
    practiceTrack?: PracticeTrack;
    practiceLanguage?: PracticeLanguage;
  }
) {
  clampSectionScores(parsed);
  parsed.practiceTrack = parsed.practiceTrack ?? params.practiceTrack ?? "debate";
  parsed.practiceLanguage = parsed.practiceLanguage ?? params.practiceLanguage ?? "en";
  parsed.argumentBreakdowns = parsed.argumentBreakdowns ?? [];
  parsed.missingLayers = parsed.missingLayers ?? [];
  parsed.strongerRebuilds = parsed.strongerRebuilds ?? [];
  parsed.transcriptAnnotations = normalizeTranscriptAnnotations(
    parsed.transcriptAnnotations
  );
  parsed.debateVerdict = normalizeDebateVerdict(parsed.debateVerdict) ?? undefined;
  parsed.clashLinks = normalizeDebateClashLinks(parsed.clashLinks);
  parsed.scoreRationale = normalizeScoreRationale(parsed.scoreRationale, parsed);
  return parsed;
}

export async function judgeDebateDuel(params: {
  motion: string;
  topicCategory: string;
  practiceLanguage?: PracticeLanguage;
  participants: {
    proposition: { participantId: string | null; displayName: string };
    opposition: { participantId: string | null; displayName: string };
  };
  speeches: Array<{
    id: string;
    roundNumber: number;
    speechType: "opening" | "rebuttal";
    side: "proposition" | "opposition";
    label: string;
    transcript: string;
    durationSeconds: number;
    qualityFlags?: string[];
  }>;
}, userId?: string, onTelemetry?: AiTelemetryCallback): Promise<DebateDuelJudgment> {
  const provider = getDuelJudgeProvider();
  let fallbackFromDeepSeek = false;

  if (provider === "deepseek") {
    try {
      return await judgeDebateDuelWithDeepSeek(params, userId, onTelemetry);
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.warn(
          "DeepSeek duel judgment failed; falling back to Gemini:",
          error instanceof Error ? error.message : error
        );
      }
      fallbackFromDeepSeek = true;
    }
  }

  return judgeDebateDuelWithGemini(
    params,
    userId,
    onTelemetry,
    fallbackFromDeepSeek
  );
}

async function judgeDebateDuelWithGemini(params: {
  motion: string;
  topicCategory: string;
  practiceLanguage?: PracticeLanguage;
  participants: {
    proposition: { participantId: string | null; displayName: string };
    opposition: { participantId: string | null; displayName: string };
  };
  speeches: Array<{
    id: string;
    roundNumber: number;
    speechType: "opening" | "rebuttal";
    side: "proposition" | "opposition";
    label: string;
    transcript: string;
    durationSeconds: number;
    qualityFlags?: string[];
  }>;
}, userId?: string, onTelemetry?: AiTelemetryCallback, fallbackUsed = false): Promise<DebateDuelJudgment> {
  const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const model = getGeminiClient().getGenerativeModel({
    model: modelName,
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.2,
    },
  });

  const prompt = buildDuelJudgmentPrompt(params);
  const startTime = Date.now();
  const result = await model.generateContent(prompt);
  const latency = Date.now() - startTime;
  const text = result.response.text();

  if (userId) {
    const usage = result.response.usageMetadata;
    getPostHogServer().capture({
      distinctId: userId,
      event: "$ai_generation",
      properties: {
        $ai_provider: "google",
        $ai_model: modelName,
        $ai_input_tokens: usage?.promptTokenCount,
        $ai_output_tokens: usage?.candidatesTokenCount,
        $ai_latency: latency,
        $ai_is_error: false,
        $ai_trace_id: crypto.randomUUID(),
        route: "/api/debate-duels/judge",
      },
    });
  }
  await emitAiTelemetry(onTelemetry, {
    provider: "google",
    requestedProvider: getProviderLabel(getDuelJudgeProvider()),
    model: modelName,
    latencyMs: latency,
    fallbackUsed,
    usage: {
      inputTokens: result.response.usageMetadata?.promptTokenCount,
      outputTokens: result.response.usageMetadata?.candidatesTokenCount,
    },
  });

  let parsed: DebateDuelJudgment;
  try {
    parsed = JSON.parse(text) as DebateDuelJudgment;
  } catch {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Invalid response: could not find JSON in Gemini output");
    }
    parsed = JSON.parse(jsonMatch[0]) as DebateDuelJudgment;
  }

  if (!parsed.winnerSide || !parsed.comparativeBallot || !parsed.participantFeedback) {
    throw new Error("Invalid duel judgment structure from Gemini");
  }

  parsed.winnerParticipantId =
    parsed.winnerParticipantId ??
    (parsed.winnerSide === "proposition"
      ? params.participants.proposition.participantId
      : params.participants.opposition.participantId);
  parsed.model = parsed.model || modelName;
  parsed.judgedAt = parsed.judgedAt || new Date().toISOString();
  parsed.qualityWarnings = parsed.qualityWarnings ?? [];
  parsed.roundBreakdown = parsed.roundBreakdown ?? [];
  parsed.clashLinks = normalizeDebateDuelClashLinks(parsed.clashLinks);

  return parsed;
}

async function judgeDebateDuelWithDeepSeek(params: {
  motion: string;
  topicCategory: string;
  practiceLanguage?: PracticeLanguage;
  participants: {
    proposition: { participantId: string | null; displayName: string };
    opposition: { participantId: string | null; displayName: string };
  };
  speeches: Array<{
    id: string;
    roundNumber: number;
    speechType: "opening" | "rebuttal";
    side: "proposition" | "opposition";
    label: string;
    transcript: string;
    durationSeconds: number;
    qualityFlags?: string[];
  }>;
}, userId?: string, onTelemetry?: AiTelemetryCallback): Promise<DebateDuelJudgment> {
  const createDeepSeekChatCompletion = await loadDeepSeekChatCompletion();
  const prompt = buildDuelJudgmentPrompt(params);
  const startTime = Date.now();
  const result = await createDeepSeekChatCompletion({
    messages: [
      {
        role: "system",
        content:
          "You are Thinkfy's rigorous debate judge. Return only valid JSON matching the requested schema.",
      },
      { role: "user", content: prompt },
    ],
    thinking: { type: "enabled", reasoningEffort: "high" },
    responseFormat: "json_object",
    maxTokens: 8192,
    userId,
  });
  const latency = Date.now() - startTime;

  if (userId) {
    const usage = result.usage;
    getPostHogServer().capture({
      distinctId: userId,
      event: "$ai_generation",
      properties: {
        $ai_provider: getProviderLabel("deepseek"),
        $ai_model: result.model,
        $ai_input_tokens: usage?.prompt_tokens,
        $ai_output_tokens: usage?.completion_tokens,
        $ai_cache_hit_tokens: usage?.prompt_cache_hit_tokens,
        $ai_cache_miss_tokens: usage?.prompt_cache_miss_tokens,
        $ai_reasoning_tokens: usage?.completion_tokens_details?.reasoning_tokens,
        $ai_latency: latency,
        $ai_is_error: false,
        $ai_trace_id: crypto.randomUUID(),
        route: "/api/debate-duels/judge",
      },
    });
  }
  await emitAiTelemetry(onTelemetry, {
    provider: getProviderLabel("deepseek"),
    requestedProvider: getProviderLabel("deepseek"),
    model: result.model,
    latencyMs: latency,
    usage: {
      inputTokens: result.usage?.prompt_tokens,
      outputTokens: result.usage?.completion_tokens,
      totalTokens: result.usage?.total_tokens,
      cacheHitTokens: result.usage?.prompt_cache_hit_tokens,
      cacheMissTokens: result.usage?.prompt_cache_miss_tokens,
      reasoningTokens: result.usage?.completion_tokens_details?.reasoning_tokens,
    },
  });

  let parsed: DebateDuelJudgment;
  try {
    parsed = JSON.parse(result.content) as DebateDuelJudgment;
  } catch {
    const jsonMatch = result.content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Invalid response: could not find JSON in DeepSeek output");
    }
    parsed = JSON.parse(jsonMatch[0]) as DebateDuelJudgment;
  }

  if (!parsed.winnerSide || !parsed.comparativeBallot || !parsed.participantFeedback) {
    throw new Error("Invalid duel judgment structure from DeepSeek");
  }

  parsed.winnerParticipantId =
    parsed.winnerParticipantId ??
    (parsed.winnerSide === "proposition"
      ? params.participants.proposition.participantId
      : params.participants.opposition.participantId);
  parsed.model = parsed.model || result.model;
  parsed.judgedAt = parsed.judgedAt || new Date().toISOString();
  parsed.qualityWarnings = parsed.qualityWarnings ?? [];
  parsed.roundBreakdown = parsed.roundBreakdown ?? [];
  parsed.clashLinks = normalizeDebateDuelClashLinks(parsed.clashLinks);

  return parsed;
}
