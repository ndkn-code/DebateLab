import assert from "node:assert/strict";
import { AssignIeltsMockSchema } from "./assignments-schema";

const parsed = AssignIeltsMockSchema.parse({
  clubId: "fcd8a9e8-8ca6-448f-a237-4541b7175c61",
  classId: "35f784e2-705c-498f-8df8-17332dbb65f4",
  // First-party seeded tests use canonical PostgreSQL UUIDs without an RFC
  // version nibble. They must remain assignable through the teacher UI.
  testId: "ffdb3ba9-0553-ebe1-ad80-d53a31677491",
});

assert.equal(parsed.testId, "ffdb3ba9-0553-ebe1-ad80-d53a31677491");
assert.equal(
  AssignIeltsMockSchema.safeParse({
    clubId: parsed.clubId,
    classId: parsed.classId,
    testId: "not-a-uuid",
  }).success,
  false,
);

console.log("IELTS assignment schema tests passed");
