export type TranscriptLegitimacyReason =
  | "missing_topic_or_side"
  | "too_short"
  | "missing_audio_duration"
  | "placeholder_text"
  | "extreme_duplicate_ratio"
  | "missing_audio_object";

export type TranscriptLegitimacyInput = {
  topic?: string | null;
  side?: string | null;
  transcript?: string | null;
  durationSeconds?: number | null;
  audioBacked?: boolean;
  audioExists?: boolean | null;
  minChars?: number;
};

function normalizeForMetric(value: string) {
  return value
    .normalize("NFC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeWords(value: string) {
  const normalized = normalizeForMetric(value);
  return normalized ? normalized.split(" ") : [];
}

function editDistance<T>(left: readonly T[], right: readonly T[]) {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  const current = Array.from({ length: right.length + 1 }, () => 0);

  for (let i = 1; i <= left.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      const substitutionCost = Object.is(left[i - 1], right[j - 1]) ? 0 : 1;
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + substitutionCost
      );
    }
    for (let j = 0; j <= right.length; j += 1) {
      previous[j] = current[j];
    }
  }

  return previous[right.length] ?? 0;
}

export function computeWordErrorRate(reference: string, hypothesis: string) {
  const referenceWords = tokenizeWords(reference);
  if (referenceWords.length === 0) return hypothesis.trim() ? 1 : 0;
  return editDistance(referenceWords, tokenizeWords(hypothesis)) / referenceWords.length;
}

export function computeCharacterErrorRate(reference: string, hypothesis: string) {
  const referenceChars = Array.from(normalizeForMetric(reference).replace(/\s+/g, ""));
  if (referenceChars.length === 0) return hypothesis.trim() ? 1 : 0;
  return (
    editDistance(referenceChars, Array.from(normalizeForMetric(hypothesis).replace(/\s+/g, ""))) /
    referenceChars.length
  );
}

export function computeTermErrorRate(
  reference: string,
  hypothesis: string,
  keyterms: readonly string[]
): {
  precision: number | null;
  recall: number | null;
  referenceHits: number;
  hypothesisHits: number;
} {
  const normalizedReference = normalizeForMetric(reference);
  const normalizedHypothesis = normalizeForMetric(hypothesis);
  const terms = Array.from(
    new Set(keyterms.map(normalizeForMetric).filter((term) => term.length >= 2))
  );
  const referenceHits = terms.filter((term) => normalizedReference.includes(term));
  const hypothesisHits = terms.filter((term) => normalizedHypothesis.includes(term));
  const truePositives = hypothesisHits.filter((term) => referenceHits.includes(term)).length;

  return {
    precision: hypothesisHits.length ? truePositives / hypothesisHits.length : null,
    recall: referenceHits.length ? truePositives / referenceHits.length : null,
    referenceHits: referenceHits.length,
    hypothesisHits: hypothesisHits.length,
  };
}

export function computeExtremeDuplicateRatio(transcript: string) {
  const words = tokenizeWords(transcript);
  if (words.length < 20) return 0;
  const windows = new Map<string, number>();
  for (let index = 0; index <= words.length - 4; index += 1) {
    const key = words.slice(index, index + 4).join(" ");
    windows.set(key, (windows.get(key) ?? 0) + 1);
  }
  const repeatedWindows = Array.from(windows.values()).filter((count) => count >= 3).length;
  return windows.size ? repeatedWindows / windows.size : 0;
}

export function evaluateTranscriptLegitimacy(
  input: TranscriptLegitimacyInput
): { legit: boolean; reasons: TranscriptLegitimacyReason[] } {
  const reasons: TranscriptLegitimacyReason[] = [];
  const transcript = input.transcript?.trim() ?? "";
  const minChars = input.minChars ?? 200;

  if (!input.topic?.trim() || !input.side?.trim()) {
    reasons.push("missing_topic_or_side");
  }
  if (transcript.length < minChars) {
    reasons.push("too_short");
  }
  if (
    /\b(test|placeholder|lorem ipsum|asdf|dummy transcript)\b/i.test(transcript) ||
    /^(.)\1{40,}$/.test(transcript.replace(/\s+/g, ""))
  ) {
    reasons.push("placeholder_text");
  }
  if (computeExtremeDuplicateRatio(transcript) > 0.35) {
    reasons.push("extreme_duplicate_ratio");
  }
  if (input.audioBacked) {
    if (!input.durationSeconds || input.durationSeconds <= 0) {
      reasons.push("missing_audio_duration");
    }
    if (input.audioExists === false) {
      reasons.push("missing_audio_object");
    }
  }

  return {
    legit: reasons.length === 0,
    reasons,
  };
}
