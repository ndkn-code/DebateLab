import assert from "node:assert/strict";
import { DebateFeedbackEnvelopeSchema } from "./legacy";
import {
  DURABLE_PRACTICE_ANALYSIS_SOURCE_ROUTE,
  createPracticeFullRoundCompoundSchema,
  shouldUsePracticeFullRoundCompoundJudgment,
} from "./practice-full-round";
import type { DebateRound } from "@/types";

const base = {
  content: { score: 10, claimClarity: 2, evidenceSupport: 2, logicCoherence: 3, counterArgument: 3 },
  structure: { score: 8, introduction: 2, bodyOrganization: 3, conclusion: 3 },
  language: { score: 8, vocabulary: 3, grammar: 3, fluency: 2 },
  persuasion: { score: 3, audienceAwareness: 1, impactfulness: 2 },
  totalScore: 29,
  overallBand: "Novice",
  summary: "A specific summary.",
  strengths: ["One strength"],
  improvements: ["One improvement"],
  sampleArguments: ["One example"],
};

assert.equal(DebateFeedbackEnvelopeSchema.safeParse(base).success, false);
assert.equal(DebateFeedbackEnvelopeSchema.safeParse({
  ...base,
  detailedFeedback: {
    contentFeedback: "Specific content feedback.",
    structureFeedback: "Specific structure feedback.",
    languageFeedback: "Specific language feedback.",
    persuasionFeedback: "Specific persuasion feedback.",
  },
}).success, true);

const englishRounds: DebateRound[] = [
  {
    roundNumber: 1,
    type: "user-speech",
    label: "Government opening",
    transcript:
      "Thank you everyone. Public funding gives rural students equal access to qualified teachers and reliable learning materials.",
  },
  {
    roundNumber: 2,
    type: "ai-rebuttal",
    label: "Opposition rebuttal",
    aiResponse:
      "The proposal crowds out local priorities because a national fund cannot identify which classrooms need support first.",
  },
  {
    roundNumber: 3,
    type: "user-speech",
    label: "Government reply",
    transcript:
      "Our comparative weighing shows that guaranteed access matters more than minor targeting errors that can be corrected later.",
  },
];

const vietnameseRounds: DebateRound[] = [
  {
    roundNumber: 1,
    type: "user-speech",
    label: "Lập luận mở đầu",
    transcript:
      "Nguồn ngân sách ổn định giúp học sinh vùng sâu tiếp cận giáo viên giỏi và tài liệu học tập đáng tin cậy.",
  },
  {
    roundNumber: 2,
    type: "ai-rebuttal",
    label: "Phản biện",
    aiResponse:
      "Chính sách toàn quốc có thể phân bổ sai nguồn lực vì mỗi địa phương có nhu cầu giáo dục rất khác nhau.",
  },
  {
    roundNumber: 3,
    type: "user-speech",
    label: "Tổng kết",
    transcript:
      "So sánh cuối cùng cho thấy quyền tiếp cận giáo dục quan trọng hơn rủi ro phân bổ có thể điều chỉnh.",
  },
];

function schemaInput(rounds: DebateRound[], language: "en" | "vi") {
  return {
    topic: "This house would publicly fund equal access to education",
    transcript: rounds
      .map((round) => round.transcript ?? round.aiResponse ?? "")
      .join("\n"),
    side: "proposition" as const,
    speechType: "full-round",
    timeLimit: 600,
    actualDuration: 300,
    practiceTrack: "debate" as const,
    practiceLanguage: language,
    isFullRound: true,
    rounds,
    providerAudit: {
      sourceRoute: DURABLE_PRACTICE_ANALYSIS_SOURCE_ROUTE,
    },
  };
}

function validCompound(rounds: DebateRound[]) {
  const userOpeningText = rounds[0]?.transcript ?? "";
  const userOpening = userOpeningText.includes(". ")
    ? userOpeningText.slice(userOpeningText.indexOf(". ") + 2)
    : userOpeningText;
  const aiResponse = rounds[1]?.aiResponse ?? "";
  const userReply = rounds[2]?.transcript ?? "";
  const anchors = [userOpening, aiResponse, userReply];
  return {
    speechMap: {
      speechMap: rounds.map((round) => ({
        roundNumber: round.roundNumber,
        label: round.label,
        speaker: round.type === "user-speech" ? "user" : "ai",
        mainClaims: ["A concrete claim mapped from this speech."],
        responses: [],
        evidence: [],
        strategicNotes: "This speech changes the comparative in the round.",
      })),
      macroClashes: [
        {
          id: "access-clash",
          name: "Access versus targeting",
          studentPosition: "Guaranteed access corrects an unequal baseline.",
          aiPosition: "Local targeting should come before national funding.",
          judgeRead: "Access wins if implementation errors remain reversible.",
          studentMissingResponse: "Explain the correction mechanism in detail.",
        },
      ],
      judgingFocus: ["Compare the scale and reversibility of each side's harm."],
    },
    feedback: {
      ...base,
      detailedFeedback: {
        contentFeedback: "The mechanism is clear but needs comparative evidence.",
        structureFeedback: "The reply returns to the central clash.",
        languageFeedback: "The wording is direct and easy to follow.",
        persuasionFeedback: "The weighing gives the judge a decision rule.",
      },
      debateVerdict: {
        winner: "user",
        confidence: 0.72,
        summary: "The user wins the access comparison.",
        decidingReasons: ["The user explains why the benefit is less reversible."],
        nextMove: "Make the implementation safeguard explicit.",
      },
      scoreRationale: {
        overall: "The ballot follows the access-versus-targeting clash.",
        content: {
          score: 10,
          maxScore: 40,
          rationale: "The claim has a mechanism.",
          whyNotHigher: "Evidence remains general.",
          nextStep: "Quantify the affected group.",
        },
        structure: {
          score: 8,
          maxScore: 25,
          rationale: "The reply returns to the opening claim.",
          whyNotHigher: "Signposting could be sharper.",
          nextStep: "Name the decisive clash first.",
        },
        language: {
          score: 8,
          maxScore: 25,
          rationale: "The explanation is understandable.",
          whyNotHigher: "Some comparisons remain abstract.",
          nextStep: "Use one concrete comparative sentence.",
        },
        persuasion: {
          score: 3,
          maxScore: 10,
          rationale: "The reply supplies a decision rule.",
          whyNotHigher: "Urgency is underdeveloped.",
          nextStep: "Explain why the impact occurs now.",
        },
      },
      argumentBreakdowns: Array.from({ length: 4 }, (_, index) => ({
        name: `Argument ${index + 1}`,
        summary: "The argument links funding to access.",
        whatWorked: "It identifies a concrete beneficiary.",
        missingLayer: "It needs a stronger comparative.",
        betterVersion: "Funding wins because access harms are immediate and broad.",
      })),
      transcriptAnnotations: Array.from({ length: 8 }, (_, index) => ({
        quote: anchors[index % anchors.length],
        roundNumber: rounds[index % rounds.length]!.roundNumber,
        speaker:
          rounds[index % rounds.length]!.type === "user-speech" ? "user" : "ai",
        tag: index % 2 === 0 ? "logic" : "weighing",
        severity: index % 2 === 0 ? "strength" : "improvement",
        feedback: "This is a high-signal part of the reasoning.",
        suggestion: "Make the comparison more explicit.",
      })),
      clashLinks: Array.from({ length: 4 }, (_, index) => ({
        id: `clash-${index + 1}`,
        sourceRoundNumber: rounds[0]!.roundNumber,
        sourceSpeaker: "user",
        responseRoundNumber: rounds[1]!.roundNumber,
        responseSpeaker: "ai",
        sourceQuote: userOpening,
        responseQuote: aiResponse,
        outcome: index % 2 === 0 ? "answered" : "weighed",
        judgeRead: "The reply resolves this clash through reversibility.",
        suggestion: "State the comparative before adding detail.",
        tag: index % 2 === 0 ? "clash" : "weighing",
      })),
    },
  };
}

for (const [rounds, language] of [
  [englishRounds, "en"],
  [vietnameseRounds, "vi"],
] as const) {
  const input = schemaInput([...rounds], language);
  const { schema } = createPracticeFullRoundCompoundSchema(input);
  const parsed = schema.safeParse(validCompound([...rounds]));
  assert.equal(
    parsed.success,
    true,
    parsed.success ? undefined : JSON.stringify(parsed.error.issues, null, 2),
  );
}

const englishInput = schemaInput(englishRounds, "en");
const { schema: compoundSchema } =
  createPracticeFullRoundCompoundSchema(englishInput);

const missingDepth = validCompound(englishRounds);
missingDepth.feedback.argumentBreakdowns = [];
assert.equal(compoundSchema.safeParse(missingDepth).success, false);

const fabricatedQuote = validCompound(englishRounds);
fabricatedQuote.feedback.transcriptAnnotations[0]!.quote =
  "This fabricated quote never appeared in the declared round.";
assert.equal(compoundSchema.safeParse(fabricatedQuote).success, false);

const wrongSpeakerQuote = validCompound(englishRounds);
wrongSpeakerQuote.feedback.transcriptAnnotations[0]!.speaker = "ai";
assert.equal(compoundSchema.safeParse(wrongSpeakerQuote).success, false);

const lowSignalQuote = validCompound(englishRounds);
lowSignalQuote.feedback.transcriptAnnotations[0]!.quote = "Thank you everyone";
assert.equal(compoundSchema.safeParse(lowSignalQuote).success, false);

const droppedWithResponse = validCompound(englishRounds);
droppedWithResponse.feedback.clashLinks[0]!.outcome = "dropped";
assert.equal(compoundSchema.safeParse(droppedWithResponse).success, false);

const answeredWithoutResponse = validCompound(englishRounds);
Object.assign(answeredWithoutResponse.feedback.clashLinks[0]!, {
  responseRoundNumber: null,
  responseSpeaker: null,
  responseQuote: null,
});
assert.equal(compoundSchema.safeParse(answeredWithoutResponse).success, false);

const enabledEnvironment = {
  PRACTICE_FULL_ROUND_CORE_STAGED_ENABLED: undefined,
};
assert.equal(
  shouldUsePracticeFullRoundCompoundJudgment(
    englishInput,
    enabledEnvironment,
  ),
  true,
);
assert.equal(
  shouldUsePracticeFullRoundCompoundJudgment(
    {
      ...englishInput,
      providerAudit: { sourceRoute: "/api/analyze" },
    },
    enabledEnvironment,
  ),
  false,
);
assert.equal(
  shouldUsePracticeFullRoundCompoundJudgment(
    { ...englishInput, isFullRound: false },
    enabledEnvironment,
  ),
  false,
);
assert.equal(
  shouldUsePracticeFullRoundCompoundJudgment(
    { ...englishInput, practiceTrack: "speaking" },
    enabledEnvironment,
  ),
  false,
);
assert.equal(
  shouldUsePracticeFullRoundCompoundJudgment(
    { ...englishInput, practiceTrack: undefined },
    enabledEnvironment,
  ),
  false,
);
assert.equal(
  shouldUsePracticeFullRoundCompoundJudgment(englishInput, {
    PRACTICE_FULL_ROUND_CORE_STAGED_ENABLED: "false",
  }),
  false,
);

console.log("core legacy and compound full-round schemas passed");
