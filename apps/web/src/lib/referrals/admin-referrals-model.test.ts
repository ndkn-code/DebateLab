import assert from "node:assert/strict";
import {
  buildReferralKpis,
  buildTopReferrerAggregates,
  normalizeAdminReferralFilters,
} from "./admin-referrals-model";

assert.deepEqual(normalizeAdminReferralFilters({ status: "credited", search: "  a@b.com  ", page: "2" }), {
  status: "credited",
  search: "a@b.com",
  page: 2,
});
assert.deepEqual(normalizeAdminReferralFilters({ status: "unknown", page: "-4" }), {
  status: "all",
  search: "",
  page: 1,
});

const rows = [
  { referrerId: "b", status: "pending", referrerOrbsAwarded: 0, refereeOrbsAwarded: 0 },
  { referrerId: "a", status: "qualified", referrerOrbsAwarded: 0, refereeOrbsAwarded: 0 },
  { referrerId: "a", status: "credited", referrerOrbsAwarded: 600, refereeOrbsAwarded: 600 },
];

assert.deepEqual(buildReferralKpis(rows), { total: 3, qualified: 2, credited: 1, orbsAwarded: 1200 });
assert.deepEqual(buildTopReferrerAggregates(rows, 1), [
  { referrerId: "a", referralCount: 2, orbsAwarded: 600 },
]);
assert.deepEqual(buildTopReferrerAggregates([], 5), []);

console.log("admin referrals model tests passed");
