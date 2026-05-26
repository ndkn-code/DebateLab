export function getSttWordCount(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

const VIETNAMESE_DIACRITIC_PATTERN =
  /[ăâđêôơưáàảãạắằẳẵặấầẩẫậéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/i;

function tokenize(text: string) {
  return text
    .trim()
    .split(/\s+/)
    .map((token) => token.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ""))
    .filter(Boolean);
}

function ratio(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : 0;
}

function hasLongOneLetterRun(tokens: string[]) {
  let run = 0;
  for (const token of tokens) {
    if (/^\p{L}$/u.test(token)) {
      run += 1;
      if (run >= 4) return true;
    } else {
      run = 0;
    }
  }
  return false;
}

function countVietnameseDiacriticTokens(tokens: string[]) {
  return tokens.filter((token) => VIETNAMESE_DIACRITIC_PATTERN.test(token)).length;
}

function countConsonantFragments(tokens: string[]) {
  return tokens.filter((token) => {
    const letters = token.toLowerCase().replace(/[^\p{L}]/gu, "");
    if (letters.length < 2 || letters.length > 5) return false;
    if (VIETNAMESE_DIACRITIC_PATTERN.test(letters)) return false;
    return !/[aeiouyăâêôơư]/i.test(letters);
  }).length;
}

export function analyzeGroqTranscriptQuality(deepgram: string, groq: string) {
  const flags: string[] = [];
  const groqTokens = tokenize(groq);
  const deepgramTokens = tokenize(deepgram);
  const groqWords = groqTokens.length;
  const deepgramWords = deepgramTokens.length;

  if (groqWords < 20) {
    flags.push("groq_too_short");
  }

  if (deepgramWords >= 20 && groqWords > 0) {
    const lengthRatio = groqWords / deepgramWords;
    if (lengthRatio < 0.6) flags.push("groq_semantic_length_too_short");
    if (lengthRatio > 1.6) flags.push("groq_semantic_length_too_long");
  }

  const oneLetterCount = groqTokens.filter((token) => /^\p{L}$/u.test(token)).length;
  if (oneLetterCount >= 8 && ratio(oneLetterCount, groqWords) > 0.08) {
    flags.push("groq_high_one_letter_token_ratio");
  }
  if (hasLongOneLetterRun(groqTokens)) {
    flags.push("groq_collapsed_one_letter_run");
  }

  const consonantFragments = countConsonantFragments(groqTokens);
  if (consonantFragments >= 8 && ratio(consonantFragments, groqWords) > 0.12) {
    flags.push("groq_collapsed_consonant_fragments");
  }

  const deepgramDiacriticRatio = ratio(
    countVietnameseDiacriticTokens(deepgramTokens),
    deepgramWords
  );
  const groqDiacriticRatio = ratio(countVietnameseDiacriticTokens(groqTokens), groqWords);
  if (
    deepgramWords >= 30 &&
    deepgramDiacriticRatio > 0.2 &&
    groqDiacriticRatio < deepgramDiacriticRatio * 0.25
  ) {
    flags.push("groq_abnormal_vietnamese_syllable_loss");
  }

  return {
    plausible: flags.length === 0,
    qualityFlags: flags,
    rejectedReason: flags[0] ?? null,
  };
}

export function isGroqTranscriptPlausible(deepgram: string, groq: string) {
  return analyzeGroqTranscriptQuality(deepgram, groq).plausible;
}
