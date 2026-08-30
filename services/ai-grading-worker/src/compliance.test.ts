import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(process.cwd(), "../..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

test("AI grading has no Vercel Workflow or grading trigger surface", () => {
  const webPackage = JSON.parse(read("apps/web/package.json")) as {
    dependencies: Record<string, string>;
  };
  const vercel = read("apps/web/vercel.json");
  assert.equal(webPackage.dependencies.workflow, undefined);
  assert.doesNotMatch(vercel, /practice-analysis|ielts-writing-analysis|ielts-speaking-analysis|ai-workflow-reconcile/);
  assert.throws(() => read("apps/web/src/app/api/cron/ai-workflow-reconcile/route.ts"));
  assert.throws(() => read("apps/web/src/app/api/queues/practice-analysis/route.ts"));
  assert.throws(() => read("apps/web/src/app/api/queues/ielts-writing/route.ts"));
  assert.throws(() => read("apps/web/src/app/api/queues/ielts-speaking/route.ts"));
});
test("the GCP migration fences claims, checkpoints, retries, and private grants", () => {
  const migration = read(
    "supabase/migrations/20260830160000_ai_grading_gcp_runtime.sql",
  );
  assert.match(migration, /worker_claim_token = v_claim/);
  assert.match(migration, /workflow_attempt_count >= 3/);
  assert.match(migration, /AI_GRADING_OUTPUT_CONFLICT/);
  assert.match(migration, /PROVIDER_OUTCOME_UNKNOWN/);
  assert.match(migration, /revoke all on public\.ai_grading_checkpoints from public, anon, authenticated/);
  assert.match(migration, /to service_role/);
});
