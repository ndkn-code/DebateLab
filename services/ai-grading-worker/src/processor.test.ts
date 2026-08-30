import assert from "node:assert/strict";
import test from "node:test";
import type { AiGradingDelivery } from "@/lib/ai/grading/contracts";
import {
  processAiGradingDelivery,
  type AiGradingOperations,
} from "./processor";
import type {
  AiGradingRepository,
  ClaimResult,
} from "./repository";

const delivery: AiGradingDelivery = {
  job: {
    schemaVersion: 1,
    kind: "ielts_writing_score",
    sourceId: "00000000-0000-4000-8000-000000000001",
    workflowRunId: "00000000-0000-4000-8000-000000000002",
  },
  messageId: "message-1",
  deliveryAttempt: 1,
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function createFakeRepository() {
  let active = false;
  let completed = false;
  let attempt = 0;
  let prepared: unknown | null = null;
  let output: unknown | null = null;
  let providerStarted = false;
  const repository: AiGradingRepository = {
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
    async checkpointPrepared(_run, _claim, value) {
      prepared = value;
    },
    async reserveProvider() {
      if (providerStarted && output === null) return "outcome_unknown";
      providerStarted = true;
      return output === null ? "reserved" : "output_ready";
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
    setProviderStarted() {
      providerStarted = true;
    },
  };
}

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

test("a concurrent duplicate delivery cannot make a duplicate provider call", async () => {
  const fake = createFakeRepository();
  const providerStarted = deferred<void>();
  const releaseProvider = deferred<void>();
  let providerCalls = 0;
  const ops = operations({
    async generate() {
      providerCalls += 1;
      providerStarted.resolve();
      await releaseProvider.promise;
      return { score: 7 };
    },
  });
  const first = processAiGradingDelivery(delivery, {
    repository: fake.repository,
    operations: ops,
  });
  await providerStarted.promise;
  const duplicate = await processAiGradingDelivery(
    { ...delivery, messageId: "message-duplicate", deliveryAttempt: 2 },
    { repository: fake.repository, operations: ops },
  );
  assert.equal(duplicate, "lease_active");
  assert.equal(providerCalls, 1);
  releaseProvider.resolve();
  assert.equal(await first, "completed");
  assert.equal(providerCalls, 1);
});
test("a persistence retry reuses the validated provider checkpoint", async () => {
  const fake = createFakeRepository();
  let providerCalls = 0;
  let persistCalls = 0;
  const ops = operations({
    async generate() {
      providerCalls += 1;
      return { score: 7.5 };
    },
    async persist() {
      persistCalls += 1;
      if (persistCalls === 1) throw new Error("transient database failure");
    },
  });
  await assert.rejects(
    () =>
      processAiGradingDelivery(delivery, {
        repository: fake.repository,
        operations: ops,
      }),
    /transient database failure/,
  );
  const second = await processAiGradingDelivery(
    { ...delivery, messageId: "message-redelivery", deliveryAttempt: 2 },
    { repository: fake.repository, operations: ops },
  );
  assert.equal(second, "completed");
  assert.equal(providerCalls, 1);
  assert.equal(persistCalls, 2);
});

test("an expired uncertain provider phase fails closed without another call", async () => {
  const fake = createFakeRepository();
  fake.setProviderStarted();
  fake.expireLease();
  let providerCalls = 0;
  const outcome = await processAiGradingDelivery(delivery, {
    repository: fake.repository,
    operations: operations({
      async generate() {
        providerCalls += 1;
        return { score: 8 };
      },
    }),
  });
  assert.equal(outcome, "provider_outcome_unknown");
  assert.equal(providerCalls, 0);
});

test("exhausted runs acknowledge without touching source or provider", async () => {
  let sourceCalls = 0;
  const repository = {
    ...createFakeRepository().repository,
    async claim(): Promise<ClaimResult> {
      return {
        outcome: "exhausted",
        claimToken: null,
        attemptCount: 3,
        manualRetryCount: 0,
        preparedPayload: null,
        outputPayload: null,
        outputHash: null,
        providerStartedAt: null,
      };
    },
  } satisfies AiGradingRepository;
  assert.equal(
    await processAiGradingDelivery(delivery, {
      repository,
      operations: operations({
        async claimSource() {
          sourceCalls += 1;
          return "claimed";
        },
      }),
    }),
    "exhausted",
  );
  assert.equal(sourceCalls, 0);
});
