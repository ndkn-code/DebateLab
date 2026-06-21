import assert from "node:assert/strict";
import {
  activitySubskillKeys,
  buildLearnPath,
  buildLearnUnit,
  buildSubskillMastery,
  diffMastery,
  focusFirst,
  lessonEstimatedMinutes,
  masteryLevel,
  type LearnActivityRow,
  type LearnAttemptRow,
  type LearnModuleRow,
  type LearnSkillStateRow,
  type LearnSubskillRow,
} from "./learn-path";

// ── masteryLevel: research thresholds, evidence-gated ────────────────────────
assert.equal(masteryLevel(null, 0), "untouched");
assert.equal(masteryLevel(0.9, 0), "untouched", "no evidence → untouched even at high score");
assert.equal(masteryLevel(0.2, 3), "focus");
assert.equal(masteryLevel(0.39, 3), "focus");
assert.equal(masteryLevel(0.4, 3), "building");
assert.equal(masteryLevel(0.64, 3), "building");
assert.equal(masteryLevel(0.65, 3), "test_ready");
assert.equal(masteryLevel(0.84, 3), "test_ready");
assert.equal(masteryLevel(0.85, 3), "mastered");
assert.equal(masteryLevel(1, 5), "mastered");

// ── activitySubskillKeys: defensive jsonb parsing ────────────────────────────
assert.deepEqual(
  activitySubskillKeys({ sources: [{ subskillKey: "reading:matching_headings" }, { subskillKey: "reading:tfng" }] }),
  ["reading:matching_headings", "reading:tfng"],
);
assert.deepEqual(
  activitySubskillKeys({ sources: [{ subskillKey: "reading:x" }, { subskillKey: "reading:x" }] }),
  ["reading:x"],
  "dedupes repeated keys",
);
assert.deepEqual(activitySubskillKeys(null), []);
assert.deepEqual(activitySubskillKeys({}), []);
assert.deepEqual(activitySubskillKeys({ sources: "nope" }), []);
assert.deepEqual(activitySubskillKeys({ sources: [{ nope: 1 }, { subskillKey: 5 }] }), []);

// ── lessonEstimatedMinutes: authored value wins, else type default ───────────
assert.equal(lessonEstimatedMinutes({ duration_minutes: 9, activity_type: "ielts_gap_fill" }), 9);
assert.equal(lessonEstimatedMinutes({ duration_minutes: null, activity_type: "ielts_gap_fill" }), 6);
assert.equal(lessonEstimatedMinutes({ duration_minutes: null, activity_type: "ielts_vocab_collocation" }), 4);
assert.equal(lessonEstimatedMinutes({ duration_minutes: 0, activity_type: "ielts_paraphrase_transform" }), 4);

// ── buildSubskillMastery: untouched, labels, module dedup by evidence ────────
const subskills: LearnSubskillRow[] = [
  { key: "reading:matching_headings", label_en: "Matching headings", label_vi: "Nối tiêu đề", skill: "reading" },
  { key: "reading:tfng", label_en: "True/False/Not Given", label_vi: "Đúng/Sai/Không có", skill: "reading" },
];
{
  const states: LearnSkillStateRow[] = [
    // two modules for the same key — the higher-evidence row should win
    { subskill_key: "reading:matching_headings", skill: "reading", module: "academic", mastery_score: 0.7, confidence: 0.6, evidence_count: 8 },
    { subskill_key: "reading:matching_headings", skill: "reading", module: "general_training", mastery_score: 0.2, confidence: 0.3, evidence_count: 2 },
  ];
  const mastery = buildSubskillMastery(
    ["reading:matching_headings", "reading:tfng"],
    states,
    subskills,
  );
  assert.equal(mastery.length, 2);
  assert.equal(mastery[0].masteryPercent, 70, "higher-evidence academic row wins");
  assert.equal(mastery[0].level, "test_ready");
  assert.equal(mastery[0].labelEn, "Matching headings");
  // no evidence for tfng → untouched, 0%, never a fabricated band
  assert.equal(mastery[1].level, "untouched");
  assert.equal(mastery[1].masteryPercent, 0);
  assert.equal(mastery[1].evidenceCount, 0);
}
{
  // label falls back to the key when the subskill dictionary is missing it
  const mastery = buildSubskillMastery(["writing:unknown_key"], [], []);
  assert.equal(mastery[0].labelEn, "writing:unknown_key");
  assert.equal(mastery[0].skill, "writing", "skill derived from key prefix when no row");
}

// ── focusFirst: weakest surface first ────────────────────────────────────────
{
  const ordered = focusFirst([
    { key: "a", skill: "reading", labelEn: "A", labelVi: "A", masteryPercent: 90, confidence: 1, evidenceCount: 9, level: "mastered" },
    { key: "b", skill: "reading", labelEn: "B", labelVi: "B", masteryPercent: 20, confidence: 0.4, evidenceCount: 3, level: "focus" },
    { key: "c", skill: "reading", labelEn: "C", labelVi: "C", masteryPercent: 50, confidence: 0.5, evidenceCount: 4, level: "building" },
  ]);
  assert.deepEqual(ordered.map((m) => m.key), ["b", "c", "a"]);
}

// ── buildLearnPath: ordering, completion, recommended-next, progress ─────────
const course = { id: "course-1", title: "IELTS Academic Path", slug: "ielts-academic", sort_order: 0 };
const modules: LearnModuleRow[] = [
  { id: "u2", course_id: "course-1", title: "Unit 2", description: null, sort_order: 2 },
  { id: "u1", course_id: "course-1", title: "Unit 1", description: "Reading basics", sort_order: 1 },
];
const activities: LearnActivityRow[] = [
  mkActivity("a1", "u1", 1, "ielts_vocab_collocation", ["reading:matching_headings"]),
  mkActivity("a2", "u1", 2, "ielts_gap_fill", ["reading:tfng"]),
  mkActivity("a3", "u2", 1, "ielts_paraphrase_transform", ["reading:tfng"]),
];

function mkActivity(
  id: string,
  moduleId: string,
  order: number,
  type: string,
  keys: string[],
): LearnActivityRow {
  return {
    id,
    module_id: moduleId,
    title: `Lesson ${id}`,
    description: null,
    activity_type: type,
    content: { sources: keys.map((subskillKey) => ({ subskillKey })) },
    phase: "practice",
    duration_minutes: null,
    order_index: order,
  };
}

{
  // learner has completed only a1
  const attempts: LearnAttemptRow[] = [
    { activity_id: "a1", completed_at: "2026-06-20T00:00:00Z", score: 1, max_score: 1 },
  ];
  const path = buildLearnPath({ course, modules, activities, attempts, skillStates: [], subskills });

  // units sorted by sort_order
  assert.deepEqual(path.units.map((u) => u.id), ["u1", "u2"]);
  // lessons sorted by order_index inside the unit
  assert.deepEqual(path.units[0].lessons.map((l) => l.id), ["a1", "a2"]);

  // progress: 1 of 3 complete
  assert.equal(path.totalCount, 3);
  assert.equal(path.completedCount, 1);
  assert.equal(path.progressPercent, 33);
  assert.equal(path.isComplete, false);

  // recommended = first incomplete in path order = a2 in u1
  assert.equal(path.recommended?.lessonId, "a2");
  assert.equal(path.recommended?.unitId, "u1");
  assert.equal(path.units[0].isRecommended, true);
  assert.equal(path.units[1].isRecommended, false);
  assert.equal(path.units[0].lessons[1].isRecommended, true);
  assert.equal(path.units[0].lessons[0].isRecommended, false);

  // completion + score surfaced on the done lesson
  assert.equal(path.units[0].lessons[0].isCompleted, true);
  assert.equal(path.units[0].lessons[0].scorePercent, 100);
  assert.equal(path.units[0].lessons[1].isCompleted, false);
  assert.equal(path.units[0].lessons[1].scorePercent, null);

  // mastery overview spans distinct trained subskills (deduped across lessons)
  assert.deepEqual(path.masteryOverview.map((m) => m.key), [
    "reading:matching_headings",
    "reading:tfng",
  ]);
}

{
  // fully complete path → recommended null, isComplete true; best score wins
  const attempts: LearnAttemptRow[] = [
    { activity_id: "a1", completed_at: "t", score: 1, max_score: 2 }, // 50%
    { activity_id: "a1", completed_at: "t", score: 2, max_score: 2 }, // 100% (best wins)
    { activity_id: "a2", completed_at: "t", score: 1, max_score: 1 },
    { activity_id: "a3", completed_at: "t", score: 0, max_score: 1 },
  ];
  const path = buildLearnPath({ course, modules, activities, attempts, skillStates: [], subskills });
  assert.equal(path.isComplete, true);
  assert.equal(path.progressPercent, 100);
  assert.equal(path.recommended, null);
  assert.equal(path.units[0].lessons[0].scorePercent, 100, "best-of completed attempts");
}

{
  // an in-progress attempt (no completed_at) does not count as complete
  const attempts: LearnAttemptRow[] = [
    { activity_id: "a1", completed_at: null, score: null, max_score: null },
  ];
  const path = buildLearnPath({ course, modules, activities, attempts, skillStates: [], subskills });
  assert.equal(path.completedCount, 0);
  assert.equal(path.recommended?.lessonId, "a1", "first lesson recommended when nothing done");
}

// ── buildLearnUnit: scoped to one unit ───────────────────────────────────────
{
  const unitView = buildLearnUnit({
    module: modules[1], // u1
    courseTitle: "IELTS Academic Path",
    activities: activities.filter((a) => a.module_id === "u1"),
    attempts: [{ activity_id: "a1", completed_at: "t", score: 1, max_score: 1 }],
    skillStates: [],
    subskills,
  });
  assert.equal(unitView.unit.id, "u1");
  assert.equal(unitView.unit.totalCount, 2);
  assert.equal(unitView.unit.completedCount, 1);
  assert.equal(unitView.recommended?.lessonId, "a2");
  assert.equal(unitView.courseTitle, "IELTS Academic Path");
}

// ── diffMastery: first-ever attempt shows the full gain ──────────────────────
{
  const before = buildSubskillMastery(["reading:tfng"], [], subskills); // untouched, 0%
  const after = buildSubskillMastery(
    ["reading:tfng"],
    [{ subskill_key: "reading:tfng", skill: "reading", module: "academic", mastery_score: 0.58, confidence: 0.45, evidence_count: 1 }],
    subskills,
  );
  const delta = diffMastery(["reading:tfng"], before, after);
  assert.equal(delta.length, 1);
  assert.equal(delta[0].beforePercent, 0);
  assert.equal(delta[0].afterPercent, 58);
  assert.equal(delta[0].deltaPercent, 58);
  assert.equal(delta[0].labelEn, "True/False/Not Given");
  assert.equal(delta[0].evidenceCount, 1);
}

console.log("ielts/learner/learn-path.test.ts passed");
