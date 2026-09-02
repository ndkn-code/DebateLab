import assert from "node:assert/strict";
import test from "node:test";
import type { AiGradingDelivery } from "@/lib/ai/grading/contracts";
import {
  checkpointHash,
  classifyProviderFailureDisposition,
  processAiGradingDelivery,
  type AiGradingOperations,
} from "./processor";
import type { AiGradingRepository, ClaimResult } from "./repository";

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
  const sourceFailures: boolean[] = [];
  const outcome = await processAiGradingDelivery(delivery, {
    repository: fake.repository,
    operations: operations({
      async generate() {
        providerCalls += 1;
        return { score: 8 };
      },
      async failSource(_job, retryable) {
        sourceFailures.push(retryable);
      },
    }),
  });
  assert.equal(outcome, "provider_outcome_unknown");
  assert.equal(providerCalls, 0);
  assert.deepEqual(sourceFailures, [false]);
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

test("a provider timeout is outcome-unknown and never triggers another paid call", async () => {
  const fake = createFakeRepository();
  let providerCalls = 0;
  const sourceFailures: boolean[] = [];
  const ops = operations({
    async generate() {
      providerCalls += 1;
      if (providerCalls === 1) {
        throw Object.assign(new Error("provider timed out"), {
          kind: "deadline_exceeded",
        });
      }
      return { score: 7.5 };
    },
    async failSource(_job, retryable) {
      sourceFailures.push(retryable);
    },
  });

  assert.equal(
    await processAiGradingDelivery(delivery, {
      repository: fake.repository,
      operations: ops,
    }),
    "provider_outcome_unknown",
  );
  assert.deepEqual(sourceFailures, [false]);
  assert.equal(
    await processAiGradingDelivery(
      { ...delivery, messageId: "message-redelivery", deliveryAttempt: 2 },
      { repository: fake.repository, operations: ops },
    ),
    "provider_outcome_unknown",
  );
  assert.equal(providerCalls, 1);
});

test("only explicit HTTP 5xx provider failures release an unavailable reservation", () => {
  const definite = Object.assign(new Error("all candidates failed"), {
    kind: "provider_unavailable",
    cause: Object.assign(new Error("request failed (503)"), { status: 503 }),
  });
  const uncertain = Object.assign(new Error("all candidates failed"), {
    kind: "provider_unavailable",
    cause: new Error("socket disconnected"),
  });
  assert.equal(classifyProviderFailureDisposition(definite), "retryable");
  assert.equal(classifyProviderFailureDisposition(uncertain), "unknown");
  assert.equal(
    classifyProviderFailureDisposition(
      Object.assign(new Error("rate limited"), {
        kind: "rate_limited",
        status: 429,
      }),
    ),
    "retryable",
  );
  assert.equal(
    classifyProviderFailureDisposition(
      Object.assign(new Error("timed out"), {
        kind: "deadline_exceeded",
        attempts: [
          {
            status: "error",
            failureKind: "deadline_exceeded",
          },
        ],
      }),
    ),
    "unknown",
  );
  assert.equal(
    classifyProviderFailureDisposition(
      Object.assign(new Error("final response was invalid"), {
        kind: "schema_invalid",
        attempts: [
          {
            status: "error",
            failureKind: "provider_unavailable",
          },
          { status: "success" },
        ],
      }),
    ),
    "unknown",
  );
  assert.equal(
    classifyProviderFailureDisposition(
      Object.assign(new Error("invalid structured output"), {
        kind: "schema_invalid",
      }),
    ),
    "retryable",
  );
});

test("retry exhaustion fails the source and leaves the manual-retry marker", async () => {
  const fake = createFakeRepository();
  const failureRequests: Array<{
    code: string;
    retryable: boolean;
  }> = [];
  const sourceFailures: boolean[] = [];
  const repository: AiGradingRepository = {
    ...fake.repository,
    async claim() {
      return {
        outcome: "claimed",
        claimToken: "claim-final",
        attemptCount: 3,
        manualRetryCount: 0,
        preparedPayload: { prompt: "prepared" },
        outputPayload: null,
        outputHash: null,
        providerStartedAt: null,
      };
    },
    async fail(_run, _claim, params) {
      failureRequests.push(params);
      return "fatal";
    },
  };

  const outcome = await processAiGradingDelivery(delivery, {
    repository,
    operations: operations({
      async generate() {
        throw Object.assign(new Error("rate limited"), {
          kind: "rate_limited",
        });
      },
      async failSource(_job, retryable) {
        sourceFailures.push(retryable);
      },
    }),
  });
  assert.equal(outcome, "exhausted");
  assert.deepEqual(failureRequests, [
    {
      code: "GRADING_DELIVERY_FAILED",
      message: "rate limited",
      retryable: true,
    },
  ]);
  assert.deepEqual(sourceFailures, [false]);
});

test("a stale worker that lost its claim cannot change the source status", async () => {
  const fake = createFakeRepository();
  let sourceFailureCalls = 0;
  const repository: AiGradingRepository = {
    ...fake.repository,
    async checkpointProviderFailure() {
      throw new Error("AI_GRADING_CLAIM_LOST");
    },
    async fail() {
      return "claim_lost";
    },
  };
  const outcome = await processAiGradingDelivery(delivery, {
    repository,
    operations: operations({
      async generate() {
        throw Object.assign(new Error("provider rate limited"), {
          kind: "rate_limited",
        });
      },
      async failSource() {
        sourceFailureCalls += 1;
      },
    }),
  });
  assert.equal(outcome, "claim_lost");
  assert.equal(sourceFailureCalls, 0);
});

test("invalid generated output is rejected before the durable output checkpoint", async () => {
  const fake = createFakeRepository();
  let checkpointCalls = 0;
  const repository: AiGradingRepository = {
    ...fake.repository,
    async checkpointOutput() {
      checkpointCalls += 1;
    },
  };
  await assert.rejects(
    () =>
      processAiGradingDelivery(delivery, {
        repository,
        operations: operations({
          async generate() {
            return { score: Number.NaN };
          },
        }),
      }),
    /CHECKPOINT_NUMBER_INVALID/,
  );
  assert.equal(checkpointCalls, 0);
  assert.throws(
    () => checkpointHash({ score: Number.POSITIVE_INFINITY }),
    /CHECKPOINT_NUMBER_INVALID/,
  );
});
