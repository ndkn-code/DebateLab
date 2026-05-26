import type { DebateRound, PracticeLanguage } from "@/types";
import type {
  DebateReviewSpeaker,
  TranscriptAnnotation,
  TranscriptAnnotationMetadata,
} from "@/types/feedback";

export interface TranscriptAnnotationMatch extends TranscriptAnnotation {
  id: string;
  start: number | null;
  end: number | null;
  matchedText: string | null;
}

export type TranscriptAnnotationFilter =
  | "all"
  | TranscriptAnnotation["severity"];

export interface TranscriptChunk {
  id: string;
  start: number;
  end: number;
  text: string;
  timestampLabel: string | null;
}

export const TRANSCRIPT_ANNOTATION_ACCENTS: Record<string, string> = {
  stance: "#3E78EC",
  clarity: "#3E78EC",
  structure: "#3E78EC",
  logic: "#4D86F7",
  mechanism: "#4D86F7",
  weighing: "#4D86F7",
  rebuttal: "#F5B942",
  clash: "#F5B942",
  evidence: "#34C759",
  impact: "#34C759",
  delivery: "#7B61FF",
};

const VALID_TRANSCRIPT_ANNOTATION_TAGS = new Set<TranscriptAnnotation["tag"]>([
  "stance",
  "clarity",
  "mechanism",
  "evidence",
  "logic",
  "rebuttal",
  "clash",
  "weighing",
  "impact",
  "structure",
  "delivery",
]);

const TAG_ALIASES: Record<string, TranscriptAnnotation["tag"]> = {
  claim: "stance",
  argument: "logic",
  counterargument: "rebuttal",
  counter_argument: "rebuttal",
};

const FILLER_QUOTE_PATTERNS = [
  /^cảm ơn\b/i,
  /^kính thưa\b/i,
  /^xin kính chào\b/i,
  /^xin chào\b/i,
  /^thank you[.!?。]*$/i,
];

const STOPWORDS = new Set([
  "của",
  "và",
  "là",
  "thì",
  "mà",
  "này",
  "đó",
  "được",
  "trong",
  "với",
  "cho",
  "một",
  "các",
  "những",
  "rằng",
  "bạn",
  "đội",
  "phe",
  "cần",
  "nên",
  "phải",
  "this",
  "that",
  "with",
  "from",
  "your",
  "they",
  "have",
  "should",
]);

const HIGH_SIGNAL_TERMS = [
  "cơ chế",
  "tác động",
  "phản biện",
  "gánh nặng",
  "clash",
  "weigh",
  "weighing",
  "ngụy biện",
  "survival bias",
  "kẻ sống sót",
  "bằng chứng",
  "so sánh",
  "thế giới",
  "thiệt hại",
];

export function getTranscriptAnnotationAccent(tag: string) {
  return TRANSCRIPT_ANNOTATION_ACCENTS[tag] ?? TRANSCRIPT_ANNOTATION_ACCENTS.logic;
}

interface NormalizedTextMap {
  text: string;
  map: number[];
}

function normalizeWithMap(value: string): NormalizedTextMap {
  let text = "";
  const map: number[] = [];
  let previousWasSpace = true;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (/\s/.test(character)) {
      if (!previousWasSpace) {
        text += " ";
        map.push(index);
        previousWasSpace = true;
      }
      continue;
    }

    text += character.toLowerCase();
    map.push(index);
    previousWasSpace = false;
  }

  return {
    text: text.trim(),
    map,
  };
}

function findExactRange(transcript: string, quote: string) {
  const source = transcript.toLowerCase();
  const target = quote.trim().toLowerCase();
  const start = source.indexOf(target);
  if (start < 0) return null;

  return {
    start,
    end: start + quote.trim().length,
  };
}

function findLooseRange(transcript: string, quote: string) {
  const normalizedTranscript = normalizeWithMap(transcript);
  const normalizedQuote = normalizeWithMap(quote);
  if (!normalizedQuote.text) return null;

  const start = normalizedTranscript.text.indexOf(normalizedQuote.text);
  if (start < 0) return null;

  const endIndex = start + normalizedQuote.text.length - 1;
  const originalStart = normalizedTranscript.map[start];
  const originalEnd = normalizedTranscript.map[endIndex];

  if (originalStart == null || originalEnd == null) return null;

  return {
    start: originalStart,
    end: originalEnd + 1,
  };
}

function normalizeQuoteForQuality(value: string) {
  return value
    .toLowerCase()
    .replace(/[“”"'.!,?:;()[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripVietnameseDiacritics(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

function normalizeForSemanticMatch(value: string) {
  return stripVietnameseDiacritics(normalizeQuoteForQuality(value));
}

function normalizeAnnotationTag(value: unknown): TranscriptAnnotation["tag"] {
  if (typeof value !== "string") return "logic";
  const tag = value.trim().toLowerCase();
  const resolved = TAG_ALIASES[tag] ?? tag;
  return VALID_TRANSCRIPT_ANNOTATION_TAGS.has(resolved as TranscriptAnnotation["tag"])
    ? (resolved as TranscriptAnnotation["tag"])
    : "logic";
}

export function isLowSignalFeedbackQuote(quote: string) {
  const normalized = normalizeQuoteForQuality(quote);
  if (!normalized) return true;
  const words = normalized.split(" ").filter(Boolean);

  if (
    words.length <= 18 &&
    FILLER_QUOTE_PATTERNS.some((pattern) => pattern.test(quote.trim()))
  ) {
    return true;
  }

  if (words.length < 4) return true;

  return normalized.startsWith("hello vậy là rồi") && normalized.includes("không ghi âm được");
}

function isMotionOnlyQuote(quote: string, topic?: string | null) {
  if (!topic) return false;
  const normalizedQuote = normalizeForSemanticMatch(quote);
  const normalizedTopic = normalizeForSemanticMatch(topic);
  if (!normalizedQuote || !normalizedTopic) return false;
  if (normalizedQuote === normalizedTopic) return true;
  const quoteWords = normalizedQuote.split(" ").filter(Boolean);
  const topicWords = new Set(normalizedTopic.split(" ").filter(Boolean));
  if (quoteWords.length < 4 || quoteWords.length > topicWords.size + 3) {
    return false;
  }
  const topicWordHits = quoteWords.filter((word) => topicWords.has(word)).length;
  return topicWordHits / quoteWords.length >= 0.8;
}

function splitSentencesWithPosition(text: string) {
  const matches = text.matchAll(/[^.!?。！？\n]+[.!?。！？]?/g);
  return Array.from(matches)
    .map((match) => ({
      text: match[0].replace(/\s+/g, " ").trim(),
      start: match.index ?? 0,
    }))
    .filter((sentence) => sentence.text.length >= 18);
}

function extractKeywords(value: string) {
  const normalized = normalizeForSemanticMatch(value);
  const words = normalized
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 4 && !STOPWORDS.has(word));
  return Array.from(new Set(words)).slice(0, 18);
}

function containsAnySignal(text: string, signals: string[]) {
  const normalized = normalizeForSemanticMatch(text);
  return signals.some((signal) => normalized.includes(normalizeForSemanticMatch(signal)));
}

function createAnnotationSources(input: {
  transcript: string;
  rounds?: DebateRound[];
}) {
  const roundSources =
    input.rounds
      ?.map((round) => {
        const text = (round.transcript || round.aiResponse || "").trim();
        if (!text) return null;
        return {
          id: `round-${round.roundNumber}`,
          text,
          roundNumber: round.roundNumber,
          speaker: (round.type === "ai-rebuttal" ? "ai" : "user") as DebateReviewSpeaker,
        };
      })
      .filter(Boolean) ?? [];
  return [
    ...roundSources,
    input.transcript.trim()
      ? {
          id: "full-transcript",
          text: input.transcript,
          roundNumber: undefined,
          speaker: undefined,
        }
      : null,
  ].filter(Boolean) as Array<{
    id: string;
    text: string;
    roundNumber?: number;
    speaker?: DebateReviewSpeaker;
  }>;
}

function findAnnotationSource(
  sources: ReturnType<typeof createAnnotationSources>,
  annotation: TranscriptAnnotation
) {
  return (
    sources.find(
      (source) =>
        annotation.roundNumber != null &&
        source.roundNumber === annotation.roundNumber &&
        (!annotation.speaker || source.speaker === annotation.speaker)
    ) ??
    sources.find(
      (source) => annotation.speaker && source.speaker === annotation.speaker
    ) ??
    sources[0] ??
    null
  );
}

function findQuoteInSources(
  sources: ReturnType<typeof createAnnotationSources>,
  annotation: TranscriptAnnotation
) {
  return sources.find((source) => {
    if (annotation.roundNumber != null && source.roundNumber !== annotation.roundNumber) {
      return false;
    }
    if (annotation.speaker && source.speaker && source.speaker !== annotation.speaker) {
      return false;
    }
    return Boolean(
      findExactRange(source.text, annotation.quote) ??
        findLooseRange(source.text, annotation.quote)
    );
  });
}

function isSemanticallyConnected(
  annotation: TranscriptAnnotation,
  sourceText: string
) {
  const feedbackText = `${annotation.feedback} ${annotation.suggestion}`;
  const keywords = extractKeywords(feedbackText);
  if (keywords.length === 0) return true;
  const quoteAndContext = `${annotation.quote} ${sourceText}`;
  const keywordHits = keywords.filter((keyword) =>
    normalizeForSemanticMatch(quoteAndContext).includes(keyword)
  ).length;
  if (keywordHits >= Math.min(2, keywords.length)) return true;
  if (
    containsAnySignal(feedbackText, HIGH_SIGNAL_TERMS) &&
    !containsAnySignal(quoteAndContext, HIGH_SIGNAL_TERMS)
  ) {
    return false;
  }
  return keywordHits > 0;
}

function scoreCandidateSentence(
  sentence: string,
  annotation: TranscriptAnnotation
) {
  const normalized = normalizeForSemanticMatch(sentence);
  const feedbackText = `${annotation.feedback} ${annotation.suggestion}`;
  const keywords = extractKeywords(feedbackText);
  const keywordScore = keywords.reduce(
    (score, keyword) => score + (normalized.includes(keyword) ? 2 : 0),
    0
  );
  const signalScore = HIGH_SIGNAL_TERMS.reduce(
    (score, term) => score + (normalized.includes(normalizeForSemanticMatch(term)) ? 3 : 0),
    0
  );
  const numberScore = /\d|%/.test(sentence) ? 1 : 0;
  const length = sentence.split(/\s+/).length;
  const lengthScore = length >= 7 && length <= 45 ? 2 : 0;
  return keywordScore + signalScore + numberScore + lengthScore;
}

function reanchorAnnotation(
  annotation: TranscriptAnnotation,
  sources: ReturnType<typeof createAnnotationSources>,
  topic?: string | null
) {
  const source = findAnnotationSource(sources, annotation);
  if (!source) return null;
  const candidates = splitSentencesWithPosition(source.text)
    .filter((sentence) => !isLowSignalFeedbackQuote(sentence.text))
    .filter((sentence) => !isMotionOnlyQuote(sentence.text, topic))
    .map((sentence) => ({
      text: sentence.text.slice(0, 260),
      score: scoreCandidateSentence(sentence.text, annotation),
    }))
    .sort((a, b) => b.score - a.score);

  const best = candidates[0];
  if (!best || best.score < 2) return null;
  return {
    ...annotation,
    quote: best.text,
    roundNumber: annotation.roundNumber ?? source.roundNumber,
    speaker: annotation.speaker ?? source.speaker,
  };
}

function createFallbackAnnotations(input: {
  transcript: string;
  rounds?: DebateRound[];
  topic?: string | null;
  practiceLanguage?: PracticeLanguage;
  existingQuotes: Set<string>;
  needed: number;
}): TranscriptAnnotation[] {
  const vi = input.practiceLanguage === "vi";
  const sources = createAnnotationSources(input).filter((source) => source.speaker !== "ai");
  const candidates = sources.flatMap((source) =>
    splitSentencesWithPosition(source.text).map((sentence) => ({
      source,
      text: sentence.text.slice(0, 260),
      score:
        HIGH_SIGNAL_TERMS.reduce(
          (score, term) =>
            score + (normalizeForSemanticMatch(sentence.text).includes(normalizeForSemanticMatch(term)) ? 2 : 0),
          0
        ) +
        (/\d|%/.test(sentence.text) ? 2 : 0) +
        (sentence.text.split(/\s+/).length >= 8 ? 1 : 0),
    }))
  );

  return candidates
    .filter((candidate) => candidate.score >= 2)
    .filter((candidate) => !isLowSignalFeedbackQuote(candidate.text))
    .filter((candidate) => !isMotionOnlyQuote(candidate.text, input.topic))
    .filter((candidate) => !input.existingQuotes.has(normalizeQuoteForQuality(candidate.text)))
    .sort((a, b) => b.score - a.score)
    .slice(0, input.needed)
    .map((candidate, index) => ({
      quote: candidate.text,
      roundNumber: candidate.source.roundNumber,
      speaker: candidate.source.speaker ?? "user",
      tag: index % 2 === 0 ? "mechanism" : "clash",
      severity: "improvement",
      feedback: vi
        ? "Đây là đoạn lập luận có tín hiệu quan trọng, nhưng cần neo rõ hơn vào cơ chế, bằng chứng hoặc cân tác động."
        : "This is a high-signal argument, but it needs clearer mechanism, evidence, or weighing.",
      suggestion: vi
        ? "Hãy thêm một bước vì sao, nhóm nào chịu tác động, rồi so sánh trực tiếp với phản biện của đối phương."
        : "Add the why, identify the affected group, then compare directly against the opposing response.",
    }));
}

export function locateTranscriptAnnotations(
  transcript: string,
  annotations: TranscriptAnnotation[] | null | undefined
): TranscriptAnnotationMatch[] {
  if (!Array.isArray(annotations) || annotations.length === 0) return [];

  return annotations
    .filter((annotation) => annotation?.quote?.trim())
    .filter((annotation) => !isLowSignalFeedbackQuote(annotation.quote))
    .map((annotation, index) => {
      const quote = annotation.quote.trim();
      const range =
        findExactRange(transcript, quote) ?? findLooseRange(transcript, quote);

      return {
        ...annotation,
        quote,
        id: `${index}-${quote.slice(0, 24)}`,
        start: range?.start ?? null,
        end: range?.end ?? null,
        matchedText: range ? transcript.slice(range.start, range.end) : null,
      };
    });
}

export function normalizeTranscriptAnnotations(
  value: unknown
): TranscriptAnnotation[] {
  if (!Array.isArray(value)) return [];
  const seenQuotes = new Set<string>();

  return value
    .map((item): TranscriptAnnotation | null => {
      if (!item || typeof item !== "object") return null;
      const source = item as Record<string, unknown>;
      const quote = typeof source.quote === "string" ? source.quote.trim() : "";
      const feedback =
        typeof source.feedback === "string" ? source.feedback.trim() : "";
      const suggestion =
        typeof source.suggestion === "string" ? source.suggestion.trim() : "";

      if (!quote || !feedback || isLowSignalFeedbackQuote(quote)) return null;

      const normalizedQuote = normalizeQuoteForQuality(quote);
      if (seenQuotes.has(normalizedQuote)) return null;
      seenQuotes.add(normalizedQuote);

      const tag = normalizeAnnotationTag(source.tag);
      const severity =
        source.severity === "strength" ||
        source.severity === "improvement" ||
        source.severity === "warning"
          ? source.severity
          : "improvement";
      const roundNumber =
        typeof source.roundNumber === "number" &&
        Number.isFinite(source.roundNumber)
          ? source.roundNumber
          : undefined;
      const speaker =
        source.speaker === "user" || source.speaker === "ai"
          ? source.speaker
          : undefined;

      return {
        quote,
        roundNumber,
        speaker,
        tag,
        severity,
        feedback,
        suggestion,
      };
    })
    .filter(Boolean) as TranscriptAnnotation[];
}

export function normalizeTranscriptAnnotationsForFeedback(
  value: unknown,
  context: {
    transcript: string;
    topic?: string | null;
    rounds?: DebateRound[];
    practiceLanguage?: PracticeLanguage;
    depthTarget?: { minAnnotations?: number };
  }
): {
  annotations: TranscriptAnnotation[];
  metadata: TranscriptAnnotationMetadata;
} {
  const normalized = normalizeTranscriptAnnotations(value);
  const sources = createAnnotationSources(context);
  const accepted: TranscriptAnnotation[] = [];
  const rejectedReasons: string[] = [];
  let repairUsed = false;

  for (const annotation of normalized) {
    const matchedSource = findQuoteInSources(sources, annotation);
    const reason =
      isMotionOnlyQuote(annotation.quote, context.topic)
        ? "motion_only"
        : !matchedSource
          ? "unmatched_quote"
          : !isSemanticallyConnected(annotation, matchedSource.text)
            ? "semantic_disconnect"
            : null;

    if (!reason) {
      accepted.push(annotation);
      continue;
    }

    rejectedReasons.push(reason);
    const repaired = reanchorAnnotation(annotation, sources, context.topic);
    if (repaired) {
      repairUsed = true;
      accepted.push(repaired);
    }
  }

  const target = context.depthTarget?.minAnnotations ?? 0;
  const seenQuotes = new Set(accepted.map((annotation) => normalizeQuoteForQuality(annotation.quote)));
  const fallbackNeeded = Math.max(0, target - accepted.length);
  const maxDeterministicFallbacks = target >= 10 ? 3 : 2;
  const fallbackAnnotations =
    fallbackNeeded > 0
      ? createFallbackAnnotations({
          transcript: context.transcript,
          rounds: context.rounds,
          topic: context.topic,
          practiceLanguage: context.practiceLanguage,
          existingQuotes: seenQuotes,
          needed: Math.min(fallbackNeeded, maxDeterministicFallbacks),
        })
      : [];

  return {
    annotations: [...accepted, ...fallbackAnnotations],
    metadata: {
      acceptedCount: accepted.length + fallbackAnnotations.length,
      rejectedCount: rejectedReasons.length,
      repairUsed,
      fallbackUsed: fallbackAnnotations.length > 0,
      rejectedReasons,
    },
  };
}

export function formatTranscriptTimestamp(seconds: number): string {
  const normalizedSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(normalizedSeconds / 60);
  const remainingSeconds = normalizedSeconds % 60;

  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

export function estimateTranscriptTimestamp(
  start: number | null,
  transcriptLength: number,
  durationSeconds?: number | null
): string | null {
  if (
    typeof start !== "number" ||
    start < 0 ||
    transcriptLength <= 0 ||
    !durationSeconds ||
    durationSeconds <= 0
  ) {
    return null;
  }

  const ratio = Math.min(1, start / transcriptLength);
  return formatTranscriptTimestamp(ratio * durationSeconds);
}

export function filterTranscriptAnnotationMatches(
  matches: TranscriptAnnotationMatch[],
  filter: TranscriptAnnotationFilter
): TranscriptAnnotationMatch[] {
  if (filter === "all") return matches;
  return matches.filter((match) => match.severity === filter);
}

function createTranscriptChunk(
  transcript: string,
  start: number,
  end: number,
  durationSeconds?: number | null
): TranscriptChunk | null {
  const text = transcript.slice(start, end);
  const firstVisible = text.search(/\S/);
  if (firstVisible < 0) return null;

  const normalizedStart = start + firstVisible;
  let normalizedEnd = end;
  while (normalizedEnd > normalizedStart && /\s/.test(transcript[normalizedEnd - 1])) {
    normalizedEnd -= 1;
  }

  return {
    id: `chunk-${normalizedStart}-${normalizedEnd}`,
    start: normalizedStart,
    end: normalizedEnd,
    text: transcript.slice(normalizedStart, normalizedEnd),
    timestampLabel: estimateTranscriptTimestamp(
      normalizedStart,
      transcript.length,
      durationSeconds
    ),
  };
}

export function buildTranscriptChunks(
  transcript: string,
  durationSeconds?: number | null,
  options?: {
    maxSentences?: number;
    maxCharacters?: number;
  }
): TranscriptChunk[] {
  const trimmed = transcript.trim();
  if (!trimmed) return [];

  const maxSentences = options?.maxSentences ?? 3;
  const maxCharacters = options?.maxCharacters ?? 520;
  const chunks: TranscriptChunk[] = [];
  const sentenceRegex = /[^.!?\n]+[.!?]+(?:[ \t]+|$)|[^\n]+(?:\n+|$)/g;
  const matches = [...transcript.matchAll(sentenceRegex)];
  const source =
    matches.length > 0
      ? matches.map((match) => ({
          text: match[0],
          index: match.index ?? 0,
        }))
      : [{ text: transcript, index: 0 }];

  let groupStart = source[0]?.index ?? 0;
  let groupEnd = groupStart;
  let groupText = "";
  let groupCount = 0;

  const pushGroup = () => {
    const chunk = createTranscriptChunk(
      transcript,
      groupStart,
      groupEnd,
      durationSeconds
    );
    if (chunk) chunks.push(chunk);
    groupText = "";
    groupCount = 0;
  };

  source.forEach((sentence) => {
    if (!groupText) {
      groupStart = sentence.index;
    }

    groupText += sentence.text;
    groupEnd = sentence.index + sentence.text.length;
    groupCount += 1;

    const hasParagraphBreak = /\n{2,}/.test(sentence.text);
    const hitSentenceLimit = groupCount >= maxSentences;
    const hitCharacterLimit = groupText.trim().length >= maxCharacters;

    if (hasParagraphBreak || hitSentenceLimit || hitCharacterLimit) {
      pushGroup();
    }
  });

  if (groupText) {
    pushGroup();
  }

  return chunks.length > 0
    ? chunks
    : [
        {
          id: "chunk-all",
          start: 0,
          end: transcript.length,
          text: transcript,
          timestampLabel: durationSeconds ? formatTranscriptTimestamp(0) : null,
        },
      ];
}
