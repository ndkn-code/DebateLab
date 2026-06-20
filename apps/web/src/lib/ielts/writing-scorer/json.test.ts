import assert from "node:assert/strict";
import { extractJsonObject } from "./json";

// clean JSON
assert.deepEqual(extractJsonObject('{"a":1}', "x"), { a: 1 });

// JSON wrapped in a markdown fence + prose
const fenced = 'Here is the result:\n```json\n{"band": 7}\n```\nThanks!';
assert.deepEqual(extractJsonObject(fenced, "x"), { band: 7 });

// leading prose then object
assert.deepEqual(extractJsonObject('sure: {"ok": true}', "x"), { ok: true });

// no object at all -> throws with the source label
assert.throws(() => extractJsonObject("no json here", "writing_model"), /writing_model/);

console.log("ielts/writing-scorer/json tests passed");
