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
import { normalizeDebateDuelClashLinks } from "./debate-duels/clash-links";
import {
  normalizeRebuttalText,
  normalizeStructuredRebuttalResponse,
} from "./rebuttal/structured-response";
import { getFullRoundWinnerResult } from "./results/session-result";
import type { DebateSession } from "@/types";

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
assert.equal(getTranscriptAnnotationAccent("evidence"), "#34C759");
assert.equal(getTranscriptAnnotationAccent("clash"), "#F5B942");
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
