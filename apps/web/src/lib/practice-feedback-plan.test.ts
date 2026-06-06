import assert from "node:assert/strict";
import {
  DUEL_REBUTTAL_DURATION,
  SOLO_PREP_DURATION,
  SOLO_SPEECH_DURATION,
  clampDurationSeconds,
  minutesToSeconds,
} from "./practice-durations";
import {
  buildTranscriptChunks,
  estimateTranscriptTimestamp,
  filterTranscriptAnnotationMatches,
  formatTranscriptTimestamp,
  getTranscriptAnnotationAccent,
  locateTranscriptAnnotations,
  normalizeTranscriptAnnotations,
} from "./feedback/annotations";
import {
  filterAnnotationsForRound,
  normalizeDebateClashLinks,
  normalizeDebateVerdict,
} from "./feedback/debate-review";
import {
  getDebateFeedbackDepthTarget,
  isFeedbackBelowDepthTarget,
  normalizeScoreRationale,
} from "./feedback/depth";
import { needsVietnameseProseRepair } from "./feedback/language-repair";
import { normalizeDebateDuelClashLinks } from "./debate-duels/clash-links";
import { getMotionBrief } from "./motion-brief";
import {
  createInitialDebateMemory,
  getRebuttalMaxOutputTokens,
  getRebuttalWordTarget,
  updateDebateMemoryFromAiSpeech,
} from "./rebuttal/debate-continuity";
import {
  normalizeRebuttalText,
  normalizeStructuredRebuttalResponse,
} from "./rebuttal/structured-response";
import { getFullRoundWinnerResult } from "./results/session-result";
import { getLocalizedTopics } from "./topics";
import type { DebateScore, DebateSession } from "@/types";

assert.equal(clampDurationSeconds(0, SOLO_PREP_DURATION), 60);
assert.equal(clampDurationSeconds(999, SOLO_PREP_DURATION), 600);
assert.equal(clampDurationSeconds(95, SOLO_PREP_DURATION), 120);
assert.equal(clampDurationSeconds(481, SOLO_SPEECH_DURATION), 420);
assert.equal(clampDurationSeconds(45, DUEL_REBUTTAL_DURATION), 60);
assert.equal(minutesToSeconds(7, SOLO_SPEECH_DURATION), 420);
assert.equal(minutesToSeconds(12, SOLO_PREP_DURATION), 600);

const transcript =
  "First, we must protect students from harm. This matters because schools shape daily habits.\nSecond, the policy creates accountability.";

const annotations = normalizeTranscriptAnnotations([
  {
    quote: "protect students from harm",
    speaker: "user",
    tag: "impact",
    severity: "strength",
    feedback: "Clear impact framing.",
    suggestion: "Keep this impact, then compare it against the other side.",
  },
  {
    quote: "daily habits. Second, the policy",
    tag: "mechanism",
    severity: "unknown",
    feedback: "This transition needs a clearer mechanism.",
    suggestion: "Explain how the policy changes behavior before moving on.",
  },
  {
    quote: "",
    feedback: "Ignore invalid entries.",
  },
]);

assert.equal(annotations.length, 2);
assert.equal(annotations[0].speaker, "user");
assert.equal(annotations[1].severity, "improvement");

const matches = locateTranscriptAnnotations(transcript, annotations);
assert.equal(matches.length, 2);
assert.equal(matches[0].matchedText, "protect students from harm");
assert.equal(matches[0].start, 15);
assert.equal(
  matches[1].matchedText,
  "daily habits.\nSecond, the policy"
);

const unmatched = locateTranscriptAnnotations(transcript, [
  {
    quote: "this quote does not appear",
    tag: "logic",
    severity: "warning",
    feedback: "Unmatched quotes should still render as cards.",
    suggestion: "Choose an exact transcript quote next time.",
  },
]);
assert.equal(unmatched[0].start, null);
assert.equal(unmatched[0].matchedText, null);
assert.equal(formatTranscriptTimestamp(65.9), "1:05");
assert.equal(estimateTranscriptTimestamp(60, 120, 180), "1:30");
assert.equal(estimateTranscriptTimestamp(null, 120, 180), null);
assert.equal(filterTranscriptAnnotationMatches(matches, "all").length, 2);
assert.equal(filterTranscriptAnnotationMatches(matches, "strength").length, 1);
assert.equal(filterTranscriptAnnotationMatches(matches, "warning").length, 0);

const chunkedTranscript =
  "First, students lose attention when phones buzz. Teachers then restart explanations. This costs learning time. Second, a shared rule is fairer because every classroom has the same expectation. Finally, the policy protects deep work.";
const chunks = buildTranscriptChunks(chunkedTranscript, 240);
assert.equal(chunks.length, 2);
assert.equal(chunks[0].timestampLabel, "0:00");
assert.ok(chunks[0].text.includes("This costs learning time."));
assert.equal(getTranscriptAnnotationAccent("evidence"), "#00B8D9");
assert.equal(getTranscriptAnnotationAccent("clash"), "#FFD166");
assert.notEqual(
  getTranscriptAnnotationAccent("evidence"),
  getTranscriptAnnotationAccent("clash")
);

const clashLinks = normalizeDebateDuelClashLinks([
  {
    id: "valid-link",
    sourceSpeechId: "opp-opening",
    responseSpeechId: "prop-rebuttal",
    sourceQuote: "Phones help students research quickly.",
    responseQuote: "Research can happen on school-managed devices.",
    outcome: "answered",
    judgeRead: "The response directly narrows the benefit.",
    suggestion: "Compare managed devices against open phone use.",
    tag: "logic",
  },
  {
    sourceSpeechId: "opp-opening",
    responseSpeechId: "prop-rebuttal",
    sourceQuote: "Blanket bans punish responsible students.",
    responseQuote: "",
    outcome: "answered",
    judgeRead: "No direct answer was found, so this should become dropped.",
    suggestion: "Answer the fairness point directly.",
    tag: "rebuttal",
  },
  {
    sourceSpeechId: "opp-opening",
    sourceQuote: "Invalid outcomes should be discarded.",
    responseQuote: "This entry should not survive.",
    outcome: "partial",
    judgeRead: "Invalid.",
    suggestion: "Invalid.",
    tag: "logic",
  },
]);

assert.equal(clashLinks.length, 2);
assert.equal(clashLinks[0].id, "valid-link");
assert.equal(clashLinks[0].outcome, "answered");
assert.equal(clashLinks[1].outcome, "dropped");
assert.equal(clashLinks[1].responseSpeechId, null);
assert.equal(normalizeDebateDuelClashLinks(undefined).length, 0);

const verdict = normalizeDebateVerdict({
  winner: "user",
  confidence: 1.4,
  summary: "The user won on weighing.",
  decidingReasons: ["Clear answer", "", "Better impact"],
  nextMove: "Answer fairness earlier.",
});
assert.equal(verdict?.winner, "user");
assert.equal(verdict?.confidence, 1);
assert.deepEqual(verdict?.decidingReasons, ["Clear answer", "Better impact"]);
assert.equal(normalizeDebateVerdict({ winner: "opponent" }), null);

const winnerSession = {
  mode: "full",
  side: "proposition",
  practiceTrack: "debate",
  feedback: {
    practiceTrack: "debate",
    debateVerdict: {
      winner: "ai",
      confidence: 0.82,
      summary: "AI won on comparative weighing.",
      decidingReasons: ["Better impact comparison"],
      nextMove: "Answer the AI's weighing earlier.",
    },
  },
} as DebateSession;
const winnerResult = getFullRoundWinnerResult(winnerSession);
assert.equal(winnerResult?.kind, "side");
assert.equal(winnerResult?.kind === "side" ? winnerResult.side : null, "opposition");
assert.equal(getFullRoundWinnerResult({ ...winnerSession, mode: "quick" }), null);

const fullRoundClashLinks = normalizeDebateClashLinks([
  {
    sourceRoundNumber: 2,
    sourceSpeaker: "ai",
    responseRoundNumber: 3,
    responseSpeaker: "user",
    sourceQuote: "Phones help students access translation.",
    responseQuote: "Schools can provide controlled devices.",
    outcome: "answered",
    judgeRead: "The student narrowed the access claim.",
    suggestion: "Compare controlled access against open phones.",
    tag: "logic",
  },
  {
    sourceRoundNumber: 4,
    sourceSpeaker: "ai",
    sourceQuote: "Responsible students are punished.",
    responseQuote: null,
    outcome: "answered",
    judgeRead: "This became a drop because no response quote exists.",
    suggestion: "Answer collective fairness.",
    tag: "rebuttal",
  },
  {
    sourceRoundNumber: 5,
    sourceSpeaker: "teacher",
    sourceQuote: "Invalid speaker",
    responseQuote: "Invalid",
    outcome: "answered",
    judgeRead: "Invalid",
    suggestion: "Invalid",
    tag: "logic",
  },
  {
    sourceRoundNumber: 2,
    sourceSpeaker: "ai",
    responseRoundNumber: 3,
    responseSpeaker: "user",
    sourceQuote: "Cảm ơn đội bạn đã có những luận điểm rất rõ ràng.",
    responseQuote: "Kính thưa ban giám khảo và quý vị khán giả.",
    outcome: "misanswered",
    judgeRead: "This should not survive because both quotes are low-signal greetings.",
    suggestion: "Use the actual mechanism or weighing quote instead.",
    tag: "clash",
  },
]);

assert.equal(fullRoundClashLinks.length, 2);
assert.equal(fullRoundClashLinks[0].sourceSpeaker, "ai");
assert.equal(fullRoundClashLinks[1].outcome, "dropped");
assert.equal(fullRoundClashLinks[1].responseSpeaker, null);
assert.equal(normalizeDebateClashLinks(null).length, 0);
assert.equal(
  filterAnnotationsForRound(
    [
      {
        quote: "Controlled devices",
        roundNumber: 3,
        speaker: "user",
        tag: "logic",
        severity: "strength",
        feedback: "Good answer.",
        suggestion: "Weigh it.",
      },
      {
        quote: "Phones help translation",
        roundNumber: 2,
        speaker: "ai",
        tag: "evidence",
        severity: "warning",
        feedback: "AI benefit.",
        suggestion: "Answer it.",
      },
    ],
    "user",
    3
  ).length,
  1
);

const fullDepthTarget = getDebateFeedbackDepthTarget({
  isFullRound: true,
  actualDuration: 589,
  roundCount: 5,
});
assert.equal(fullDepthTarget.minArgumentBreakdowns, 5);
assert.equal(fullDepthTarget.minAnnotations, 10);
assert.equal(fullDepthTarget.minClashLinks, 5);
assert.equal(
  isFeedbackBelowDepthTarget(
    {
      argumentBreakdowns: [{ name: "one" }],
      transcriptAnnotations: [{ quote: "short", feedback: "thin" }],
      clashLinks: [{ id: "c1" }],
    } as DebateScore,
    fullDepthTarget
  ),
  true
);

const normalizedRationale = normalizeScoreRationale(
  {
    overall: "The score rewards clear claims but caps the result for thin weighing.",
    content: {
      score: 28,
      maxScore: 40,
      rationale: "The main claims were understandable.",
      whyNotHigher: "The mechanism was not fully explained.",
      nextStep: "Add one causal chain before examples.",
    },
    structure: {
      score: 18,
      maxScore: 25,
      rationale: "The speech had a visible order.",
      whyNotHigher: "Transitions did not show priority.",
      nextStep: "Signpost the weighing before closing.",
    },
    language: {
      score: 20,
      maxScore: 25,
      rationale: "The wording was clear enough for the judge.",
      whyNotHigher: "Some key terms stayed vague.",
      nextStep: "Define the policy terms early.",
    },
    persuasion: {
      score: 6,
      maxScore: 10,
      rationale: "The speech gave the judge a reason to care.",
      whyNotHigher: "It did not compare impacts directly.",
      nextStep: "Weigh probability against magnitude.",
    },
  },
  {
    content: {
      claimClarity: 7,
      evidenceSupport: 7,
      logicCoherence: 7,
      counterArgument: 7,
      score: 28,
    },
    structure: {
      introduction: 6,
      bodyOrganization: 6,
      conclusion: 6,
      score: 18,
    },
    language: {
      vocabulary: 7,
      grammar: 7,
      fluency: 6,
      score: 20,
    },
    persuasion: {
      audienceAwareness: 3,
      impactfulness: 3,
      score: 6,
    },
  }
);
assert.equal(normalizedRationale?.content.maxScore, 40);
assert.match(normalizedRationale?.persuasion.nextStep ?? "", /Weigh/);

const baseFeedbackForLanguageRepair = {
  content: {
    claimClarity: 7,
    evidenceSupport: 7,
    logicCoherence: 7,
    counterArgument: 7,
    score: 28,
  },
  structure: {
    introduction: 6,
    bodyOrganization: 6,
    conclusion: 6,
    score: 18,
  },
  language: {
    vocabulary: 7,
    grammar: 7,
    fluency: 6,
    score: 20,
  },
  persuasion: {
    audienceAwareness: 3,
    impactfulness: 3,
    score: 6,
  },
  totalScore: 72,
  overallBand: "Competent",
  summary: "Fixture summary.",
  strengths: [],
  improvements: [],
  sampleArguments: [],
  detailedFeedback: {
    contentFeedback: "",
    structureFeedback: "",
    languageFeedback: "",
    persuasionFeedback: "",
  },
} as DebateScore;

assert.equal(
  needsVietnameseProseRepair({
    ...baseFeedbackForLanguageRepair,
    summary:
      "The student has a clear claim, but the argument is weak because the impact weighing is too compressed.",
    scoreRationale: {
      overall:
        "This score rewards clarity, but the judge cannot credit the full logic because the speech skips mechanisms.",
      content: {
        score: 28,
        maxScore: 40,
        rationale: "The claim is understandable.",
        whyNotHigher: "The argument misses the causal chain.",
        nextStep: "Explain the mechanism before the impact.",
      },
      structure: normalizedRationale!.structure,
      language: normalizedRationale!.language,
      persuasion: normalizedRationale!.persuasion,
    },
  }),
  true
);

assert.equal(
  needsVietnameseProseRepair({
    ...baseFeedbackForLanguageRepair,
    summary:
      "Bài nói có luận điểm rõ, nhưng cần giải thích cơ chế tác động trước khi so sánh impact.",
    scoreRationale: {
      overall:
        "Điểm này phản ánh việc bạn có hướng lập luận tốt nhưng phần weighing chưa đủ cụ thể.",
      content: {
        score: 28,
        maxScore: 40,
        rationale: "Luận điểm chính dễ hiểu và có liên hệ với motion.",
        whyNotHigher: "Cơ chế tác động chưa được nối đủ từng bước.",
        nextStep: "Thêm một chuỗi vì sao trước khi chốt tác hại.",
      },
      structure: {
        score: 18,
        maxScore: 25,
        rationale: "Bố cục có trật tự và người nghe theo được mạch chính.",
        whyNotHigher: "Các đoạn chuyển chưa chỉ ra ưu tiên tranh luận.",
        nextStep: "Báo trước phần so sánh trước khi kết luận.",
      },
      language: {
        score: 20,
        maxScore: 25,
        rationale: "Cách diễn đạt đủ rõ để giám khảo hiểu ý.",
        whyNotHigher: "Một số thuật ngữ còn chung chung.",
        nextStep: "Định nghĩa thuật ngữ chính ngay đầu bài.",
      },
      persuasion: {
        score: 6,
        maxScore: 10,
        rationale: "Bài nói đã cho người nghe lý do để quan tâm.",
        whyNotHigher: "Phần so sánh tác động chưa đủ trực diện.",
        nextStep: "So sánh xác suất và mức độ ảnh hưởng trong cùng một câu.",
      },
    },
  }),
  false
);

const sevenMinuteTarget = getRebuttalWordTarget(420, "AI Rebuttal");
assert.deepEqual(sevenMinuteTarget, {
  min: 850,
  max: 1100,
  label: "7-minute",
});
assert.ok(getRebuttalMaxOutputTokens(sevenMinuteTarget) >= 2400);

const englishPhoneBrief = getMotionBrief(
  getLocalizedTopics("en").find((topic) => topic.id === "tech-03")!,
  "en"
);
assert.match(englishPhoneBrief.scope, /personal smartphones/);
assert.match(englishPhoneBrief.modelClarification, /complete school-day ban/);

const vietnameseRoteBrief = getMotionBrief(
  getLocalizedTopics("vi").find((topic) => topic.id === "vn-04")!,
  "vi"
);
assert.match(vietnameseRoteBrief.scope, /học thuộc/);

const memory = createInitialDebateMemory({
  topic: getLocalizedTopics("en").find((topic) => topic.id === "tech-03")!,
  side: "proposition",
  practiceLanguage: "en",
});
assert.equal(memory.aiSide, "opposition");
assert.match(memory.policyModel, /complete school-day ban/);
const nextMemory = updateDebateMemoryFromAiSpeech(
  memory,
  { roundNumber: 2, label: "AI Rebuttal" },
  "A complete ban overreaches because schools can regulate learning uses instead.",
  [
    {
      type: "claim",
      quote: "schools can regulate learning uses instead",
      note: "AI model should stay consistent.",
    },
  ]
);
assert.equal(nextMemory?.aiSide, "opposition");
assert.match(nextMemory?.priorAiClaims.join(" ") ?? "", /regulate learning uses/);

const structuredRebuttal = normalizeStructuredRebuttalResponse(`{
  "rebuttal": "Bên Phản đối thắng vì cơ chế của bên Ủng hộ chưa chứng minh được tác động trực tiếp.",
  "highlights": [
    {
      "type": "claim",
      "quote": "cơ chế của bên Ủng hộ chưa chứng minh được tác động trực tiếp",
      "note": "Đây là điểm clash chính."
    }
  ]
}`);
assert.equal(
  structuredRebuttal.rebuttal,
  "Bên Phản đối thắng vì cơ chế của bên Ủng hộ chưa chứng minh được tác động trực tiếp."
);
assert.equal(structuredRebuttal.highlights.length, 1);
assert.equal(structuredRebuttal.highlights[0].type, "claim");
assert.equal(structuredRebuttal.wasStructured, true);

const markdownWrappedRebuttal = normalizeRebuttalText(`\`\`\`json
{"rebuttal":"Không phải cứ dùng mạng xã hội nhiều là chắc chắn gây trầm cảm.","highlights":[]}
\`\`\``);
assert.equal(
  markdownWrappedRebuttal,
  "Không phải cứ dùng mạng xã hội nhiều là chắc chắn gây trầm cảm."
);

const fallbackHighlights = normalizeStructuredRebuttalResponse(
  `{"rebuttal":"Luận điểm này cần so sánh xác suất và mức độ tác hại."}`,
  [
    {
      type: "impact",
      quote: "so sánh xác suất và mức độ tác hại",
      note: "Giữ highlight đã lưu từ phiên cũ.",
    },
  ]
);
assert.equal(fallbackHighlights.highlights.length, 1);
assert.equal(fallbackHighlights.highlights[0].type, "impact");

console.log("practice-feedback-plan utilities passed");
