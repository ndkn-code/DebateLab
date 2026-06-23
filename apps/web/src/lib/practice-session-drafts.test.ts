import assert from "node:assert/strict";
import {
  consumePendingPracticeSessionHandoff,
  setPendingPracticeSessionHandoff,
  type PracticeSessionDraftPayload,
} from "./practice-session-drafts";

class MemoryLocalStorage {
  private values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }
}

const PENDING_HANDOFF_KEY = "debatelab_practice_pending_session";
const originalDateNow = Date.now;
const localStorage = new MemoryLocalStorage();

Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: { localStorage },
});

const payload: PracticeSessionDraftPayload = {
  selectedTopic: {
    id: "topic-1",
    topicKey: "topic-1",
    title: "This House would test durable client handoffs",
    category: "Technology",
    difficulty: "intermediate",
  },
  side: "proposition",
  practiceTrack: "debate",
  practiceLanguage: "en",
  mode: "full",
  prepTime: 60,
  speechTime: 120,
  aiDifficulty: "medium",
  currentPhase: "mic-check",
  currentRound: 1,
  prepNotes: "",
  transcript: "",
  rounds: [],
  debateMemory: null,
  sessionStartTime: 123456,
};

try {
  Date.now = () => 1000;
  setPendingPracticeSessionHandoff(payload);

  assert.deepEqual(consumePendingPracticeSessionHandoff(), payload);
  assert.equal(consumePendingPracticeSessionHandoff(), null);

  Date.now = () => 2000;
  setPendingPracticeSessionHandoff(payload);
  Date.now = () => 2000 + 11 * 60 * 1000;
  assert.equal(consumePendingPracticeSessionHandoff(), null);

  localStorage.setItem(PENDING_HANDOFF_KEY, "{not-valid-json");
  assert.equal(consumePendingPracticeSessionHandoff(), null);
} finally {
  Date.now = originalDateNow;
}

console.info("practice session draft handoff utilities passed");
