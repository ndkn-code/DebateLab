import assert from "node:assert/strict";
import {
  formatOrganizationJoinCode,
  getJoinCodeClaimMessage,
  isUsableOrganizationJoinCode,
  normalizeOrganizationJoinCode,
} from "@/lib/organizations/model";

assert.equal(normalizeOrganizationJoinCode(" abcd-1234 "), "ABCD1234");
assert.equal(formatOrganizationJoinCode("abcd1234efgh"), "ABCD-1234-EFGH");
assert.equal(isUsableOrganizationJoinCode("abc-12"), false);
assert.equal(isUsableOrganizationJoinCode("abc-123"), true);
assert.match(getJoinCodeClaimMessage("already_in_org"), /already/);

console.log("organization model tests passed");
