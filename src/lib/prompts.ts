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
  "transcriptAnnotations": [
    {
      "quote": "<exact contiguous quote copied from the student transcript, 5-25 words, no ellipses>",
      "roundNumber": null,
      "tag": "<one of: stance, mechanism, evidence, logic, clash, weighing, impact, structure, delivery>",
      "severity": "<one of: strength, improvement, warning>",
      "feedback": "<specific comment about what this quoted moment shows>",
      "suggestion": "<specific rewrite or next step for this exact moment>"
    }
  ],
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
  "debateVerdict": {
    "winner": "<user|ai|tie, full rounds only; use tie if no clear winner>",
    "confidence": <number 0.0-1.0>,
    "summary": "<2-3 sentence verdict explaining whether the student beat the AI opponent>",
    "decidingReasons": ["<deciding reason 1>", "<deciding reason 2>", "<deciding reason 3>"],
    "nextMove": "<one concrete strategic move the student should practice next>"
  },
  "clashLinks": [
    {
      "id": "<stable short id>",
      "sourceRoundNumber": <round number where the AI/opponent claim appears>,
      "sourceSpeaker": "<user|ai>",
      "responseRoundNumber": <round number where the response appears, or null if dropped>,
      "responseSpeaker": "<user|ai or null if dropped>",
      "sourceQuote": "<exact quote from the source speech>",
      "responseQuote": "<exact quote from the response speech, or null if dropped>",
      "outcome": "<answered|dropped|misanswered|turned|weighed>",
      "judgeRead": "<1-2 sentence explanation of how this exchange affected the debate>",
      "suggestion": "<specific next-step rewrite or strategic move>",
      "tag": "<clash|rebuttal|weighing|logic|evidence>"
    }
  ],
  "transcriptAnnotations": [
    {
      "quote": "<exact contiguous quote copied from the relevant user or AI speech, 5-25 words, no ellipses>",
      "roundNumber": <round number or null>,
      "speaker": "<user|ai>",
      "tag": "<one of: stance, mechanism, evidence, logic, clash, weighing, impact, structure, delivery>",
      "severity": "<one of: strength, improvement, warning>",
      "feedback": "<specific comment about what this quoted moment shows>",
      "suggestion": "<specific rewrite or next step for this exact moment>"
    }
  ],
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

## Required Feedback Behavior
- Include 3-5 transcriptAnnotations that quote exact contiguous words from the student's transcript
- Each annotation must explain where the issue or strength appears and how to fix or reuse it
- Prefer comments on opening clarity, support for claims, organization, and delivery moments the student can actually find in their transcript
- If a quote cannot be copied exactly from the transcript, choose a shorter exact quote instead of paraphrasing

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
- Keep overallFeedback focused on speech quality and coaching priorities; put win/loss/tie outcome language only in debateVerdict
- For non-full debate sessions, set debateVerdict to null and clashLinks to []
- Include 4-8 transcriptAnnotations that quote exact contiguous words from the relevant transcript
- Each annotation must connect the quote to a debate layer: stance, mechanism, evidence, logic, clash, weighing, impact, structure, or delivery
- Include at least one annotation about reasoning depth or missing mechanism, and one about weighing or clash when the transcript gives you material
- For full rounds, include debateVerdict and 3-6 clashLinks that judge whether the student beat, lost to, or tied the AI opponent
- For full rounds, annotate both user and AI speeches when useful; set speaker to "user" for student quotes and "ai" for AI opponent quotes
- For full rounds, set roundNumber to the exact labeled round number; use null only when round location is unclear
- For full-round clashLinks, sourceQuote should usually be the AI claim being answered and responseQuote should be the later student answer
- Use outcome "dropped" with responseRoundNumber, responseSpeaker, and responseQuote set to null when the AI claim was not answered
- Use outcome "misanswered" when the student responds but misses the claim or burden
- Use outcome "turned" when the student flips the AI's logic
- Use outcome "weighed" when the student directly compares impacts, worlds, probability, magnitude, or affected groups
- If a quote cannot be copied exactly from the transcript, choose a shorter exact quote instead of paraphrasing

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

interface DuelJudgmentPromptParams {
  motion: string;
  topicCategory: string;
  participants: {
    proposition: { participantId: string | null; displayName: string };
    opposition: { participantId: string | null; displayName: string };
  };
  speeches: Array<{
    id: string;
    roundNumber: number;
    speechType: "opening" | "rebuttal";
    side: "proposition" | "opposition";
    label: string;
    transcript: string;
    durationSeconds: number;
    qualityFlags?: string[];
  }>;
}

function duelJudgmentJsonSchema(): string {
  return `{
  "winnerSide": "<proposition or opposition>",
  "winnerParticipantId": "<participant id string or null>",
  "confidence": <number 0.0-1.0>,
  "decisionSummary": "<2-3 sentence explanation of why this side wins>",
  "comparativeBallot": {
    "caseQuality": { "winnerSide": "<proposition|opposition|tie>", "reason": "<short reason>" },
    "logic": { "winnerSide": "<proposition|opposition|tie>", "reason": "<short reason>" },
    "rebuttal": { "winnerSide": "<proposition|opposition|tie>", "reason": "<short reason>" },
    "weighing": { "winnerSide": "<proposition|opposition|tie>", "reason": "<short reason>" },
    "evidence": { "winnerSide": "<proposition|opposition|tie>", "reason": "<short reason>" },
    "delivery": { "winnerSide": "<proposition|opposition|tie>", "reason": "<short reason>" }
  },
  "participantFeedback": {
    "proposition": {
      "summary": "<1-2 sentence summary>",
      "strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
      "improvements": ["<improvement 1>", "<improvement 2>", "<improvement 3>"]
    },
    "opposition": {
      "summary": "<1-2 sentence summary>",
      "strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
      "improvements": ["<improvement 1>", "<improvement 2>", "<improvement 3>"]
    }
  },
  "roundBreakdown": [
    {
      "roundNumber": <number>,
      "label": "<round label>",
      "winnerSide": "<proposition|opposition|tie>",
      "reason": "<short reason>"
    }
  ],
  "clashLinks": [
    {
      "id": "<stable short id>",
      "sourceSpeechId": "<speech id from transcript metadata>",
      "responseSpeechId": "<speech id that responds, or null if dropped>",
      "sourceQuote": "<exact quote from the opponent/other side claim>",
      "responseQuote": "<exact quote from the response speech, or null if dropped>",
      "outcome": "<answered|dropped|misanswered|turned|weighed>",
      "judgeRead": "<1-2 sentence explanation of how this clash affected the debate>",
      "suggestion": "<specific next-step rewrite or strategic move>",
      "tag": "<clash|rebuttal|weighing|logic|evidence>"
    }
  ],
  "summary": "<1 paragraph overall verdict summary>",
  "qualityWarnings": ["<warning 1>", "<warning 2>"],
  "model": "<filled by API if missing>",
  "judgedAt": "<ISO datetime string>"
}`;
}

export function buildDuelJudgmentPrompt(
  params: DuelJudgmentPromptParams
): string {
  const speechBlock = params.speeches
    .map(
        (speech) => `### Round ${speech.roundNumber}: ${speech.label}
- Speech id: ${speech.id}
- Side: ${speech.side}
- Type: ${speech.speechType}
- Duration: ${speech.durationSeconds} seconds
- Quality flags: ${speech.qualityFlags?.join(", ") || "none"}

"""
${speech.transcript}
"""`
    )
    .join("\n\n");

  return `You are a rigorous AI debate judge evaluating a 1v1 in-person high school debate. You must decide the winner comparatively after the full debate is complete.

## Motion
- Motion: "${params.motion}"
- Category: "${params.topicCategory}"

## Participants
- Proposition: ${params.participants.proposition.displayName} (id: ${params.participants.proposition.participantId ?? "unknown"})
- Opposition: ${params.participants.opposition.displayName} (id: ${params.participants.opposition.participantId ?? "unknown"})

## Format
- Shared prep
- Proposition opening
- Opposition opening
- Rebuttal prep
- Proposition rebuttal
- Opposition rebuttal

## Evaluation Standard
Judge comparatively, not absolutely.

Prioritize:
1. Burden fulfillment and case quality
2. Logic, mechanism, and warrant depth
3. Rebuttal and clash
4. Weighing and impact comparison
5. Evidence quality
6. Delivery clarity

Important judging rules:
- Do NOT coach during the debate; judge only the completed debate
- Do NOT reward polished language over reasoning
- If a speech is too short or obviously incomplete, reduce confidence and mention it in qualityWarnings
- Decide who wins overall, even if some categories are tied
- Round breakdown should explain who won each major speech comparison
- Generate 3-6 clashLinks that map the most important cross-speech interactions
- For clashLinks, sourceQuote should be the opponent/other side claim and responseQuote should be the later answer
- Use exact quotes copied from the transcripts whenever possible
- Use outcome "dropped" with responseSpeechId and responseQuote set to null when the claim was not answered
- Use outcome "misanswered" when the response exists but answers the wrong claim or misses the burden
- Use outcome "turned" when a speaker flips the other side's logic
- Use outcome "weighed" when a speaker directly compares impacts, worlds, probability, magnitude, or affected groups
- Frame suggestions as concrete next moves for the debater reviewing the result

## Debate Transcript
${speechBlock}

Return a JSON object with this exact structure:
${duelJudgmentJsonSchema()}

Be specific, comparative, and decisive.`;
}
