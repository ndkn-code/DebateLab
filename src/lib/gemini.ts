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
    model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.3,
    },
  });

  const prompt = buildAnalysisPrompt(params);
  const result = await model.generateContent(prompt);
  const text = result.response.text();

  console.log("Gemini raw response length:", text.length);

  // Try to parse JSON, with fallback extraction
  let parsed: DebateScore;
  try {
    parsed = JSON.parse(text) as DebateScore;
  } catch {
    console.error("Direct JSON parse failed, attempting regex extraction");
    console.error("Raw text (first 500 chars):", text.substring(0, 500));

    // Try to extract JSON from markdown code blocks or surrounding text
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Invalid response: could not find JSON in Gemini output");
    }
    try {
      parsed = JSON.parse(jsonMatch[0]) as DebateScore;
    } catch {
      console.error("Regex-extracted JSON also failed to parse");
      throw new Error("Invalid response: Gemini returned malformed JSON");
    }
  }

  // Validate essential fields exist
  if (
    typeof parsed.totalScore !== "number" ||
    !parsed.overallBand ||
    !parsed.content ||
    !parsed.structure ||
    !parsed.language ||
    !parsed.persuasion
  ) {
    console.error("Invalid response structure:", JSON.stringify(parsed).substring(0, 500));
    throw new Error("Invalid response structure from Gemini");
  }

  return parsed;
}
