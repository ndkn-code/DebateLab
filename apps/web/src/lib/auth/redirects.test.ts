import assert from "node:assert/strict";
import { isAllowedAuthRedirect, resolveAuthRedirect } from "./redirects";

assert.equal(isAllowedAuthRedirect("/ielts/onboarding"), true);
assert.equal(isAllowedAuthRedirect("/ielts/home?from=onboarding"), true);
assert.equal(isAllowedAuthRedirect("/dashboard/teacher"), true);
assert.equal(isAllowedAuthRedirect("/ielts-malicious"), false);
assert.equal(isAllowedAuthRedirect("//evil.example/ielts"), false);
assert.equal(isAllowedAuthRedirect("/ielts\\evil.example"), false);
assert.equal(isAllowedAuthRedirect("https://evil.example/ielts"), false);
assert.equal(resolveAuthRedirect("/ielts/onboarding"), "/ielts/onboarding");
assert.equal(resolveAuthRedirect("//evil.example"), "/dashboard");

console.log("auth redirect tests passed");
