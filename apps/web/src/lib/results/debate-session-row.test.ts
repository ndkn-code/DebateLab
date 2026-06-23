import assert from "node:assert/strict";
import {
  isSessionSchemaCompatibilityError,
  rowToDebateSession,
} from "./debate-session-row";

const fallbackSession = rowToDebateSession({
  id: "session-1",
  created_at: "2026-06-23T12:00:00.000Z",
  topic_title: "This House would make result loaders server-backed",
  topic_category: "Technology",
  topic_difficulty: "intermediate",
  side: "opposition",
  mode: "quick",
  prep_time: 60,
  speech_time: 120,
  transcript: "A test transcript",
  feedback: {
    practiceTrack: "speaking",
    practiceLanguage: "vi",
    totalScore: 78,
  },
  duration_seconds: 180,
});

assert.equal(fallbackSession.practiceTrack, "speaking");
assert.equal(fallbackSession.practiceLanguage, "vi");
assert.equal(fallbackSession.topic.id, "session-1");

const explicitSession = rowToDebateSession({
  id: "session-2",
  created_at: "2026-06-23T12:00:00.000Z",
  practice_topic_key: "topic-2",
  topic_title: "This House would prefer explicit database columns",
  topic_category: "Policy",
  topic_difficulty: "advanced",
  side: "proposition",
  practice_track: "debate",
  practice_language: "en",
  mode: "full",
  prep_time: 90,
  speech_time: 180,
  transcript: "Another transcript",
  feedback: {
    practiceTrack: "speaking",
    practiceLanguage: "vi",
  },
  duration_seconds: 240,
});

assert.equal(explicitSession.practiceTrack, "debate");
assert.equal(explicitSession.practiceLanguage, "en");
assert.equal(explicitSession.topic.id, "topic-2");

assert.equal(
  isSessionSchemaCompatibilityError({ code: "42703", message: "missing column" }),
  true
);
assert.equal(
  isSessionSchemaCompatibilityError({ code: "PGRST116", message: "no rows" }),
  false
);

console.info("debate session row mapping passed");
