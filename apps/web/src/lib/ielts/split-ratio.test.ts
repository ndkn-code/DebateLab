import assert from "node:assert/strict";
import {
  SPLIT_DEFAULT,
  SPLIT_MAX,
  SPLIT_MIN,
  clampSplitRatio,
  parseStoredSplitRatio,
  splitStorageKey,
} from "./split-ratio";

assert.equal(SPLIT_MIN, 0.3);
assert.equal(SPLIT_MAX, 0.7);

assert.equal(clampSplitRatio(0.5), 0.5);
assert.equal(clampSplitRatio(0.1), SPLIT_MIN);
assert.equal(clampSplitRatio(0.95), SPLIT_MAX);
assert.equal(clampSplitRatio(Number.NaN), SPLIT_DEFAULT);
assert.equal(clampSplitRatio(Number.POSITIVE_INFINITY), SPLIT_DEFAULT);

assert.equal(parseStoredSplitRatio(null), null);
assert.equal(parseStoredSplitRatio(""), null);
assert.equal(parseStoredSplitRatio("   "), null);
assert.equal(parseStoredSplitRatio("abc"), null);
assert.equal(parseStoredSplitRatio("0.42"), 0.42);
assert.equal(parseStoredSplitRatio(" 0.42 "), 0.42);
assert.equal(parseStoredSplitRatio("0.05"), SPLIT_MIN);
assert.equal(parseStoredSplitRatio("2"), SPLIT_MAX);

assert.equal(splitStorageKey("att-1"), "ielts:mock:att-1:split");

console.log("split-ratio.test.ts ok");
