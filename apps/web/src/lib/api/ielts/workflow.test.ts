/**
 * Unit tests for the content status workflow (WS-1.1).
 */
import assert from "node:assert/strict";
import { allowedTransitions, assertTransition, canTransition, isPublishTransition } from "./workflow";

// the happy path Draft → In QA → Approved → Published
assert.ok(canTransition("draft", "in_qa"));
assert.ok(canTransition("in_qa", "approved"));
assert.ok(canTransition("approved", "published"));

// "Needs fix" bounces QA/approved back to draft
assert.ok(canTransition("in_qa", "draft"));
assert.ok(canTransition("approved", "draft"));

// you cannot skip straight from draft to published
assert.ok(!canTransition("draft", "published"));
assert.ok(!canTransition("draft", "approved"));

// published can be archived or unpublished to draft for a new version
assert.deepEqual([...allowedTransitions("published")].sort(), ["archived", "draft"]);
assert.ok(canTransition("archived", "draft"));

assert.ok(isPublishTransition("published"));
assert.ok(!isPublishTransition("approved"));

assert.throws(() => assertTransition("draft", "published"), /Invalid IELTS content status transition/);
assert.doesNotThrow(() => assertTransition("draft", "in_qa"));

console.log("IELTS workflow tests passed");
