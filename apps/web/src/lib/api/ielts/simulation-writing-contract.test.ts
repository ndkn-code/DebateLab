import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseInput } from "@/lib/api/boundary";
import { SubmitAttemptSchema } from "./mock-schema";
import { CreateWritingResponseSchema, toWritingResponseInsert } from "./schema";

const action = readFileSync(
  resolve(process.cwd(), "src/app/actions/ielts/mock.ts"),
  "utf8",
);
const renderer = readFileSync(
  resolve(
    process.cwd(),
    "src/components/ielts/questions/WritingTaskRenderer.tsx",
  ),
  "utf8",
);
const bandRepository = readFileSync(
  resolve(process.cwd(), "src/lib/api/ielts/band-scores-repository.ts"),
  "utf8",
);

// Final submission locks the attempt before it creates scorer work, and it
// derives every task from the immutable attempt blueprint.
assert.match(
  action,
  /supabase\.rpc\("ielts_finalize_attempt"[\s\S]*if \(state\.attempt\.assessment_mode === "simulation"\)[\s\S]*await enqueueFrozenSimulationWriting/,
);
assert.match(action, /from\("ielts_attempt_question_blueprints"\)/);
assert.match(action, /eq\("skill", "writing"\)/);
assert.match(action, /parseWritingCaptureValue/);
assert.equal(
  (action.match(/requireNewAttemptsEnabled/g) ?? []).length,
  2,
  "feature flags gate the helper definition and new starts, not active attempts",
);
assert.match(bandRepository, /\.in\("status", \["submitted", "scoring"\]\)/);

// Simulation does not expose the interactive Practice scoring control.
assert.match(renderer, /!isSimulation/);
assert.match(renderer, /writing\.simulationAutosave/);

const submission = parseInput(SubmitAttemptSchema, {
  attemptId: "11111111-1111-4111-8111-111111111111",
  feedbackLanguage: "vi",
});
assert.equal(submission.feedbackLanguage, "vi");

// An omitted exam task is still captured as a durable zero-word response.
const blank = parseInput(CreateWritingResponseSchema, {
  attemptId: "11111111-1111-4111-8111-111111111111",
  questionId: "22222222-2222-4222-8222-222222222222",
  essay: "",
});
assert.equal(
  toWritingResponseInsert({
    input: blank,
    userId: "u-1",
    taskNumber: 1,
  }).word_count,
  0,
);

console.log("IELTS simulation Writing contract tests passed");
