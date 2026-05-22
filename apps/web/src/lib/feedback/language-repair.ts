import type { DebateScore } from "@/types";

const VIETNAMESE_DIACRITIC_PATTERN =
  /[ăâđêôơưáàảãạắằẳẵặấầẩẫậéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/gi;

const ENGLISH_PROSE_PATTERN =
  /\b(the|student|score|because|argument|claim|round|performed|consistent|effective|feedback|should|teacher|system|overall|impact|weighing|logic|evidence|clear|unclear|strong|weak|speech|judge|category|next|higher)\b/gi;

const ENGLISH_PHRASE_PATTERN =
  /\b(the student|the argument|the speech|the judge|because the|why not higher|next step|this score|overall,? the|content score|structure score|language score|persuasion score)\b/i;

const NON_PROSE_KEYS = new Set([
  "quote",
  "sourceQuote",
  "responseQuote",
  "id",
  "tag",
  "winner",
  "speaker",
  "sourceSpeaker",
  "responseSpeaker",
  "outcome",
  "severity",
  "practiceTrack",
  "practiceLanguage",
  "overallBand",
]);

function collectUserFacingProse(value: unknown, key = ""): string[] {
  if (typeof value === "string") {
    if (NON_PROSE_KEYS.has(key) || value.trim().length < 12) {
      return [];
    }
    return [value];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectUserFacingProse(item, key));
  }

  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).flatMap(
      ([childKey, childValue]) => collectUserFacingProse(childValue, childKey)
    );
  }

  return [];
}

export function needsVietnameseProseRepair(feedback: DebateScore) {
  const prose = collectUserFacingProse(feedback).join(" ");
  if (!prose.trim()) return false;

  const englishMatches = prose.match(ENGLISH_PROSE_PATTERN)?.length ?? 0;
  const vietnameseMarks = prose.match(VIETNAMESE_DIACRITIC_PATTERN)?.length ?? 0;
  const hasEnglishPhrase = ENGLISH_PHRASE_PATTERN.test(prose);

  if (hasEnglishPhrase && englishMatches >= 2) return true;
  return englishMatches >= 6 && vietnameseMarks < 12;
}
