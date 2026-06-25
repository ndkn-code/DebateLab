type SegmenterConstructor = new (
  locale: string | undefined,
  options: { granularity: "grapheme" }
) => {
  segment(input: string): Iterable<{ segment: string }>;
};

function getGraphemeSegmenter(locale?: string) {
  const segmenter = (Intl as typeof Intl & { Segmenter?: SegmenterConstructor }).Segmenter;
  return segmenter ? new segmenter(locale, { granularity: "grapheme" }) : null;
}

export function splitTextForSpeechReveal(text: string, locale?: string) {
  const segmenter = getGraphemeSegmenter(locale);
  if (!segmenter) return Array.from(text);
  return Array.from(segmenter.segment(text), (part) => part.segment);
}

export function getSpeechRevealProgress(
  currentTimeSeconds: number,
  durationSeconds: number | null | undefined
) {
  if (
    !Number.isFinite(currentTimeSeconds) ||
    !Number.isFinite(durationSeconds) ||
    !durationSeconds ||
    durationSeconds <= 0
  ) {
    return 0;
  }

  return Math.min(1, Math.max(0, currentTimeSeconds / durationSeconds));
}

export function getSpeechRevealText({
  text,
  currentTimeSeconds,
  durationSeconds,
  locale,
}: {
  text: string;
  currentTimeSeconds: number;
  durationSeconds: number | null | undefined;
  locale?: string;
}) {
  if (!text) return "";
  const progress = getSpeechRevealProgress(currentTimeSeconds, durationSeconds);
  if (progress <= 0) return "";
  if (progress >= 1) return text;

  const graphemes = splitTextForSpeechReveal(text, locale);
  const visibleCount = Math.max(
    1,
    Math.min(graphemes.length, Math.floor(graphemes.length * progress))
  );

  return graphemes.slice(0, visibleCount).join("");
}
