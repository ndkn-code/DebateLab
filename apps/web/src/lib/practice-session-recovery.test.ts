import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPracticeRecoveryHref,
  canResumePracticeSession,
} from "./practice-session-recovery";
import { readPracticePrefill } from "./practice-prefill";
import { buildLocalizedLocaleSwitchHref } from "./locale-switch";

const topic = {
  id: "virtual-friends",
  title: "Bạn ảo",
  category: "Technology",
  difficulty: "intermediate" as const,
};

test("back preserves debate topic, side, mode, difficulty and class context in both locales", () => {
  const href = buildPracticeRecoveryHref({
    topicId: topic.id,
    topicTitle: topic.title,
    topicCategory: topic.category,
    practiceTrack: "debate",
    side: "opposition",
    mode: "full",
    aiDifficulty: "hard",
    clubContext: {
      classId: "123e4567-e89b-42d3-a456-426614174000",
      assignmentTitle: "Luyện nói",
    },
  });
  const query = new URL(href, "https://example.test").searchParams;
  const prefill = readPracticePrefill(query);
  assert.equal(query.get("resumeSetup"), "1");
  assert.equal(prefill?.topicId, topic.id);
  assert.equal(prefill?.side, "opposition");
  assert.equal(prefill?.mode, "full");
  assert.equal(prefill?.aiDifficulty, "hard");
  assert.equal(prefill?.clubContext?.assignmentTitle, "Luyện nói");
  for (const locale of ["en", "vi"] as const) {
    const localized = buildLocalizedLocaleSwitchHref(
      "/practice",
      locale,
      query,
    );
    assert.ok(localized.startsWith(`/${locale}/practice?`));
    assert.equal(
      new URL(localized, "https://example.test").searchParams.get("topicId"),
      topic.id,
    );
  }
});

test("only the same active practice may resume, never a completed analysis", () => {
  for (const phase of ["mic-check", "prep", "speaking", "ai-rebuttal"])
    assert.equal(canResumePracticeSession(topic, topic, phase), true);
  for (const phase of ["idle", "analyzing", "feedback"])
    assert.equal(canResumePracticeSession(topic, topic, phase), false);
  assert.equal(
    canResumePracticeSession(topic, { ...topic, id: "other" }, "speaking"),
    false,
  );
});
