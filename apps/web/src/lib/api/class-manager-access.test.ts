import assert from "node:assert/strict";
import test from "node:test";
import { isEligibleIeltsClass, resolveClassManagerRole } from "./class-manager-model";

test("class manager role requires teacher membership for teachers", () => {
  assert.equal(
    resolveClassManagerRole({ isAdmin: false, clubRole: "coach", hasActiveTeacherMembership: false, profileRole: "teacher" }),
    null,
  );
  assert.equal(
    resolveClassManagerRole({ isAdmin: false, clubRole: "coach", hasActiveTeacherMembership: true, profileRole: "teacher" }),
    "teacher",
  );
});

test("demoting a teacher profile revokes class access immediately", () => {
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
  assert.equal(
    resolveClassManagerRole({ isAdmin: false, clubRole: "admin", hasActiveTeacherMembership: false, profileRole: "student" }),
    "admin",
  );
});

test("head teachers manage every class in their organization", () => {
  assert.equal(
    resolveClassManagerRole({
      isAdmin: false,
      clubRole: "head_teacher",
      hasActiveTeacherMembership: false,
      profileRole: "student",
    }),
    "head_teacher",
  );
});

test("legacy coach membership is accepted but returned as canonical teacher", () => {
  assert.equal(
    resolveClassManagerRole({ isAdmin: false, clubRole: "coach", hasActiveTeacherMembership: true, profileRole: "teacher" }),
    "teacher",
  );
});

test("only active IELTS classes qualify for IELTS enrollment", () => {
  assert.equal(isEligibleIeltsClass("ielts", "active"), true);
  assert.equal(isEligibleIeltsClass("ielts", "draft"), true);
  assert.equal(isEligibleIeltsClass("ielts", "archived"), false);
  assert.equal(isEligibleIeltsClass("debate", "active"), false);
});
