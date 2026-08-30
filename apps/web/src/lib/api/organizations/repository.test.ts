import assert from "node:assert/strict";
import {
  ORGANIZATION_RPC_NAMES,
  normalizeOrganizationEmail,
  normalizeOrganizationName,
  normalizeOrganizationRpcResult,
  validateCreateOrganizationDraft,
  validateOrganizationAssignment,
  validateOrganizationClass,
  validateOrganizationInvite,
  validateOrganizationActivation,
  validateUpdateOrganization,
} from "./repository";

const id = "00000000-0000-4000-8000-000000000001";
const key = "org-setup-test-001";

assert.equal(ORGANIZATION_RPC_NAMES.createDraft, "create_organization_draft_transaction");
assert.equal(normalizeOrganizationName("  IELTS   Center "), "IELTS Center");
assert.equal(normalizeOrganizationName("x"), null);
assert.equal(normalizeOrganizationEmail(" Teacher@Example.COM "), "teacher@example.com");
assert.equal(normalizeOrganizationEmail("not-an-email"), null);

assert.equal(validateCreateOrganizationDraft({ name: "Debate Club", organizationType: "club", idempotencyKey: key }).ok, true);
assert.equal(validateCreateOrganizationDraft({ name: "Debate Club", organizationType: "center" as never, idempotencyKey: key }).ok, false);
assert.equal(validateCreateOrganizationDraft({ name: "Debate Club", organizationType: "club", idempotencyKey: "x" }).ok, false);

assert.equal(validateUpdateOrganization({ organizationId: id, name: "Academy", idempotencyKey: key }).ok, true);
assert.equal(validateUpdateOrganization({ organizationId: "bad", idempotencyKey: key }).ok, false);
assert.equal(validateUpdateOrganization({ organizationId: id, facebookUrl: "http://facebook.com/a", idempotencyKey: key }).ok, false);

assert.equal(validateOrganizationInvite({ organizationId: id, email: "a@example.com", role: "admin", idempotencyKey: key }).ok, true);
assert.equal(validateOrganizationInvite({ organizationId: id, email: "a@example.com", role: "coach" as never, idempotencyKey: key }).ok, false);

assert.equal(validateOrganizationClass({ organizationId: id, title: "Evening IELTS", idempotencyKey: key }).ok, true);
assert.equal(validateOrganizationClass({ organizationId: id, title: "Evening IELTS", startDate: "2026-09-10", endDate: "2026-09-01", idempotencyKey: key }).ok, false);
assert.equal(validateOrganizationAssignment({ organizationId: id, classId: id, teacherId: id, idempotencyKey: key }).ok, true);
assert.equal(validateOrganizationActivation({ organizationId: id, idempotencyKey: key }).ok, true);

assert.deepEqual(normalizeOrganizationRpcResult({ organization_id: id, status: "active", setup_version: 2 }), {
  organizationId: id,
  status: "active",
  setupVersion: 2,
  setupCompletedAt: null,
  onboardingCompletedAt: null,
});

console.log("organization repository tests passed");
