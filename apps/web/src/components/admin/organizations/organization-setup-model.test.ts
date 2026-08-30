import assert from "node:assert/strict";
import {
  deriveOrganizationSetupStep,
  validateOrganizationSetupStep,
} from "./organization-setup-model";
import type { OrganizationSetupDraft } from "./OrganizationSetupWizard";

const draft: OrganizationSetupDraft = {
  organizationId: "00000000-0000-4000-8000-000000000001",
  organizationType: "school",
  name: "Thinkfy School",
  country: "VN",
  city: "Hanoi",
  timezone: "Asia/Ho_Chi_Minh",
  logoUrl: "https://thinkfy.net/logo.png",
  facebookUrl: "",
  instagramUrl: "",
  threadsUrl: "",
  inviteEmail: "teacher@example.com",
  inviteRole: "teacher",
  classId: "00000000-0000-4000-8000-000000000002",
  classTitle: "IELTS 7.0",
  programType: "ielts",
  teacherId: "00000000-0000-4000-8000-000000000003",
  courseId: "00000000-0000-4000-8000-000000000004",
  materialId: "00000000-0000-4000-8000-000000000005",
  status: "draft",
};

for (let step = 0; step < 5; step += 1) {
  assert.equal(validateOrganizationSetupStep(step, draft), "valid");
}
assert.equal(
  validateOrganizationSetupStep(1, { ...draft, name: "" }),
  "required",
);
assert.equal(
  validateOrganizationSetupStep(2, { ...draft, inviteEmail: "not-email" }),
  "invalid",
);
assert.equal(
  validateOrganizationSetupStep(3, { ...draft, teacherId: "not-a-uuid" }),
  "invalid",
);
assert.equal(
  validateOrganizationSetupStep(3, { ...draft, classTitle: "" }),
  "valid",
);
assert.equal(
  validateOrganizationSetupStep(4, {
    ...draft,
    classId: undefined,
    courseId: draft.courseId,
  }),
  "invalid",
);

assert.equal(
  deriveOrganizationSetupStep({
    status: "draft",
    hasPeople: false,
    hasClass: false,
  }),
  2,
);
assert.equal(
  deriveOrganizationSetupStep({
    status: "draft",
    hasPeople: true,
    hasClass: false,
  }),
  3,
);
assert.equal(
  deriveOrganizationSetupStep({
    status: "active",
    hasPeople: true,
    hasClass: true,
  }),
  4,
);
assert.equal(
  deriveOrganizationSetupStep({
    status: "draft",
    hasPeople: false,
    hasClass: false,
    setupVersion: 5,
  }),
  4,
);

console.log("organization setup model tests passed");
