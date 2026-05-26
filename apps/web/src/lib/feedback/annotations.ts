import type { TranscriptAnnotation } from "@/types/feedback";

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
