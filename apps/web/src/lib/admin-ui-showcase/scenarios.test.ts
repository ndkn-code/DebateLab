import assert from "node:assert/strict";
import {
  DEFAULT_SHOWCASE_SCENARIO_ID,
  SHOWCASE_SCENARIOS,
  SHOWCASE_SURFACES,
  getShowcaseScenario,
} from "./scenarios";

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    throw error;
  }
}

test("showcase scenario IDs are unique", () => {
  const ids = SHOWCASE_SCENARIOS.map((scenario) => scenario.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("default scenario resolves to a registered scenario", () => {
  assert.equal(
    getShowcaseScenario(DEFAULT_SHOWCASE_SCENARIO_ID).id,
    DEFAULT_SHOWCASE_SCENARIO_ID
  );
});

test("each surface has at least one registered scenario", () => {
  for (const surface of SHOWCASE_SURFACES) {
    assert.ok(
      SHOWCASE_SCENARIOS.some((scenario) => scenario.surface === surface.id),
      `${surface.id} should have at least one scenario`
    );
  }
});

test("side-effectful scenarios are explicitly showcase safe", () => {
  for (const scenario of SHOWCASE_SCENARIOS) {
    if (scenario.risk !== "none") {
      assert.equal(
        scenario.showcaseSafe,
        true,
        `${scenario.id} must be marked showcaseSafe`
      );
    }
  }
});
