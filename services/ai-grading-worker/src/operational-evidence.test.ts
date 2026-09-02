import assert from "node:assert/strict";
import test from "node:test";
import {
  assertOperationalEvidenceComplete,
  assertOperationalTarget,
  assertScenarioToken,
  operationalScenarioCounts,
  type OperationalEvidenceState,
} from "./operational-evidence";
import { OPERATIONAL_FAULT_SCENARIOS } from "./operational-faults";

const target = {
  AI_GRADING_OPERATIONAL_ENVIRONMENT: "staging",
  AI_GRADING_OPERATIONAL_TARGET_URL:
    "https://ai-grading-worker-staging-example.run.app",
  AI_GRADING_OPERATIONAL_DEPLOYMENT_REF: "codex/ai-calibration-smoke",
  NEXT_PUBLIC_SUPABASE_URL: "https://stagingref01.supabase.co",
  AI_GRADING_OPERATIONAL_DATABASE_REF: "stagingref01",
  AI_GRADING_PRODUCTION_DATABASE_REF: "productionref01",
};

function state(): OperationalEvidenceState {
  return {
    schemaVersion: 1,
    evidenceId: "00000000-0000-4000-8000-000000000001",
    environment: "staging",
    targetUrl: target.AI_GRADING_OPERATIONAL_TARGET_URL,
    deploymentRef: target.AI_GRADING_OPERATIONAL_DEPLOYMENT_REF,
    databaseRef: target.AI_GRADING_OPERATIONAL_DATABASE_REF,
    scenarios: {},
    sealed: false,
  };
}

test("the ops target rejects production environment, URL, and refs", () => {
  assert.throws(
    () =>
      assertOperationalTarget({
        ...target,
        AI_GRADING_OPERATIONAL_ENVIRONMENT: "production",
      }),
    /OPERATIONAL_ENVIRONMENT_INVALID/,
  );
  assert.throws(
    () =>
      assertOperationalTarget({
        ...target,
        AI_GRADING_OPERATIONAL_TARGET_URL: "https://thinkfy.net",
      }),
    /TARGET_URL_NOT_NONPRODUCTION/,
  );
  assert.throws(
    () =>
      assertOperationalTarget({
        ...target,
        AI_GRADING_OPERATIONAL_DEPLOYMENT_REF: "refs/heads/main",
      }),
    /DEPLOYMENT_REF_PRODUCTION/,
  );
  assert.deepEqual(assertOperationalTarget(target), {
    environment: "staging",
    targetUrl: target.AI_GRADING_OPERATIONAL_TARGET_URL,
    deploymentRef: target.AI_GRADING_OPERATIONAL_DEPLOYMENT_REF,
    databaseRef: target.AI_GRADING_OPERATIONAL_DATABASE_REF,
  });
});

test("the ops target rejects a production or mismatched Supabase ref", () => {
  assert.throws(
    () =>
      assertOperationalTarget({
        ...target,
        AI_GRADING_OPERATIONAL_DATABASE_REF: "productionref01",
      }),
    /DATABASE_REFS_INVALID|DATABASE_IDENTITY_MISMATCH/,
  );
  assert.throws(
    () =>
      assertOperationalTarget({
        ...target,
        NEXT_PUBLIC_SUPABASE_URL: "https://differentref01.supabase.co",
      }),
    /DATABASE_IDENTITY_MISMATCH/,
  );
});

test("sealing requires all five finalized scenarios", () => {
  const evidence = state();
  assert.deepEqual(operationalScenarioCounts(evidence), {
    required: 5,
    declared: 0,
    finalized: 0,
  });
  assert.throws(
    () => assertOperationalEvidenceComplete(evidence),
    /SCENARIOS_INCOMPLETE/,
  );
  for (const [index, scenario] of OPERATIONAL_FAULT_SCENARIOS.entries()) {
    evidence.scenarios[scenario] = {
      workflowRunId: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      claimId: `00000000-0000-4000-8000-${String(index + 11).padStart(12, "0")}`,
      injectionToken: `00000000-0000-4000-8000-${String(index + 21).padStart(12, "0")}`,
      finalized: true,
    };
  }
  assert.doesNotThrow(() => assertOperationalEvidenceComplete(evidence));
});

test("finalization token must match the protected declared token", () => {
  const evidence = state();
  evidence.scenarios.duplicate_delivery = {
    workflowRunId: "00000000-0000-4000-8000-000000000010",
    claimId: "00000000-0000-4000-8000-000000000011",
    injectionToken: "00000000-0000-4000-8000-000000000012",
    finalized: false,
  };
  assert.throws(
    () =>
      assertScenarioToken({
        state: evidence,
        scenario: "duplicate_delivery",
        configuredTokens: "00000000-0000-4000-8000-000000000099",
      }),
    /FAULT_BINDING_MISMATCH/,
  );
  assert.doesNotThrow(() =>
    assertScenarioToken({
      state: evidence,
      scenario: "duplicate_delivery",
      configuredTokens: "00000000-0000-4000-8000-000000000012",
    }),
  );
});
