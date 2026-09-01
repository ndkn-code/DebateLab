import assert from "node:assert/strict";

import {
  decideIeltsSubmissionReplay,
  IeltsSubmissionConflictError,
} from "./submission-replay";

assert.equal(
  decideIeltsSubmissionReplay({
    hasExisting: false,
    samePayload: false,
    terminal: false,
  }),
  "new",
);
assert.equal(
  decideIeltsSubmissionReplay({
    hasExisting: true,
    samePayload: true,
    terminal: false,
  }),
  "resume",
);
assert.equal(
  decideIeltsSubmissionReplay({
    hasExisting: true,
    samePayload: true,
    terminal: true,
  }),
  "terminal",
);
assert.equal(
  decideIeltsSubmissionReplay({
    hasExisting: true,
    samePayload: false,
    terminal: true,
  }),
  "conflict",
);
assert.match(
  new IeltsSubmissionConflictError().message,
  /new practice attempt/i,
);

console.log("IELTS submission replay tests passed");
