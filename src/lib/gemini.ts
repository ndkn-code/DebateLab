import { GoogleGenerativeAI } from "@google/generative-ai";
import type { DebateScore } from "@/types/feedback";
import { buildAnalysisPrompt } from "./prompts";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function analyzeDebate(params: {
  transcript: string;
  topic: string;
  side: "proposition" | "opposition";
  speechType: string;
  timeLimit: number;
  actualDuration: number;
}): Promise<DebateScore> {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.3,
    },
  });

  const prompt = buildAnalysisPrompt(params);
  const result = await model.generateContent(prompt);
  const text = result.response.text();
  const parsed = JSON.parse(text) as DebateScore;

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

  return parsed;
}
