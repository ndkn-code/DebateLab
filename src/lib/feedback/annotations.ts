import type { TranscriptAnnotation } from "@/types/feedback";

export interface TranscriptAnnotationMatch extends TranscriptAnnotation {
  id: string;
  start: number | null;
  end: number | null;
  matchedText: string | null;
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

export function locateTranscriptAnnotations(
  transcript: string,
  annotations: TranscriptAnnotation[] | null | undefined
): TranscriptAnnotationMatch[] {
  if (!Array.isArray(annotations) || annotations.length === 0) return [];

  return annotations
    .filter((annotation) => annotation?.quote?.trim())
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

  return value
    .map((item): TranscriptAnnotation | null => {
      if (!item || typeof item !== "object") return null;
      const source = item as Record<string, unknown>;
      const quote = typeof source.quote === "string" ? source.quote.trim() : "";
      const feedback =
        typeof source.feedback === "string" ? source.feedback.trim() : "";
      const suggestion =
        typeof source.suggestion === "string" ? source.suggestion.trim() : "";

      if (!quote || !feedback) return null;

      const tag =
        typeof source.tag === "string" && source.tag.trim()
          ? source.tag.trim()
          : "logic";
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

      return {
        quote,
        roundNumber,
        tag: tag as TranscriptAnnotation["tag"],
        severity,
        feedback,
        suggestion,
      };
    })
    .filter(Boolean) as TranscriptAnnotation[];
}
