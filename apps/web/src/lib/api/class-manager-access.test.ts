import assert from "node:assert/strict";
import test from "node:test";
import { isEligibleIeltsClass, resolveClassManagerRole } from "./class-manager-model";

test("class manager role requires teacher membership for coaches", () => {
  assert.equal(
    resolveClassManagerRole({ isAdmin: false, clubRole: "coach", hasActiveTeacherMembership: false, profileRole: "teacher" }),
    null,
  );
  assert.equal(
    resolveClassManagerRole({ isAdmin: false, clubRole: "coach", hasActiveTeacherMembership: true, profileRole: "teacher" }),
    "coach",
  );
});

test("demoting a coach profile revokes class access immediately", () => {
  assert.equal(
    resolveClassManagerRole({ isAdmin: false, clubRole: "coach", hasActiveTeacherMembership: true, profileRole: "student" }),
    null,
  );
});

test("owners and admins retain class access", () => {
  assert.equal(
    resolveClassManagerRole({ isAdmin: false, clubRole: "owner", hasActiveTeacherMembership: false, profileRole: "teacher" }),
    "owner",
  );
  assert.equal(
    resolveClassManagerRole({ isAdmin: true, clubRole: null, hasActiveTeacherMembership: false, profileRole: "admin" }),
    "admin",
  );
});

test("only active IELTS classes qualify for IELTS enrollment", () => {
  assert.equal(isEligibleIeltsClass("ielts", "active"), true);
  assert.equal(isEligibleIeltsClass("ielts", "draft"), true);
  assert.equal(isEligibleIeltsClass("ielts", "archived"), false);
  assert.equal(isEligibleIeltsClass("debate", "active"), false);
});
