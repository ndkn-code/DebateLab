import assert from "node:assert/strict";
import { decodeGradebookCursor, encodeGradebookCursor, isCurrentResponseRevision, officialOverallVisibility, reviewRevisionKey } from "./gradebook-contract";

const userId = "00000000-0000-0000-0000-000000000001";
const classId = "00000000-0000-0000-0000-000000000002";
const clubId = "00000000-0000-0000-0000-000000000003";

const cursor = encodeGradebookCursor(userId, classId, clubId);
assert.equal(decodeGradebookCursor(cursor, classId, clubId), userId);
assert.throws(() => decodeGradebookCursor(cursor, classId, "00000000-0000-0000-0000-000000000004"), /Invalid IELTS gradebook cursor/);
assert.throws(() => decodeGradebookCursor("not-a-cursor", classId, clubId), /Invalid IELTS gradebook cursor/);
assert.equal(isCurrentResponseRevision(0, 0), true);
assert.equal(isCurrentResponseRevision(0, 1), false);
assert.notEqual(reviewRevisionKey(userId, 0), reviewRevisionKey(userId, 1));
assert.deepEqual(
  officialOverallVisibility({ listening: 7, reading: 7.5, writing: 6.5, speaking: null, overall: 7 }),
  { skillCount: 3, overallIsProvisional: true, overall: null },
);
assert.deepEqual(
  officialOverallVisibility({ listening: 7, reading: 7.5, writing: 6.5, speaking: 7, overall: 7 }),
  { skillCount: 4, overallIsProvisional: false, overall: 7 },
);
