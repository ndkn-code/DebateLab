import assert from "node:assert/strict";
import {
  availableLibraryFilters,
  filterTestCards,
  testCardSkills,
  toTestCard,
  type LibraryTestRow,
} from "./library";

const row = (over: Partial<LibraryTestRow> & Pick<LibraryTestRow, "id">): LibraryTestRow => ({
  title: "Untitled",
  slug: "untitled",
  description: null,
  module: "academic",
  kind: "full_mock",
  skill: null,
  time_limit_seconds: null,
  ...over,
});

// ── testCardSkills ──────────────────────────────────────────────────────────
assert.deepEqual(testCardSkills({ kind: "full_mock", skill: null }), [
  "listening",
  "reading",
  "writing",
  "speaking",
]);
assert.deepEqual(testCardSkills({ kind: "skill_set", skill: "listening" }), ["listening"]);
assert.deepEqual(testCardSkills({ kind: "drill", skill: null }), []);

// ── toTestCard: derives skills, duration, start link ────────────────────────
{
  const card = toTestCard(
    row({ id: "t1", slug: "cam19-1", kind: "full_mock", time_limit_seconds: 9900 }),
  );
  assert.equal(card.startHref, "/ielts/mock/cam19-1");
  assert.equal(card.durationMinutes, 165);
  assert.equal(card.skills.length, 4);

  const drill = toTestCard(
    row({ id: "t2", kind: "drill", skill: "reading", time_limit_seconds: null }),
  );
  assert.equal(drill.durationMinutes, null);
  assert.deepEqual(drill.skills, ["reading"]);
}

// ── filterTestCards ─────────────────────────────────────────────────────────
{
  const cards = [
    toTestCard(row({ id: "t1", kind: "full_mock" })),
    toTestCard(row({ id: "t2", kind: "skill_set", skill: "listening" })),
    toTestCard(row({ id: "t3", kind: "drill", skill: "writing" })),
  ];

  assert.equal(filterTestCards(cards, "all").length, 3);
  assert.deepEqual(
    filterTestCards(cards, "full_mock").map((card) => card.id),
    ["t1"],
  );
  // a full mock advertises every skill, so a skill filter also matches it
  assert.deepEqual(
    filterTestCards(cards, "listening").map((card) => card.id),
    ["t1", "t2"],
  );
  assert.deepEqual(
    filterTestCards(cards, "speaking").map((card) => card.id),
    ["t1"],
  );
}

// ── availableLibraryFilters: drops chips that match nothing ──────────────────
{
  const listeningOnly = [toTestCard(row({ id: "t2", kind: "skill_set", skill: "listening" }))];
  const filters = availableLibraryFilters(listeningOnly);
  assert.ok(filters.includes("all"));
  assert.ok(filters.includes("listening"));
  assert.ok(!filters.includes("full_mock"));
  assert.ok(!filters.includes("writing"));

  assert.deepEqual(availableLibraryFilters([]), ["all"]);
}

console.log("ielts/learner/library.test.ts passed");
