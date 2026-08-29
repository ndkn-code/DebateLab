import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  AI_WORKFLOW_MAX_ATTEMPTS,
  createAiWorkflowIdempotencyKey,
  isDurableAiWorkflowsEnabled,
  isRetryableWorkflowFailure,
} from "@/lib/ai/workflow-runs";

assert.equal(
  createAiWorkflowIdempotencyKey({
    kind: "practice_analysis",
    analysisJobId: "practice-job",
  }),
  "ai-workflow:practice_analysis:practice-job:v1"
);
assert.equal(
  createAiWorkflowIdempotencyKey({
    kind: "ielts_speaking_score",
    speakingResponseId: "speaking-response",
  }),
  "ai-workflow:ielts_speaking_score:speaking-response:v1"
);
assert.equal(
  createAiWorkflowIdempotencyKey({
    kind: "ielts_writing_score",
    writingResponseId: "writing-response",
  }),
  "ai-workflow:ielts_writing_score:writing-response:v1"
);

const originalFlag = process.env.AI_DURABLE_WORKFLOWS_ENABLED;
delete process.env.AI_DURABLE_WORKFLOWS_ENABLED;
assert.equal(isDurableAiWorkflowsEnabled(), false);
process.env.AI_DURABLE_WORKFLOWS_ENABLED = "true";
assert.equal(isDurableAiWorkflowsEnabled(), true);
if (originalFlag === undefined) delete process.env.AI_DURABLE_WORKFLOWS_ENABLED;
else process.env.AI_DURABLE_WORKFLOWS_ENABLED = originalFlag;

// Queue delivery is at-least-once. The SQL lease is the final authority: a
// second launcher must not claim an unexpired `starting` reservation, while
// the workflow started by the first launcher may promote it to `running`.
const migrationPath = [
  resolve(process.cwd(), "../../supabase/migrations/20260829100000_ai_durable_workflows.sql"),
  resolve(process.cwd(), "supabase/migrations/20260829100000_ai_durable_workflows.sql"),
].find(existsSync);
assert.ok(migrationPath, "durable workflow migration must be present");
const migration = readFileSync(migrationPath, "utf8");
assert.match(
  migration,
  /p_phase = 'starting'[\s\S]*run\.status = 'queued'[\s\S]*run\.status = 'starting'[\s\S]*lease_expires_at is null or run\.lease_expires_at <= now\(\)/
);
assert.match(
  migration,
  /p_phase <> 'starting'[\s\S]*run\.status = 'starting'[\s\S]*run\.status = 'running'/
);
assert.match(
  migration,
  /increment_ai_workflow_provider_attempt[\s\S]*provider_attempt_count = provider_attempt_count \+ 1[\s\S]*grant execute[\s\S]*to service_role/
);
assert.match(
  migration,
  /launch_token uuid[\s\S]*workflow_attempt_count integer[\s\S]*workflow_attempt_count < 3[\s\S]*run\.launch_token = p_launch_token/
);
assert.match(
  migration,
  /p_phase = 'starting'[\s\S]*p_launch_token is not null[\s\S]*run\.workflow_attempt_count < 3/
);
assert.equal(
  isRetryableWorkflowFailure({
    status: "failed",
    last_error_code: "RETRYABLE_WORKFLOW_FAILED",
    workflow_attempt_count: AI_WORKFLOW_MAX_ATTEMPTS - 1,
  }),
  true
);
assert.equal(
  isRetryableWorkflowFailure({
    status: "failed",
    last_error_code: "RETRYABLE_WORKFLOW_FAILED",
    workflow_attempt_count: AI_WORKFLOW_MAX_ATTEMPTS,
  }),
  false
);

const workflowRunsPath = [
  resolve(process.cwd(), "src/lib/ai/workflow-runs.ts"),
  resolve(process.cwd(), "apps/web/src/lib/ai/workflow-runs.ts"),
].find(existsSync);
assert.ok(workflowRunsPath, "workflow run persistence module must be present");
const workflowRuns = readFileSync(workflowRunsPath, "utf8");
const recordLaunch = workflowRuns.match(
  /export async function recordAiWorkflowLaunch[\s\S]*?\n}\n\nexport async function claimAiWorkflowRun/
);
assert.ok(recordLaunch, "launch persistence function must be present");
assert.doesNotMatch(recordLaunch[0], /status:\s*"starting"|phase:\s*"starting"/);
assert.match(recordLaunch[0], /\.eq\("launch_token", params\.launchToken\)/);

const stepsPath = [
  resolve(process.cwd(), "src/workflows/ai/steps.ts"),
  resolve(process.cwd(), "apps/web/src/workflows/ai/steps.ts"),
].find(existsSync);
assert.ok(stepsPath, "workflow step module must be present");
const steps = readFileSync(stepsPath, "utf8");
assert.match(
  steps,
  /claimIeltsSpeakingScore[\s\S]*?"use step"[\s\S]*?prepareIeltsSpeakingScore/
);
assert.match(
  steps,
  /claimIeltsWritingScore[\s\S]*?"use step"[\s\S]*?prepareIeltsWritingScore/
);
assert.match(
  steps,
  /preparePracticeAnalysis[\s\S]*?"use step"[\s\S]*?generatePracticeAnalysis[\s\S]*?"use step"[\s\S]*?persistPracticeAnalysis/
);

const reconcilePath = [
  resolve(process.cwd(), "src/app/api/cron/ai-workflow-reconcile/route.ts"),
  resolve(process.cwd(), "apps/web/src/app/api/cron/ai-workflow-reconcile/route.ts"),
].find(existsSync);
assert.ok(reconcilePath, "workflow reconciliation route must be present");
const reconcile = readFileSync(reconcilePath, "utf8");
assert.match(reconcile, /workflow_attempt_count >= AI_WORKFLOW_MAX_ATTEMPTS/);
assert.match(reconcile, /WORKFLOW_RETRY_EXHAUSTED/);

console.log("AI workflow contract tests passed");
