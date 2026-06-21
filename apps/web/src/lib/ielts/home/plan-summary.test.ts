import assert from "node:assert/strict";
import {
  buildIeltsHomePlanSummary,
  daysUntilIsoDate,
  type IeltsHomePlanRow,
} from "./plan-summary";

const TODAY = "2026-06-21";

// daysUntilIsoDate ---------------------------------------------------------
assert.equal(daysUntilIsoDate("2026-06-21", TODAY), 0);
assert.equal(daysUntilIsoDate("2026-06-28", TODAY), 7);
assert.equal(daysUntilIsoDate("2026-06-20", TODAY), -1, "past dates go negative");
assert.equal(daysUntilIsoDate("2026-09-19", TODAY), 90);
assert.equal(
  daysUntilIsoDate("2026-06-28T15:30:00.000Z", TODAY),
  7,
  "timestamps key off the calendar day",
);
assert.equal(daysUntilIsoDate("not-a-date", TODAY), null);

// buildIeltsHomePlanSummary ------------------------------------------------
assert.equal(buildIeltsHomePlanSummary({ plan: null, today: TODAY }), null);

{
  const plan: IeltsHomePlanRow = {
    target_overall_band: 7,
    target_test_date: "2026-09-19",
    feedback_language: "vi",
  };
  const summary = buildIeltsHomePlanSummary({ plan, today: TODAY });
  assert.ok(summary);
  assert.equal(summary.targetOverallBand, 7);
  assert.equal(summary.targetTestDate, "2026-09-19");
  assert.equal(summary.testDateInDays, 90);
  assert.equal(summary.feedbackLanguage, "vi");
}

{
  // Blank/unparseable test date → countdown is null, summary still present.
  const plan: IeltsHomePlanRow = {
    target_overall_band: 6.5,
    target_test_date: "",
    feedback_language: "en",
  };
  const summary = buildIeltsHomePlanSummary({ plan, today: TODAY });
  assert.ok(summary);
  assert.equal(summary.testDateInDays, null);
  assert.equal(summary.feedbackLanguage, "en");
}

console.log("plan-summary.test.ts: all assertions passed");
