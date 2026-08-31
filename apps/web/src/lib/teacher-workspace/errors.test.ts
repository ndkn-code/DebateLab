import assert from "node:assert/strict";

import { isTeacherWorkspaceAccessBoundaryError } from "./errors";

assert.equal(
  isTeacherWorkspaceAccessBoundaryError(new Error("Unauthorized")),
  true,
);
assert.equal(
  isTeacherWorkspaceAccessBoundaryError(
    new Error("teacher workspace auth: Auth session missing!"),
  ),
  true,
);
assert.equal(
  isTeacherWorkspaceAccessBoundaryError(new Error("Forbidden: class scope")),
  true,
);
assert.equal(
  isTeacherWorkspaceAccessBoundaryError(
    new Error("teacher workspace classes: database unavailable"),
  ),
  false,
);

console.log("teacher workspace error classification tests passed");
