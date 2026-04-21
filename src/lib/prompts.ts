import type { DebateRound, PracticeTrack } from "@/types";

interface AnalysisPromptParams {
  transcript: string;
  topic: string;
  side: "proposition" | "opposition";
  speechType: string;
  timeLimit: number;
  actualDuration: number;
  practiceTrack?: PracticeTrack;
  isFullRound?: boolean;
  rounds?: DebateRound[];
}

function buildRoundsContext(rounds?: DebateRound[]): string {
  if (!rounds || rounds.length === 0) return "";

  return `\n## Debate Rounds
This was a multi-round debate (Trường Teen style) with 5 rounds. The student's performance should be evaluated across ALL rounds.

${rounds
  .map((round) => {
    const text = round.type === "user-speech" ? round.transcript : round.aiResponse;
    if (!text) return null;

    const speaker = round.type === "user-speech" ? "Student" : "AI Opponent";
    return `### Round ${round.roundNumber}: ${round.label} (${speaker})
${text}`;
  })
  .filter(Boolean)
  .join("\n\n")}

## Full-Round Evaluation Priorities
- Track whether the student's stance stays consistent across rounds
- Reward rebuttal quality, comparative analysis, and strategic adaptation
- Penalize shallow one-liners, unexplained assumptions, and missing impact weighing`;
}

function speakingJsonSchema(): string {
  return `{
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
  "practiceTrack": "speaking",
  "summary": "<2-3 sentence overall assessment focused on speaking clarity, structure, and confidence>",
  "strengths": ["<specific speaking strength 1>", "<specific speaking strength 2>", "<specific speaking strength 3>"],
  "improvements": ["<specific speaking improvement 1>", "<specific speaking improvement 2>", "<specific speaking improvement 3>"],
  "sampleArguments": ["<a clearer supporting point they could have added 1>", "<a clearer supporting point 2>", "<a clearer supporting point 3>"],
  "detailedFeedback": {
    "contentFeedback": "<paragraph about how clearly they explained their ideas>",
    "structureFeedback": "<paragraph about opening, progression, and ending>",
    "languageFeedback": "<paragraph about vocabulary, grammar, and fluency>",
    "persuasionFeedback": "<paragraph about confidence, audience awareness, and takeaway>"
  }
}`;
}

function debateJsonSchema(): string {
  return `{
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
  "practiceTrack": "debate",
  "summary": "<2-3 sentence overall assessment of the student's debate case and strategic depth>",
  "strengths": ["<specific debate strength 1>", "<specific debate strength 2>", "<specific debate strength 3>"],
  "improvements": ["<specific debate improvement 1>", "<specific debate improvement 2>", "<specific debate improvement 3>"],
  "sampleArguments": ["<stronger rebuilt argument 1>", "<stronger rebuilt argument 2>", "<stronger rebuilt argument 3>"],
  "caseSummary": "<1-2 sentence description of the student's overall case line and how coherent it is>",
  "stanceFeedback": "<1-2 sentence evaluation of whether the student's stance is clear, stable, and defensible>",
  "argumentBreakdowns": [
    {
      "name": "<argument name>",
      "summary": "<what the student was trying to claim>",
      "whatWorked": "<what was promising about this argument>",
      "missingLayer": "<what layer is missing: mechanism, comparison, impact, motion link, or clash>",
      "betterVersion": "<a stronger rebuilt version using name -> mechanism -> comparison -> impact -> motion link>"
    }
  ],
  "missingLayers": ["<missing layer 1>", "<missing layer 2>", "<missing layer 3>"],
  "weighingFeedback": "<1-2 sentence evaluation of comparison, prioritization, and impact calculus>",
  "clashFeedback": "<1-2 sentence evaluation of how well the student engaged opposition arguments or likely opposition responses>",
  "strongerRebuilds": ["<stronger rebuilt argument 1>", "<stronger rebuilt argument 2>", "<stronger rebuilt argument 3>"],
  "detailedFeedback": {
    "contentFeedback": "<paragraph about stance, mechanism, warrant depth, and evidence quality>",
    "structureFeedback": "<paragraph about framing, case line, progression, and closing weighing>",
    "languageFeedback": "<paragraph about clarity and whether wording helps or distracts from reasoning>",
    "persuasionFeedback": "<paragraph about clash, comparison, and impact framing>"
  }
}`;
}

function buildSpeakingAnalysisPrompt(params: AnalysisPromptParams): string {
  const { transcript, topic, side, speechType, timeLimit, actualDuration } = params;

  return `You are an expert public speaking coach for Vietnamese high school students practicing English. Analyze this speech and provide supportive but honest feedback.

## Context
- Topic: "${topic}"
- Position: ${side === "proposition" ? "FOR" : "AGAINST"}
- Session Type: ${speechType}
- Time Limit: ${timeLimit} minutes
- Actual Duration: ${actualDuration} seconds

## Transcript
"""
${transcript}
"""

## Evaluation Priorities
Focus on speaking quality, not competitive debate strategy.

### 1. Content & Ideas (0-40 points)
- Claim Clarity (0-10): Are the main ideas easy to understand?
- Evidence & Reasoning (0-10): Does the speaker explain or support their ideas with examples?
- Logic & Coherence (0-10): Do the ideas connect naturally and avoid confusion?
- Counter-Argument Awareness (0-10): Does the speaker show awareness of other perspectives, even briefly?

### 2. Structure & Organization (0-25 points)
- Introduction (0-8): Does the speech start clearly and set up the main message?
- Body Organization (0-9): Are points easy to follow with clear transitions?
- Conclusion (0-8): Does the ending reinforce the main message?

### 3. Language & Delivery (0-25 points)
- Vocabulary (0-8): Is the word choice clear and appropriate for an English learner?
- Grammar (0-9): Is the grammar mostly accurate and understandable?
- Fluency (0-8): Does the speech flow naturally?

### 4. Persuasiveness (0-10 points)
- Audience Awareness (0-5): Does the speech sound audience-friendly and easy to follow?
- Impactfulness (0-5): Does the message feel memorable or meaningful?

## Scoring Principles
- Reward clarity, confidence, and understandable English more than advanced vocabulary
- Be supportive toward ESL mistakes if the meaning is still clear
- Do not judge this like a formal competitive debate round

Return a JSON object with this exact structure:
${speakingJsonSchema()}

Be encouraging but specific. Reference the student's actual speech whenever possible.`;
}

function buildDebateAnalysisPrompt(params: AnalysisPromptParams): string {
  const {
    transcript,
    topic,
    side,
    speechType,
    timeLimit,
    actualDuration,
    isFullRound,
    rounds,
  } = params;

  const roundsContext = isFullRound ? buildRoundsContext(rounds) : "";

  return `You are an expert debate coach and judge for Vietnamese high school students practicing English debate. Analyze this debate speech and provide rigorous, debate-specific feedback.

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

## Debate Standard
The student should ideally build arguments in this order:
1. Argument name
2. Explanation / mechanism
3. Comparison or weighing
4. Impact
5. Link back to the motion or team stance

If the speech sounds polished but the reasoning is thin, score the reasoning lower. Do NOT reward fancy wording over strong logic.

## Evaluation Priorities
### 1. Content & Argumentation (0-40 points)
- Claim Clarity (0-10): Is the stance clear, are the arguments named, and is the case line understandable?
- Evidence & Reasoning (0-10): Are the arguments explained with warrants, mechanism, and meaningful support?
- Logic & Coherence (0-10): Is the case internally consistent, or does it rely on weak assumptions and one-liners?
- Counter-Argument Awareness (0-10): Does the speaker respond to opposing logic, compare worlds, and engage clash?${isFullRound ? " Weight rebuttal quality heavily here." : ""}

### 2. Structure & Strategy (0-25 points)
- Introduction (0-8): Does the speech set a clear stance and framing?
- Body Organization (0-9): Does the case progress in a disciplined way from argument to argument?${isFullRound ? " Evaluate flow across rounds as well." : ""}
- Conclusion (0-8): Does the ending do meaningful weighing, impact framing, and motion linkage?

### 3. Language & Delivery (0-25 points)
- Vocabulary (0-8): Is wording precise enough to explain debate logic clearly?
- Grammar (0-9): Does grammar help or hurt the force of the case?
- Fluency (0-8): Does delivery support coherence and emphasis?

### 4. Persuasiveness & Impact (0-10 points)
- Audience Awareness (0-5): Does the student sound like they are helping a judge understand why they win?
- Impactfulness (0-5): Does the student actually weigh consequences and explain why their side matters more?

## Required Feedback Behavior
- Identify the student's stance and whether the case holds together as one system
- Point out where arguments are missing mechanism, comparison, impact, clash, or motion linkage
- Separate strong ideas from underdeveloped ones
- In stronger rebuilds, rewrite arguments using the required debate structure
- For full rounds, comment on consistency across rounds, not just isolated moments

Return a JSON object with this exact structure:
${debateJsonSchema()}

Keep the feedback specific, actionable, and debate-focused.`;
}

export function buildAnalysisPrompt(params: AnalysisPromptParams): string {
  const practiceTrack = params.practiceTrack ?? "debate";

  if (practiceTrack === "speaking") {
    return buildSpeakingAnalysisPrompt(params);
  }

  return buildDebateAnalysisPrompt(params);
}
