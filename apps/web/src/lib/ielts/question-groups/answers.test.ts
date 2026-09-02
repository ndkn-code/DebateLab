import assert from "node:assert/strict";
import {
  groupSlotValue,
  isSlotAnswered,
  setGroupSlotValue,
  unansweredSlotIds,
  usedOptionIds,
} from "./answers";

const responses = {
  q1: { values: { "0": "ii" } },
  q2: { values: { "0": ["iv", "v"] } },
  q3: { values: {} },
  q4: { values: { "0": "   " } },
  q5: "typed",
  q6: 42,
  q7: null,
  q8: { values: { "1": "wrong-blank" } },
};

assert.equal(groupSlotValue(responses, "q1"), "ii");
assert.equal(groupSlotValue(responses, "q2"), "iv");
assert.equal(groupSlotValue(responses, "q3"), null);
assert.equal(groupSlotValue(responses, "q4"), null);
assert.equal(groupSlotValue(responses, "q5"), "typed");
assert.equal(groupSlotValue(responses, "q6"), null);
assert.equal(groupSlotValue(responses, "q7"), null);
assert.equal(groupSlotValue(responses, "q8"), null);
assert.equal(groupSlotValue(responses, "missing"), null);

assert.deepEqual(setGroupSlotValue("iii"), { values: { "0": "iii" } });
assert.deepEqual(setGroupSlotValue("two words"), { values: { "0": "two words" } });
assert.deepEqual(setGroupSlotValue(null), { values: {} });
assert.deepEqual(setGroupSlotValue(""), { values: {} });
// Round-trip through the map shape the player stores.
assert.equal(groupSlotValue({ q: setGroupSlotValue("A") }, "q"), "A");

assert.equal(isSlotAnswered(responses, "q1"), true);
assert.equal(isSlotAnswered(responses, "q3"), false);

assert.deepEqual([...usedOptionIds(responses, ["q1", "q2", "q3", "q4", "q9"])], ["ii", "iv"]);
assert.deepEqual(unansweredSlotIds(responses, ["q1", "q3", "q4"]), ["q3", "q4"]);

console.log("answers.test.ts ok");
