import assert from "node:assert/strict";
import {
  buildPerformanceAttemptFromSession,
  validatePerformanceAttemptDraft,
} from "./club-performance-recorder";
import type { DebateSession } from "@/types";

const userId = "00000000-0000-4000-8000-000000000101";
const session: DebateSession = {
  id: "00000000-0000-4d00-8000-000000000001",
  date: "2026-05-15T10:00:00.000Z",
  topic: {
    id: "topic-1",
    title: "Should cities ban private cars?",
    category: "Policy",
    difficulty: "advanced",
  },
  side: "proposition",
  practiceTrack: "debate",
  practiceLanguage: "en",
  mode: "full",
  prepTime: 300,
  speechTime: 420,
  transcript: "Cities should ban private cars because public space is scarce and congestion harms everyone.",
  duration: 480,
  modelName: "qa-model",
  clubContext: {
    clubId: "00000000-0000-4c00-8000-000000000002",
    classId: "00000000-0000-4500-8000-000000000001",
    assignmentId: "00000000-0000-4c20-8000-000000000001",
  },
  feedback: {
    practiceTrack: "debate",
    practiceLanguage: "en",
    content: {
      score: 8,
      claimClarity: 8,
      evidenceSupport: 6,
      logicCoherence: 7,
      counterArgument: 5,
    },
    structure: {
      score: 8,
      introduction: 8,
      bodyOrganization: 8,
      conclusion: 7,
    },
    language: {
      score: 8,
      vocabulary: 7,
      grammar: 8,
      fluency: 7,
    },
    persuasion: {
      score: 7,
      audienceAwareness: 7,
      impactfulness: 7,
    },
    totalScore: 72,
    overallBand: "Competent",
    summary: "Clear case with room for sharper rebuttal.",
    strengths: ["Clear claim"],
    improvements: ["Add rebuttal depth"],
    sampleArguments: [],
    detailedFeedback: {
      contentFeedback: "",
      structureFeedback: "",
      languageFeedback: "",
      persuasionFeedback: "",
    },
  },
};

const draft = buildPerformanceAttemptFromSession(session, userId);

assert.equal(draft.user_id, userId);
assert.equal(draft.club_id, session.clubContext?.clubId);
assert.equal(draft.assignment_id, session.clubContext?.assignmentId);
assert.equal(draft.source_type, "debate_session");
assert.equal(draft.practice_track, "debate");
assert.equal(draft.rubric_key, "debate_v1");
assert.equal(draft.overall_score, 72);
assert.equal(draft.model_name, "qa-model");
assert.equal(draft.word_count, 14);
assert.equal(typeof draft.skill_scores.rebuttal, "number");
assert.equal(draft.evidence.sourceReference instanceof Object, true);
assert.deepEqual(validatePerformanceAttemptDraft(draft), { ok: true });

assert.equal(
  validatePerformanceAttemptDraft({
    ...draft,
    assignment_id: "00000000-0000-4c20-8000-000000000001",
    club_id: null,
  }).reason,
  "assignment_without_club"
);

console.log("Club performance recorder tests passed");
