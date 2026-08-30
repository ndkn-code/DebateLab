import assert from "node:assert/strict";
import { TeacherReviewBandsSchema, TeacherReviewExpectedRevisionSchema } from "./teacher-review-contract";

assert.equal(TeacherReviewBandsSchema.safeParse({ taskResponse: 7, coherenceCohesion: 7, lexicalResource: 7, grammaticalRangeAccuracy: 7 }).success, true);
assert.equal(TeacherReviewBandsSchema.safeParse({ taskResponse: 7, arbitraryCriterion: 7 }).success, false);
assert.equal(TeacherReviewBandsSchema.safeParse({ fluencyCoherence: 7, lexicalResource: 7, grammaticalRangeAccuracy: 7, pronunciation: 7.25 }).success, false);
assert.equal(TeacherReviewExpectedRevisionSchema.safeParse(0).success, true);
assert.equal(TeacherReviewExpectedRevisionSchema.safeParse(1.5).success, false);
assert.equal(TeacherReviewExpectedRevisionSchema.safeParse(-1).success, false);
