import assert from "node:assert/strict";
import test from "node:test";
import type { AiGradingDelivery } from "@/lib/ai/grading/contracts";
import type { AiGradingOperations } from "./processor";
import { processAiGradingDelivery } from "./processor";
import type { AiGradingRepository, ClaimResult } from "./repository";
import {
  OPERATIONAL_FAULT_SCENARIOS,
  readOperationalFaultConfiguration,
  resolveOperationalFaultPlan,
  type OperationalFaultScenario,
} from "./operational-faults";

const INJECTION_TOKEN = "00000000-0000-4000-8000-000000000099";
const RUN_ID = "00000000-0000-4000-8000-000000000002";
const environment = {
  AI_GRADING_OPERATIONAL_FAULT_INJECTION_ENABLED: "true",
  AI_GRADING_OPERATIONAL_ATTESTATION_ENABLED: "true",
  AI_GRADING_OPERATIONAL_ENVIRONMENT: "staging",
  AI_GRADING_OPERATIONAL_FAULT_INJECTION_TOKENS: INJECTION_TOKEN,
  CLOUD_RUN_SERVICE_URL:
    "https://ai-grading-worker-staging-example.run.app",
  K_REVISION: "ai-grading-worker-staging-smoke-001",
  NEXT_PUBLIC_SUPABASE_URL: "https://stagingref01.supabase.co",
  AI_GRADING_OPERATIONAL_DATABASE_REF: "stagingref01",
  AI_GRADING_PRODUCTION_DATABASE_REF: "productionref01",
};
const delivery: AiGradingDelivery = {
  job: {
    schemaVersion: 1,
    kind: "ielts_writing_score",
    sourceId: "00000000-0000-4000-8000-000000000001",
    workflowRunId: RUN_ID,
  },
  messageId: "message-1",
  deliveryAttempt: 1,
};

function operations(overrides: Partial<AiGradingOperations> = {}) {
  return {
    claimSource: async () => "claimed" as const,
    prepare: async () => ({ prompt: "prepared" }),
    generate: async () => ({ score: 7 }),
    persist: async () => undefined,
    afterPersist: async () => undefined,
    failSource: async () => undefined,
    ...overrides,
  } satisfies AiGradingOperations;
}

function fakeRepository(scenario: OperationalFaultScenario) {
  let active = false;
  let completed = false;
  let attempt = 0;
  let prepared: unknown | null = null;
  let output: unknown | null = null;
  let providerStarted = false;
  let providerReservations = 0;
  let operationalBoundaryAttempts = 0;
  const repository: AiGradingRepository = {
    async loadOperationalEnvironmentMarker() {
      return { environment: "staging", projectRef: "stagingref01" };
    },
    async claim(): Promise<ClaimResult> {
      if (completed)
        return {
          outcome: "completed",
          claimToken: null,
          attemptCount: attempt,
          manualRetryCount: 0,
          preparedPayload: prepared,
          outputPayload: output,
          outputHash: null,
          providerStartedAt: providerStarted ? new Date().toISOString() : null,
        };
      if (active)
        return {
          outcome: "lease_active",
          claimToken: null,
          attemptCount: attempt,
          manualRetryCount: 0,
          preparedPayload: prepared,
          outputPayload: output,
          outputHash: null,
          providerStartedAt: providerStarted ? new Date().toISOString() : null,
        };
      active = true;
      attempt += 1;
      return {
        outcome: "claimed",
        claimToken: `claim-${attempt}`,
        attemptCount: attempt,
        manualRetryCount: 0,
        preparedPayload: prepared,
        outputPayload: output,
        outputHash: null,
        providerStartedAt: providerStarted ? new Date().toISOString() : null,
      };
    },
    async loadOperationalFault() {
      return {
        scenario,
        injectionToken: INJECTION_TOKEN,
        environment: "staging",
      };
    },
    async recordOperationalBoundaryAttempt() {
      operationalBoundaryAttempts += 1;
      return true;
    },
    async recordTransition() {
      return true;
    },
    async checkpointPrepared(_run, _claim, value) {
      prepared = value;
    },
    async reserveProvider() {
      if (providerStarted && output === null) return "outcome_unknown";
      providerStarted = true;
      providerReservations += 1;
      return output === null ? "reserved" : "output_ready";
    },
    async checkpointProviderFailure() {
      providerStarted = false;
    },
    async checkpointOutput(_run, _claim, value) {
      output = value;
    },
    async complete() {
      completed = true;
      active = false;
      return true;
    },
    async fail(_run, _claim, params) {
      active = false;
      return params.retryable ? "retryable" : "fatal";
    },
  };
  return {
    repository,
    expireLease() {
      active = false;
    },
    providerReservations() {
      return providerReservations;
    },
    operationalBoundaryAttempts() {
      return operationalBoundaryAttempts;
    },
  };
}

test("fault injection cannot be enabled for a production environment", () => {
  assert.throws(
    () =>
      readOperationalFaultConfiguration({
        ...environment,
        AI_GRADING_OPERATIONAL_ENVIRONMENT: "production",
      }),
    /OPERATIONAL_ENVIRONMENT_INVALID/,
  );
  assert.throws(
    () =>
      readOperationalFaultConfiguration({
        ...environment,
        AI_GRADING_OPERATIONAL_ATTESTATION_ENABLED: "false",
      }),
    /OPERATIONAL_ATTESTATION_REQUIRED/,
  );
  assert.throws(
    () =>
      readOperationalFaultConfiguration({
        ...environment,
        CLOUD_RUN_SERVICE_URL: "https://ai-grading-worker-prod.run.app",
      }),
    /RUNTIME_NOT_NONPRODUCTION/,
  );
  assert.throws(
    () =>
      readOperationalFaultConfiguration({
        ...environment,
        AI_GRADING_OPERATIONAL_DATABASE_REF: "productionref01",
      }),
    /DATABASE_REFS_INVALID|DATABASE_IDENTITY_MISMATCH/,
  );
});

test("invalid fault configuration performs no claim, source, or provider work", async () => {
  let claimCalls = 0;
  let sourceCalls = 0;
  let providerCalls = 0;
  const repository: AiGradingRepository = {
    ...fakeRepository("duplicate_delivery").repository,
    async claim() {
      claimCalls += 1;
      throw new Error("claim must not run");
    },
  };
  await assert.rejects(
    () =>
      processAiGradingDelivery(delivery, {
        repository,
        operations: operations({
          async claimSource() {
            sourceCalls += 1;
            return "claimed";
          },
          async generate() {
            providerCalls += 1;
            return { score: 7 };
          },
        }),
        operationalFaultEnvironment: {
          ...environment,
          AI_GRADING_OPERATIONAL_ENVIRONMENT: "production",
        },
      }),
    /OPERATIONAL_ENVIRONMENT_INVALID/,
  );
  assert.deepEqual({ claimCalls, sourceCalls, providerCalls }, {
    claimCalls: 0,
    sourceCalls: 0,
    providerCalls: 0,
  });
});

test("the protected DB claim token is bound to the smoke revision token", async () => {
  const repository: AiGradingRepository = {
    ...fakeRepository("duplicate_delivery").repository,
    async loadOperationalFault() {
      return {
        scenario: "duplicate_delivery",
        injectionToken: "00000000-0000-4000-8000-000000000088",
        environment: "staging",
      };
    },
  };
  await assert.rejects(
    () =>
      resolveOperationalFaultPlan({
        repository,
        job: delivery.job,
        claimToken: "claim-1",
        attemptCount: 1,
        environment,
      }),
    /OPERATIONAL_FAULT_BINDING_MISMATCH/,
  );
});

test("duplicate non-ack is one-shot and cannot duplicate provider charge", async () => {
  const fake = fakeRepository("duplicate_delivery");
  let providerCalls = 0;
  const ops = operations({
    async generate() {
      providerCalls += 1;
      return { score: 7 };
    },
  });
  assert.equal(
    await processAiGradingDelivery(delivery, {
      repository: fake.repository,
      operations: ops,
      operationalAttestationEnabled: true,
      operationalFaultEnvironment: environment,
    }),
    "operational_non_ack",
  );
  assert.equal(
    await processAiGradingDelivery(
      { ...delivery, deliveryAttempt: 2, messageId: "redelivery" },
      {
        repository: fake.repository,
        operations: ops,
        operationalAttestationEnabled: true,
        operationalFaultEnvironment: environment,
      },
    ),
    "completed",
  );
  assert.equal(providerCalls, 1);
  assert.equal(fake.providerReservations(), 1);
});

test("ambiguous timeout reserves once and never calls or repays the provider", async () => {
  const fake = fakeRepository("provider_timeout");
  let providerCalls = 0;
  const ops = operations({
    async generate() {
      providerCalls += 1;
      return { score: 7 };
    },
  });
  assert.equal(
    await processAiGradingDelivery(delivery, {
      repository: fake.repository,
      operations: ops,
      operationalAttestationEnabled: true,
      operationalFaultEnvironment: environment,
    }),
    "provider_outcome_unknown",
  );
  assert.equal(
    await processAiGradingDelivery(
      { ...delivery, deliveryAttempt: 2, messageId: "redelivery" },
      {
        repository: fake.repository,
        operations: ops,
        operationalAttestationEnabled: true,
        operationalFaultEnvironment: environment,
      },
    ),
    "provider_outcome_unknown",
  );
  assert.equal(providerCalls, 0);
  assert.equal(fake.providerReservations(), 1);
  assert.equal(fake.operationalBoundaryAttempts(), 1);
});

test("stale and persistence crashes are one-shot and resume through checkpoints", async () => {
  for (const scenario of ["stale_claim", "persistence_retry"] as const) {
    const fake = fakeRepository(scenario);
    let providerCalls = 0;
    let persistCalls = 0;
    const ops = operations({
      async generate() {
        providerCalls += 1;
        return { score: 7 };
      },
      async persist() {
        persistCalls += 1;
      },
    });
    assert.equal(
      await processAiGradingDelivery(delivery, {
        repository: fake.repository,
        operations: ops,
        operationalAttestationEnabled: true,
        operationalFaultEnvironment: environment,
      }),
      "operational_non_ack",
    );
    fake.expireLease();
    assert.equal(
      await processAiGradingDelivery(
        { ...delivery, deliveryAttempt: 2, messageId: `${scenario}-reconcile` },
        {
          repository: fake.repository,
          operations: ops,
          operationalAttestationEnabled: true,
          operationalFaultEnvironment: environment,
        },
      ),
      "completed",
    );
    assert.equal(providerCalls, 1);
    assert.equal(persistCalls, 1);
  }
});

test("three definite provider failures exhaust without a fourth reservation", async () => {
  const fake = fakeRepository("retry_exhaustion");
  const baseFail = fake.repository.fail.bind(fake.repository);
  let failures = 0;
  fake.repository.fail = async (runId, claimToken, params) => {
    failures += 1;
    await baseFail(runId, claimToken, params);
    return failures >= 3 ? "fatal" : "retryable";
  };
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    await assert.rejects(() =>
      processAiGradingDelivery(
        { ...delivery, deliveryAttempt: attempt, messageId: `retry-${attempt}` },
        {
          repository: fake.repository,
          operations: operations(),
          operationalAttestationEnabled: true,
          operationalFaultEnvironment: environment,
        },
      ),
    );
  }
  assert.equal(
    await processAiGradingDelivery(
      { ...delivery, deliveryAttempt: 3, messageId: "retry-3" },
      {
        repository: fake.repository,
        operations: operations(),
        operationalAttestationEnabled: true,
        operationalFaultEnvironment: environment,
      },
    ),
    "exhausted",
  );
  assert.equal(failures, 3);
  assert.equal(fake.providerReservations(), 3);
  assert.equal(fake.operationalBoundaryAttempts(), 3);
});

test("a DB-owned environment marker mismatch performs no claim or provider work", async () => {
  let claimCalls = 0;
  let providerCalls = 0;
  const repository: AiGradingRepository = {
    ...fakeRepository("provider_timeout").repository,
    async loadOperationalEnvironmentMarker() {
      return { environment: "production", projectRef: "productionref01" };
    },
    async claim() {
      claimCalls += 1;
      throw new Error("claim must not run");
    },
  };
  await assert.rejects(
    () =>
      processAiGradingDelivery(delivery, {
        repository,
        operations: operations({
          async generate() {
            providerCalls += 1;
            return { score: 7 };
          },
        }),
        operationalFaultEnvironment: environment,
      }),
    /OPERATIONAL_DATABASE_MARKER_MISMATCH/,
  );
  assert.deepEqual({ claimCalls, providerCalls }, { claimCalls: 0, providerCalls: 0 });
});

test("the harness covers exactly the five immutable evidence scenarios", () => {
  assert.deepEqual([...OPERATIONAL_FAULT_SCENARIOS].sort(), [
    "duplicate_delivery",
    "persistence_retry",
    "provider_timeout",
    "retry_exhaustion",
    "stale_claim",
  ]);
});
