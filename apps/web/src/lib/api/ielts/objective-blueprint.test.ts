import assert from "node:assert/strict";
import test from "node:test";
import { isFrozenObjectiveBlueprintMissing } from "./objective-blueprint";

test("writing-only frozen attempts do not require an objective blueprint", () => {
  assert.equal(
    isFrozenObjectiveBlueprintMissing({
      frozen: true,
      objectiveSectionCount: 0,
      objectiveBlueprintCount: 0,
    }),
    false,
  );
});

test("frozen objective attempts fail closed when their blueprint is missing", () => {
  assert.equal(
    isFrozenObjectiveBlueprintMissing({
      frozen: true,
      objectiveSectionCount: 1,
      objectiveBlueprintCount: 0,
    }),
    true,
  );
  assert.equal(
    isFrozenObjectiveBlueprintMissing({
      frozen: true,
      objectiveSectionCount: 2,
      objectiveBlueprintCount: 40,
    }),
    false,
  );
});

test("legacy unfrozen attempts retain the compatibility path", () => {
  assert.equal(
    isFrozenObjectiveBlueprintMissing({
      frozen: false,
      objectiveSectionCount: 2,
      objectiveBlueprintCount: 0,
    }),
    false,
  );
});
