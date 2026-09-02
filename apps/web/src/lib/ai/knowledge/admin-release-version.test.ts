import assert from "node:assert/strict";
import test from "node:test";

import { resolveKnowledgePreflightVersion } from "./admin";

test("admin preflight selects the newest draft rather than a hardcoded version", () => {
  assert.deepEqual(
    resolveKnowledgePreflightVersion({
      activeVersion: 3,
      versions: [
        { version: 3, status: "published" },
        { version: 4, status: "draft" },
        { version: 6, status: "draft" },
      ],
    }),
    { version: 6, status: "draft" },
  );
});

test("admin preflight falls back only to the typed active release", () => {
  assert.deepEqual(
    resolveKnowledgePreflightVersion({
      activeVersion: 3,
      versions: [
        { version: 5, status: "rejected" },
        { version: 3, status: "published" },
      ],
    }),
    { version: 3, status: "published" },
  );
  assert.equal(
    resolveKnowledgePreflightVersion({
      activeVersion: 2,
      versions: [{ version: 5, status: "rejected" }],
    }),
    null,
  );
});
