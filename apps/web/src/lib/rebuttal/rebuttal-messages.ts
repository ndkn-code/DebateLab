import { createHash } from "node:crypto";
import type { DeepSeekMessage } from "@/lib/ai/deepseek";
import type { PracticeTrack } from "@/types";

export interface DeepSeekRebuttalMessageParams {
  aiSide: string;
  topic: string;
  motionBriefContext: string;
  debateMemoryContext: string;
  difficultyInstructions: string;
  previousRounds?: { label: string; speaker: string; text: string }[];
  roundLabel: string;
  currentRoundNumber?: number;
  speechTimeSeconds?: number;
  wordTarget: { min: number; max: number; label: string };
  track: PracticeTrack;
  languageLabel: string;
  responseLanguageInstruction: string;
  userTranscript: string;
  roundInstructions: string;
  learnerContext: string;
  truongTeenPromptContext?: string;
  casePlanPromptContext?: string;
  corpusContext?: string;
  evidenceHintContext?: string;
  responseMode?: "json" | "text";
}

export function buildDeepSeekRebuttalMessages(
  params: DeepSeekRebuttalMessageParams
): DeepSeekMessage[] {
  const isClosingRound = params.roundLabel.toLowerCase().includes("closing");
  const roundSpecificRules = isClosingRound
    ? `- Closing discipline: do not introduce a new LD, new independent argument, new model, or standalone constructive claim.
- Do not use closing signposts like "Luận điểm độc lập của chúng tôi là..." or "Một luận điểm riêng của chúng tôi là...".
- Use longer closing time to deepen mechanism comparison, impact weighing, rebuild, and crystallization.`
    : `- Include one clearly standalone constructive/offensive claim for your side, separate from pure line-by-line rebuttal.
- Put that standalone claim in its own paragraph using the spoken signpost "Luận điểm độc lập của chúng tôi là..." or "Một luận điểm riêng của chúng tôi là...".`;
  const jsonContract = `Return ONLY valid JSON in this exact shape:
{
  "rebuttal": "the spoken rebuttal text only",
  "highlights": [
    {
      "type": "claim" | "evidence" | "impact" | "assumption",
      "quote": "an exact quote copied from the rebuttal text",
      "note": "short student-friendly reason this phrase matters"
    }
  ]
}`;
  const textContract =
    "Return only the spoken rebuttal text. Do not wrap it in JSON, Markdown, headings, or coaching notes.";
  const messages: DeepSeekMessage[] = [
    {
      role: "system",
      content: `You are a debate AI playing an opponent in a Trường Teen-style practice debate.

${params.responseMode === "text" ? textContract : jsonContract}

Rules:
- Do not judge the round.
- Do not coach the student directly.
- In JSON mode, highlight 3-5 exact quotes that appear verbatim in "rebuttal".
- Never put another JSON object as the "rebuttal" value; the "rebuttal" value must be plain spoken text.
- Do not invent statistics, percentages, studies, named research, expert quotes, or institutional evidence.
- Avoid literal translated idioms that sound unnatural in Vietnamese debate speech.`,
    },
    {
      role: "user",
      content: `## Static Debate Opponent Rules
Format: Trường Teen-style practice debate.
Follow the duration-aware word target given in the dynamic request.
Directly clash, explain mechanisms, compare worlds, weigh impacts, rebuild your own side, and keep the side consistent.
For Vietnamese Trường Teen rebuttal rounds, include at least one standalone offensive claim the student can answer later; place it in its own spoken paragraph beginning with "Luận điểm độc lập của chúng tôi là..." or "Một luận điểm riêng của chúng tôi là...".
For Vietnamese Trường Teen closing rounds, never introduce a new LD or standalone claim; only rebuild prior AI material, weigh, crystallize, and answer final clashes.
Do not make every paragraph depend on "đội bạn nói".
Use natural spoken debate language; prioritize clear logic over ornamental wording.`,
    },
    {
      role: "user",
      content: `## Dynamic Debate Setup
- AI side: ${params.aiSide}
- Motion: "${params.topic}"
## Practice Track
${params.track}

## Practice Language
${params.languageLabel}
${params.responseLanguageInstruction}

## Difficulty Instructions
${params.difficultyInstructions}
${params.truongTeenPromptContext ?? ""}
${params.motionBriefContext}
${params.debateMemoryContext}
${params.casePlanPromptContext ?? ""}
${params.corpusContext ?? ""}`,
    },
  ];

  params.previousRounds?.forEach((round) => {
    messages.push({
      role: round.speaker.toLowerCase().includes("ai") ? "assistant" : "user",
      content: `## Previous Round: ${round.label} (${round.speaker})
${round.text}`,
    });
  });

  messages.push({
    role: "user",
    content: `## Current Round: ${params.roundLabel}
${params.currentRoundNumber ? `Round number: ${params.currentRoundNumber}` : ""}
Opponent speech time setting: ${params.speechTimeSeconds ?? 180} seconds
Target length for your spoken response: ${params.wordTarget.min}-${params.wordTarget.max} words for a ${params.wordTarget.label} speech format

## Opponent's Latest Speech
"""
${params.userTranscript}
"""
${params.evidenceHintContext ?? ""}

## Your Task
Write a ${params.roundLabel.toLowerCase()} responding to the opponent's speech. This is a spoken debate, so write in a natural speaking style - conversational but academically sharp.

${params.roundInstructions}

Rules:
- Directly address and counter specific points from the opponent's speech
${roundSpecificRules}
- Structure your logic around: argument label -> explanation or mechanism -> comparison or weighing -> impact -> link back to your side
- Prioritize depth over fancy wording
- Do not invent percentages, studies, named evidence, or citations. Use mechanisms, comparison, transcript details, and retrieved corpus only.
- Maintain your side (${params.aiSide}) and policy/model consistently across the whole debate
- Do not shift from a full ban/model to a partial ban/model, or vice versa, unless the Motion Definition explicitly defines that exception
- Review the previous rounds and Debate Memory before answering so you do not drop your own claims, contradict earlier concessions, or ignore active clashes
- Make the response proportional to the opponent's allocated speaking time; longer speeches need fuller engagement with mechanisms, examples, impacts, and weighing
- Be respectful but firm
- ${params.learnerContext}`,
  });

  return messages;
}

export function getDeepSeekRebuttalPromptPrefixHash(messages: DeepSeekMessage[]) {
  return createHash("sha256")
    .update(`${messages[0]?.content ?? ""}\n\n${messages[1]?.content ?? ""}`)
    .digest("hex");
}

export function hashRebuttalRequest(value: Record<string, unknown>) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
