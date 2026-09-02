import assert from "node:assert/strict";
import {
  ALLOWED_QUESTION_MEDIA_TYPES,
  IELTS_QUESTION_MEDIA_BUCKET,
  MAX_QUESTION_MEDIA_BYTES,
  extensionForContentType,
  isAllowedQuestionMediaType,
  publicQuestionMediaUrl,
  questionMediaStoragePath,
} from "./storage-paths";

// --- constants match the bucket migration ----------------------------------
assert.equal(IELTS_QUESTION_MEDIA_BUCKET, "ielts-question-media");
assert.equal(MAX_QUESTION_MEDIA_BYTES, 5_242_880);
assert.deepEqual([...ALLOWED_QUESTION_MEDIA_TYPES], [
  "image/png",
  "image/jpeg",
  "image/svg+xml",
  "image/webp",
]);

// --- content type → extension ----------------------------------------------
assert.equal(extensionForContentType("image/png"), "png");
assert.equal(extensionForContentType("image/jpeg"), "jpg");
assert.equal(extensionForContentType("image/svg+xml"), "svg");
assert.equal(extensionForContentType("image/webp"), "webp");
assert.equal(extensionForContentType("image/gif"), null);
assert.equal(isAllowedQuestionMediaType("text/html"), false);

// --- test-scoped object path -------------------------------------------------
assert.equal(questionMediaStoragePath("t-1", "abc", "png"), "tests/t-1/abc.png");
assert.equal(questionMediaStoragePath("t-1", "abc", ".svg"), "tests/t-1/abc.svg");

// --- public URL: bucket path, trailing slash trimmed, null guards -----------
assert.equal(
  publicQuestionMediaUrl("https://x.supabase.co/", "tests/t-1/abc.png"),
  `https://x.supabase.co/storage/v1/object/public/${IELTS_QUESTION_MEDIA_BUCKET}/tests/t-1/abc.png`,
);
assert.equal(publicQuestionMediaUrl(undefined, "tests/t-1/abc.png"), null);
assert.equal(publicQuestionMediaUrl("https://x.supabase.co", null), null);

console.log("ielts/question-media/storage-paths tests passed");
