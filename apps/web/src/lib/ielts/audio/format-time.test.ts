import assert from "node:assert/strict";
import { formatTime } from "./format-time";

assert.equal(formatTime(0), "0:00");
assert.equal(formatTime(5), "0:05");
assert.equal(formatTime(65.9), "1:05");
assert.equal(formatTime(600), "10:00");
assert.equal(formatTime(3599), "59:59");
assert.equal(formatTime(3600), "60:00");
// Junk never throws and never renders "NaN".
assert.equal(formatTime(Number.NaN), "0:00");
assert.equal(formatTime(Number.POSITIVE_INFINITY), "0:00");
assert.equal(formatTime(-3), "0:00");

console.log("ielts/audio/format-time tests passed");
