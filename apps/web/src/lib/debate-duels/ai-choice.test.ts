import assert from "node:assert/strict";
import test from "node:test";
import { requireExplicitAiChoice } from "./ai-choice";
const ticketId = "00000000-0000-4000-8000-000000000003";
test("a valid ticket alone, timeout, or human opponent never authorizes AI creation", () => {
  for (const body of [
    { ticketId },
    { ticketId, elapsed: 35 },
    { ticketId, opponent: "human", consent: true },
    { ticketId, opponent: "ai", consent: false },
    { ticketId, opponent: "ai", consent: "true" },
    { ticketId: "invalid", opponent: "ai", consent: true },
  ]) {
    assert.throws(() => requireExplicitAiChoice(body));
  }
});
test("explicit AI consent is bound to the selected ticket", () => {
  assert.equal(
    requireExplicitAiChoice({ ticketId, opponent: "ai", consent: true }),
    ticketId,
  );
});
