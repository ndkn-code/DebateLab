import { createHash } from "node:crypto";
import type {
  AiGradingDelivery,
  AiGradingJob,
} from "@/lib/ai/grading/contracts";
import type { AiGradingRepository } from "./repository";

export type SourceClaim = "claimed" | "already_completed" | "terminal";

export interface AiGradingOperations {
  claimSource(job: AiGradingJob): Promise<SourceClaim>;
  prepare(job: AiGradingJob): Promise<unknown>;
  generate(
    job: AiGradingJob,
    prepared: unknown,
    context: { workflowAttempt: number },
  ): Promise<unknown>;
  persist(job: AiGradingJob, prepared: unknown, output: unknown): Promise<void>;
  afterPersist(job: AiGradingJob, prepared: unknown): Promise<void>;
  failSource(
    job: AiGradingJob,
    retryable: boolean,
    message: string,
  ): Promise<void>;
}

export type ProcessOutcome =
  | "completed"
  | "already_completed"
  | "lease_active"
  | "exhausted"
  | "fatal"
  | "provider_outcome_unknown"
  | "claim_lost";

type ProviderFailureDisposition = "retryable" | "fatal" | "unknown";

const RETRYABLE_AI_FAILURE_KINDS = new Set(["rate_limited", "schema_invalid"]);
const FATAL_AI_FAILURE_KINDS = new Set([
  "misconfiguration",
  "invalid_request",
  "budget_exhausted",
]);

function errorChain(error: unknown): Array<Record<string, unknown>> {
  const chain: Array<Record<string, unknown>> = [];
  const seen = new Set<unknown>();
  let current = error;
  while (
    current &&
    typeof current === "object" &&
    !seen.has(current) &&
    chain.length < 8
  ) {
    seen.add(current);
    chain.push(current as Record<string, unknown>);
    current = (current as { cause?: unknown }).cause;
  }
  return chain;
}

/**
 * Only failures which prove that no usable provider result exists may release
 * the reservation for an automatic retry. An unclassified network disconnect
 * remains unknown because the provider may have completed after the socket was
 * lost; a duplicate paid call is less safe than a terminal manual-review state.
 */
export function classifyProviderFailureDisposition(
  error: unknown,
): ProviderFailureDisposition {
  const chain = errorChain(error);
  const attempts = chain.flatMap((item) =>
    Array.isArray(item.attempts)
      ? (item.attempts as Array<Record<string, unknown>>)
      : [],
  );
  // A final schema/429 response cannot make an earlier ambiguous call safe.
  // Timeouts and socket failures may have completed remotely after the client
  // stopped waiting, so they must never release the paid-call reservation.
  if (
    attempts.some((attempt) => {
      if (attempt.status !== "error") return false;
      if (attempt.failureKind === "deadline_exceeded") return true;
      if (attempt.failureKind === "unknown") return true;
      if (attempt.failureKind !== "provider_unavailable") return false;
      const status = attempt.responseStatus;
      return !(typeof status === "number" && status >= 500 && status <= 599);
    })
  ) {
    return "unknown";
  }
  const kind = chain.find((item) => typeof item.kind === "string")?.kind;
  if (typeof kind !== "string") return "unknown";
  if (RETRYABLE_AI_FAILURE_KINDS.has(kind)) return "retryable";
  if (kind === "deadline_exceeded") return "unknown";
  if (FATAL_AI_FAILURE_KINDS.has(kind)) return "fatal";
  if (kind !== "provider_unavailable") return "unknown";

  // Provider HTTP 5xx responses are definitive failures. Bare fetch/socket
  // failures are intentionally not: their remote outcome cannot be observed.
  const status = chain
    .map((item) => item.status ?? item.code)
    .find((value) => typeof value === "number");
  return typeof status === "number" && status >= 500 && status <= 599
    ? "retryable"
    : "unknown";
}

function canonicalJson(value: unknown): string {
  if (value === undefined) return "null";
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function checkpointHash(value: unknown): string {
  const serialized = JSON.stringify(value, (_key, item) => {
    if (typeof item === "number" && !Number.isFinite(item)) {
      throw new Error("AI_GRADING_CHECKPOINT_NUMBER_INVALID");
    }
    return item;
  });
  if (serialized === undefined) {
    throw new Error("AI_GRADING_CHECKPOINT_PAYLOAD_INVALID");
  }
  return createHash("sha256")
    .update(canonicalJson(JSON.parse(serialized)))
    .digest("hex");
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * One fenced run. Duplicate Pub/Sub deliveries either see an active lease or
 * a validated output checkpoint; neither path can invoke the provider again.
 */
export async function processAiGradingDelivery(
  delivery: AiGradingDelivery,
  dependencies: {
    repository: AiGradingRepository;
    operations: AiGradingOperations;
    isFatalError?: (error: unknown) => boolean;
  },
): Promise<ProcessOutcome> {
  const claim = await dependencies.repository.claim(delivery);
  if (claim.outcome !== "claimed") return claim.outcome;
  if (!claim.claimToken) throw new Error("AI_GRADING_CLAIM_TOKEN_MISSING");

  const { job } = delivery;
  const claimToken = claim.claimToken;
  let prepared = claim.preparedPayload;
  let output = claim.outputPayload;
  let providerReserved = Boolean(claim.providerStartedAt);
  let outputCheckpointed = output !== null;
  let providerFailureDisposition: ProviderFailureDisposition | null = null;

  try {
    if (prepared === null) {
      const sourceClaim = await dependencies.operations.claimSource(job);
      if (sourceClaim === "already_completed") {
        output = { schemaVersion: 1, status: "already_completed" };
        await dependencies.repository.checkpointOutput(
          job.workflowRunId,
          claimToken,
          output,
          checkpointHash(output),
        );
        await dependencies.repository.complete(
          job.workflowRunId,
          claimToken,
          "source_already_completed",
        );
        return "already_completed";
      }
      if (sourceClaim === "terminal") {
        await dependencies.repository.fail(job.workflowRunId, claimToken, {
          code: "SOURCE_TERMINAL",
          message: "The grading source is already terminal.",
          retryable: false,
        });
        return "fatal";
      }
      prepared = await dependencies.operations.prepare(job);
      await dependencies.repository.checkpointPrepared(
        job.workflowRunId,
        claimToken,
        prepared,
        checkpointHash(prepared),
      );
    }

    if (output === null) {
      const reservation = await dependencies.repository.reserveProvider(
        job.workflowRunId,
        claimToken,
      );
      if (reservation === "outcome_unknown") {
        const failure = await dependencies.repository.fail(
          job.workflowRunId,
          claimToken,
          {
            code: "PROVIDER_OUTCOME_UNKNOWN",
            message:
              "A previous provider call may have completed without a validated checkpoint.",
            retryable: false,
          },
        );
        if (failure !== "claim_lost") {
          await dependencies.operations
            .failSource(
              job,
              false,
              "A previous provider call has an unknown outcome.",
            )
            .catch(() => undefined);
        }
        if (failure === "claim_lost") return "claim_lost";
        return "provider_outcome_unknown";
      }
      if (reservation === "output_ready") {
        throw new Error("AI_GRADING_OUTPUT_CHECKPOINT_STALE_READ");
      }
      providerReserved = true;
      try {
        output = await dependencies.operations.generate(job, prepared, {
          workflowAttempt: claim.attemptCount,
        });
      } catch (error) {
        providerFailureDisposition = classifyProviderFailureDisposition(error);
        throw error;
      }
      let outputHash: string;
      try {
        outputHash = checkpointHash(output);
      } catch (error) {
        providerFailureDisposition = "retryable";
        throw error;
      }
      await dependencies.repository.checkpointOutput(
        job.workflowRunId,
        claimToken,
        output,
        outputHash,
      );
      outputCheckpointed = true;
    }

    await dependencies.operations.persist(job, prepared, output);
    await dependencies.operations
      .afterPersist(job, prepared)
      .catch(() => undefined);
    const completed = await dependencies.repository.complete(
      job.workflowRunId,
      claimToken,
      "completed",
    );
    return completed ? "completed" : "claim_lost";
  } catch (error) {
    const domainFatal = dependencies.isFatalError?.(error) ?? false;
    let requestedRetryable =
      !domainFatal && (!providerReserved || outputCheckpointed);
    let failureCode = domainFatal
      ? "FATAL_GRADING_ERROR"
      : "GRADING_DELIVERY_FAILED";

    if (providerReserved && !outputCheckpointed) {
      if (providerFailureDisposition === "retryable") {
        try {
          await dependencies.repository.checkpointProviderFailure(
            job.workflowRunId,
            claimToken,
            (errorChain(error).find((item) => typeof item.kind === "string")
              ?.kind as string | undefined) ?? "validated_output_invalid",
          );
          providerReserved = false;
          requestedRetryable = true;
        } catch {
          // If the definitive-failure checkpoint is unavailable, fail closed:
          // the durable record can no longer prove that another call is safe.
          requestedRetryable = false;
          failureCode = "PROVIDER_OUTCOME_UNKNOWN";
        }
      } else if (providerFailureDisposition === "fatal") {
        try {
          await dependencies.repository.checkpointProviderFailure(
            job.workflowRunId,
            claimToken,
            (errorChain(error).find((item) => typeof item.kind === "string")
              ?.kind as string | undefined) ?? "fatal_provider_failure",
          );
          providerReserved = false;
          requestedRetryable = false;
          failureCode = "FATAL_GRADING_ERROR";
        } catch {
          requestedRetryable = false;
          failureCode = "PROVIDER_OUTCOME_UNKNOWN";
        }
      } else {
        requestedRetryable = false;
        failureCode = "PROVIDER_OUTCOME_UNKNOWN";
      }
    }

    const failure = await dependencies.repository.fail(
      job.workflowRunId,
      claimToken,
      {
        code: failureCode,
        message: errorMessage(error),
        retryable: requestedRetryable,
      },
    );
    if (failure === "claim_lost") return "claim_lost";
    await dependencies.operations
      .failSource(job, failure === "retryable", errorMessage(error))
      .catch(() => undefined);
    if (failure === "fatal") {
      if (failureCode === "PROVIDER_OUTCOME_UNKNOWN") {
        return "provider_outcome_unknown";
      }
      return requestedRetryable && claim.attemptCount >= 3
        ? "exhausted"
        : "fatal";
    }
    throw error;
  }
}
