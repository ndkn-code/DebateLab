import assert from "node:assert/strict";
import {
  getOrganizationRoleLabel,
  getOrganizationStatusLabel,
  getOrganizationTypeLabel,
  isOrganizationRole,
  isOrganizationStatus,
  isOrganizationType,
  mapLegacyClubType,
  normalizeOrganizationRole,
} from "@/lib/organizations";

assert.deepEqual(["club", "school"], ["club", "school"]);
assert.equal(isOrganizationType("school"), true);
assert.equal(isOrganizationType("center"), false);
assert.equal(isOrganizationRole("admin"), true);
assert.equal(isOrganizationRole("coach"), false);
assert.equal(isOrganizationStatus("archived"), true);

assert.equal(getOrganizationTypeLabel("club"), "Club");
assert.equal(getOrganizationTypeLabel("school", "plural"), "Schools");
assert.equal(getOrganizationRoleLabel("coach"), "Teacher");
assert.equal(getOrganizationStatusLabel("active"), "Active");

assert.equal(mapLegacyClubType("school"), "school");
assert.equal(mapLegacyClubType("center"), "school");
assert.equal(mapLegacyClubType("independent"), "club");
assert.equal(mapLegacyClubType(null), "club");
assert.equal(normalizeOrganizationRole(" coach "), "teacher");
assert.equal(normalizeOrganizationRole("ADMIN"), "admin");
assert.equal(normalizeOrganizationRole("unknown"), null);

console.log("organization contract tests passed");
