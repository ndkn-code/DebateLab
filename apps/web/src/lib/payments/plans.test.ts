import assert from "node:assert/strict";
import {
  cycleMonths,
  FEATURE_LIMITS,
  findPlan,
  marketFromCurrency,
  PLAN_CATALOG,
  UNLIMITED,
} from "./plans";

// Catalog lookups.
const vnMonthly = findPlan("premium", "monthly", "vn");
assert.ok(vnMonthly);
assert.equal(vnMonthly.amountMajor, 197000);
assert.equal(vnMonthly.currency, "VND");
assert.equal(vnMonthly.stripePriceEnv, "NEXT_PUBLIC_STRIPE_PRICE_MONTHLY_VN");

const globalYear = findPlan("premium", "yearly", "global");
assert.ok(globalYear);
assert.equal(globalYear.amountMajor, 144);
assert.equal(globalYear.currency, "USD");

assert.equal(findPlan("free", "monthly", "vn"), undefined);
assert.equal(PLAN_CATALOG.length, 6);

// Market inference.
assert.equal(marketFromCurrency("VND"), "vn");
assert.equal(marketFromCurrency("vnd"), "vn");
assert.equal(marketFromCurrency("USD"), "global");

// Cycle months.
assert.equal(cycleMonths("monthly"), 1);
assert.equal(cycleMonths("three_months"), 3);
assert.equal(cycleMonths("six_months"), 6);
assert.equal(cycleMonths("yearly"), 12);
assert.equal(cycleMonths("custom"), 1);

// Feature limits retuned for Thinkfy.
assert.equal(FEATURE_LIMITS.free.aiWritingScoresPerMonth, 3);
assert.equal(FEATURE_LIMITS.free.fullMockTestsPerMonth, 1);
assert.equal(FEATURE_LIMITS.free.pronunciationReports, false);
assert.equal(FEATURE_LIMITS.premium.aiWritingScoresPerMonth, UNLIMITED);
assert.equal(FEATURE_LIMITS.premium.pronunciationReports, true);
assert.equal(FEATURE_LIMITS.enterprise.studyPlan, true);

console.log("payments/plans tests passed");
