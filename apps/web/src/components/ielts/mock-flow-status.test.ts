import assert from "node:assert/strict";
import type { IeltsQuestionView } from "@/lib/ielts/question-contract";
import { mockAnnotationKey } from "@/lib/stores/mockAnnotationsStore";
import type { MockPart } from "./mock-parts";
import {
  buildMockQuestionStatuses,
  summarizeMockQuestionStatuses,
} from "./mock-flow-status";

function question(id: string, extra: Record<string, unknown> = {}): IeltsQuestionView {
  return { id, skill: "listening", ...extra } as unknown as IeltsQuestionView;
}

function part(id: string, title: string, questions: IeltsQuestionView[]): MockPart {
  return { id, title, body: null, audio: [], questions, groups: [] };
}

const ATTEMPT = "attempt-1";

// Twenty single-number questions, then an mcq_multi row spanning two numbers
// ("21–22") followed by a plain question that must be 23.
const parts = [
  part("sec-1", "Section 1", Array.from({ length: 10 }, (_, i) => question(`s1-${i}`))),
  part("sec-2", "Section 2", Array.from({ length: 10 }, (_, i) => question(`s2-${i}`))),
  part("sec-3", "Section 3", [
    question("s3-multi", { metadata: { numberSpan: 2 } }),
    question("s3-next"),
  ]),
];

const statuses = buildMockQuestionStatuses({
  parts,
  responses: { "s1-0": "A", "s3-multi": ["A", "C"] },
  flags: { [mockAnnotationKey(ATTEMPT, "s2-0")]: true },
  attemptId: ATTEMPT,
  activeQuestionId: "s3-next",
});

assert.equal(statuses.length, 22);
const byId = new Map(statuses.map((status) => [status.questionId, status]));

// numbering
assert.equal(byId.get("s1-0")?.number, 1);
assert.equal(byId.get("s1-0")?.numberLabel, "1");
assert.equal(byId.get("s2-0")?.number, 11);
assert.equal(byId.get("s3-multi")?.number, 21);
assert.equal(byId.get("s3-multi")?.numberLabel, "21–22");
assert.equal(byId.get("s3-next")?.number, 23);
assert.equal(byId.get("s3-next")?.numberLabel, "23");

// placement
assert.equal(byId.get("s3-next")?.partIndex, 2);
assert.equal(byId.get("s3-next")?.partTitle, "Section 3");

// answered / flagged / current
assert.equal(byId.get("s1-0")?.answered, true);
assert.equal(byId.get("s1-1")?.answered, false);
assert.equal(byId.get("s3-multi")?.answered, true);
assert.equal(byId.get("s2-0")?.flagged, true);
assert.equal(byId.get("s2-1")?.flagged, false);
assert.equal(byId.get("s3-next")?.current, true);
assert.equal(statuses.filter((status) => status.current).length, 1);

// counts
assert.deepEqual(summarizeMockQuestionStatuses(statuses), {
  total: 22,
  answered: 2,
  unanswered: 20,
  flagged: 1,
});

// A duplicated id keeps its first number (malformed structure stays stable).
const dup = buildMockQuestionStatuses({
  parts: [part("a", "A", [question("x")]), part("b", "B", [question("x"), question("y")])],
  responses: {},
  flags: {},
  attemptId: ATTEMPT,
  activeQuestionId: null,
});
assert.deepEqual(
  dup.map((status) => [status.questionId, status.numberLabel]),
  [["x", "1"], ["x", "1"], ["y", "2"]],
);

console.log("ielts/components/mock-flow-status tests passed");
