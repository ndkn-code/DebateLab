import assert from "node:assert/strict";
import {
  IELTS_ROUTES,
  ieltsLoginHref,
  ieltsPaths,
  ieltsSignupHref,
  localizedPath,
} from "./routes";

// Existing exports keep working.
assert.equal(IELTS_ROUTES.home, "/ielts/home");
assert.equal(ieltsLoginHref(), "/auth/login?next=%2Fielts%2Fonboarding");
assert.equal(ieltsSignupHref("/ielts/home"), "/auth/signup?next=%2Fielts%2Fhome");

assert.equal(ieltsPaths.home, "/ielts/home");
assert.equal(ieltsPaths.tests, "/ielts/tests");
assert.equal(ieltsPaths.review, "/ielts/review");
assert.equal(ieltsPaths.studyPlan, "/ielts/study-plan");

assert.equal(ieltsPaths.mock("academic-01"), "/ielts/mock/academic-01");
assert.equal(ieltsPaths.mock("academic-01", {}), "/ielts/mock/academic-01");
assert.equal(
  ieltsPaths.mock("academic-01", { experience: "practice", attempt: "att-1" }),
  "/ielts/mock/academic-01?experience=practice&attempt=att-1",
);
assert.equal(
  ieltsPaths.mock("academic-01", {
    returnTo: "/ielts/assigned?tab=due",
    assignment: "asg-7",
    experience: undefined,
  }),
  "/ielts/mock/academic-01?returnTo=%2Fielts%2Fassigned%3Ftab%3Ddue&assignment=asg-7",
);
assert.equal(ieltsPaths.mock("a b/c"), "/ielts/mock/a%20b%2Fc");

assert.equal(ieltsPaths.results("att-1"), "/ielts/attempts/att-1/results");

assert.equal(localizedPath("vi", ieltsPaths.tests), "/vi/ielts/tests");
assert.equal(localizedPath("en", "ielts/home"), "/en/ielts/home");
assert.equal(
  localizedPath("en", ieltsPaths.mock("m", { attempt: "x" })),
  "/en/ielts/mock/m?attempt=x",
);

console.log("routes.test.ts ok");
