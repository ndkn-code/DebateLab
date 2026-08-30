/** Live student scoring never sends candidate material to Gemini. */
export function getIeltsWritingGroqModelName(): string {
  return (
    process.env.GROQ_IELTS_WRITING_MODEL ||
    process.env.GROQ_CHAT_MODEL ||
    "openai/gpt-oss-120b"
  );
}
