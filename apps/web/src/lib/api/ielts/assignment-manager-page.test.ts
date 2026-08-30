import assert from "node:assert/strict";
import test from "node:test";
import { filterAssignableIeltsClasses } from "./assignment-manager-model";

const orgAClassA = { id: "class-a", title: "Class A", club_id: "org-a", teacher_user_id: "coach-a" };
const orgAClassB = { id: "class-b", title: "Class B", club_id: "org-a", teacher_user_id: "coach-b" };
const orgBClassA = { id: "class-b-org-b", title: "Class A (other org)", club_id: "org-b", teacher_user_id: "coach-a" };

test("an assigned teacher sees only their class titles within the organization", () => {
  assert.deepEqual(
    filterAssignableIeltsClasses([orgAClassA, orgAClassB, orgBClassA], {
      actorId: "coach-a",
      clubId: "org-a",
      isAdmin: false,
      clubRole: "coach",
    }),
    [{ id: "class-a", title: "Class A" }],
  );
});

test("owners and admins retain all allowed IELTS classes", () => {
  for (const scope of [
    { actorId: "owner", isAdmin: false, clubRole: "owner" },
    { actorId: "admin", isAdmin: true, clubRole: "admin" },
  ]) {
    assert.deepEqual(
      filterAssignableIeltsClasses([orgAClassA, orgAClassB, orgBClassA], { ...scope, clubId: "org-a" }),
      [
        { id: "class-a", title: "Class A" },
        { id: "class-b", title: "Class B" },
      ],
    );
  }
});

test("legacy coach input remains class-scoped", () => {
  assert.deepEqual(
    filterAssignableIeltsClasses([orgAClassA, orgAClassB], {
      actorId: "coach-a",
      clubId: "org-a",
      isAdmin: false,
      clubRole: "coach",
    }),
    [{ id: "class-a", title: "Class A" }],
  );
});
