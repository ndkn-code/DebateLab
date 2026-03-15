import type { DebateRound } from "@/types";

export function buildAnalysisPrompt(params: {
  transcript: string;
  topic: string;
  side: "proposition" | "opposition";
  speechType: string;
  timeLimit: number;
  actualDuration: number;
  isFullRound?: boolean;
  rounds?: DebateRound[];
}): string {
  const { transcript, topic, side, speechType, timeLimit, actualDuration, isFullRound, rounds } =
    params;

  let roundsContext = "";
  if (isFullRound && rounds && rounds.length > 0) {
    roundsContext = `\n## Debate Rounds
This was a multi-round debate (Trường Teen style) with 5 rounds. The student's performance should be evaluated across ALL rounds.

${rounds
  .map((r) => {
    const text = r.type === "user-speech" ? r.transcript : r.aiResponse;
    if (!text) return null;
    const speaker = r.type === "user-speech" ? "Student" : "AI Opponent";
    return `### Round ${r.roundNumber}: ${r.label} (${speaker})
${text}`;
  })
  .filter(Boolean)
  .join("\n\n")}

## Additional Evaluation Criteria for Full Round
- **Rebuttal Quality**: How well did the student respond to the AI's arguments?
- **Adaptability**: Did the student adjust their strategy based on the AI's points?
- **Consistency**: Were arguments consistent across all rounds?
- **Progression**: Did the student build upon their earlier arguments?
`;
  }

  return `You are an expert debate coach and judge for high school students. Analyze this debate speech transcript and provide detailed, constructive feedback.

## Context
- Motion: "${topic}"
- Side: ${side === "proposition" ? "Proposition (FOR)" : "Opposition (AGAINST)"}
- Speech Type: ${speechType}
- Time Limit: ${timeLimit} minutes
- Actual Duration: ${actualDuration} seconds
${roundsContext}
## ${isFullRound ? "Combined " : ""}Transcript
"""
${transcript}
"""

## Scoring Rubric

### 1. Content & Argumentation (0-40 points)
- Claim Clarity (0-10): Are main arguments clearly stated with a strong thesis?
- Evidence & Reasoning (0-10): Are arguments backed by examples, data, or logical reasoning?
- Logic & Coherence (0-10): Do arguments flow logically without fallacies?
- Counter-Argument Awareness (0-10): Does the speaker anticipate and address opposing views?${isFullRound ? " (Weight this higher — evaluate rebuttal quality)" : ""}

### 2. Structure & Organization (0-25 points)
- Introduction (0-8): Hook, context, and clear thesis statement?
- Body Organization (0-9): Organized with clear transitions between arguments?${isFullRound ? " (Evaluate flow across rounds)" : ""}
- Conclusion (0-8): Summarizes key points and ends with impact?

### 3. Language & Delivery (0-25 points)
- Vocabulary (0-8): Range and accuracy of academic/debate vocabulary
- Grammar (0-9): Grammatical accuracy and sentence complexity
- Fluency (0-8): Natural flow, minimal fillers, good pacing

### 4. Persuasiveness (0-10 points)
- Audience Awareness (0-5): Addresses audience effectively?
- Impactfulness (0-5): Overall message is compelling?

## Band Descriptors
- Expert (90-100): Outstanding argumentation, sophisticated language
- Proficient (75-89): Strong arguments, clear structure, fluent
- Competent (60-74): Adequate arguments, generally organized
- Developing (40-59): Basic arguments, some organization issues
- Novice (0-39): Unclear arguments, poor organization

Return a JSON object with this exact structure:
{
  "content": {
    "claimClarity": <number 0-10>,
    "evidenceSupport": <number 0-10>,
    "logicCoherence": <number 0-10>,
    "counterArgument": <number 0-10>,
    "score": <number 0-40, sum of above>
  },
  "structure": {
    "introduction": <number 0-8>,
    "bodyOrganization": <number 0-9>,
    "conclusion": <number 0-8>,
    "score": <number 0-25, sum of above>
  },
  "language": {
    "vocabulary": <number 0-8>,
    "grammar": <number 0-9>,
    "fluency": <number 0-8>,
    "score": <number 0-25, sum of above>
  },
  "persuasion": {
    "audienceAwareness": <number 0-5>,
    "impactfulness": <number 0-5>,
    "score": <number 0-10, sum of above>
  },
  "totalScore": <number 0-100, sum of all category scores>,
  "overallBand": "<one of: Novice, Developing, Competent, Proficient, Expert>",
  "summary": "<2-3 sentence overall assessment, encouraging but honest${isFullRound ? ". Comment on performance across all rounds" : ""}>",
  "strengths": ["<specific strength 1 with example from transcript>", "<specific strength 2>", "<specific strength 3>"],
  "improvements": ["<specific, actionable improvement 1>", "<specific, actionable improvement 2>", "<specific, actionable improvement 3>"],
  "sampleArguments": ["<stronger argument they could have used 1>", "<stronger argument 2>", "<stronger argument 3>"],
  "detailedFeedback": {
    "contentFeedback": "<detailed paragraph about content quality, referencing specific parts of their speech${isFullRound ? " across rounds" : ""}>",
    "structureFeedback": "<detailed paragraph about organization${isFullRound ? " and how well they structured their debate across rounds" : ""}>",
    "languageFeedback": "<detailed paragraph about language use, noting specific vocabulary and grammar>",
    "persuasionFeedback": "<detailed paragraph about persuasiveness${isFullRound ? ", including rebuttal effectiveness" : ""}>"
  }
}

Be encouraging but honest. This is for Vietnamese high school students practicing debate in English. Give specific, actionable feedback referencing their actual words when possible. Remember these students are practicing English as a second language, so be supportive about language efforts while pointing out areas for improvement.`;
}
