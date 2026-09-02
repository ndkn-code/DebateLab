import assert from "node:assert/strict";
import test from "node:test";

import { parseKnowledgeDraftArgs } from "./release-cli";

const USER_ID = "8ab4ff4f-17ee-4c6f-bc11-0c224be2ce76";

test("release draft requires and preserves a submitted-by UUID", () => {
  assert.deepEqual(
    parseKnowledgeDraftArgs(["--submitted-by", USER_ID], {
      minimumVersion: 4,
      defaultVersion: 4,
    }),
    { collectionVersion: 4, submittedBy: USER_ID },
  );
  assert.equal(
    parseKnowledgeDraftArgs(
      ["--collection-version", "7", "--submitted-by", USER_ID],
      { minimumVersion: 4, defaultVersion: 4 },
    ).collectionVersion,
    7,
  );
});

test("release draft rejects missing, null-like, and malformed submitters", () => {
  for (const argv of [
    [],
    ["--submitted-by", ""],
    ["--submitted-by", "null"],
    ["--submitted-by", "not-a-uuid"],
  ]) {
    assert.throws(() =>
      parseKnowledgeDraftArgs(argv, {
        minimumVersion: 4,
        defaultVersion: 4,
      }),
    );
  }
});
