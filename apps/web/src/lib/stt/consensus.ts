export function getSttWordCount(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function isGroqTranscriptPlausible(deepgram: string, groq: string) {
  const groqWords = getSttWordCount(groq);
  if (groqWords < 20) return false;
  const deepgramWords = getSttWordCount(deepgram);
  if (deepgramWords < 20) return true;
  const ratio = groqWords / deepgramWords;
  return ratio >= 0.6 && ratio <= 1.6;
}
