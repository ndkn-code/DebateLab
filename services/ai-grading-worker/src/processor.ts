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
  failSource(job: AiGradingJob, retryable: boolean, message: string): Promise<void>;
}

export type ProcessOutcome =
  | "completed"
  | "already_completed"
  | "lease_active"
  | "exhausted"
  | "fatal"
  | "provider_outcome_unknown"
  | "claim_lost";

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
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
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
        await dependencies.repository.fail(job.workflowRunId, claimToken, {
          code: "PROVIDER_OUTCOME_UNKNOWN",
          message:
            "A previous provider call may have completed without a validated checkpoint.",
          retryable: false,
        });
        return "provider_outcome_unknown";
      }
      if (reservation === "output_ready") {
        throw new Error("AI_GRADING_OUTPUT_CHECKPOINT_STALE_READ");
      }
      providerReserved = true;
      output = await dependencies.operations.generate(job, prepared, {
        workflowAttempt: claim.attemptCount,
      });
      await dependencies.repository.checkpointOutput(
        job.workflowRunId,
        claimToken,
        output,
        checkpointHash(output),
      );
      outputCheckpointed = true;
    }

    await dependencies.operations.persist(job, prepared, output);
    await dependencies.operations.afterPersist(job, prepared).catch(() => undefined);
    const completed = await dependencies.repository.complete(
      job.workflowRunId,
      claimToken,
      "completed",
    );
    return completed ? "completed" : "claim_lost";
  } catch (error) {
    const fatal = dependencies.isFatalError?.(error) ?? false;
    const retryable = !fatal && (!providerReserved || outputCheckpointed);
    await dependencies.operations
      .failSource(job, retryable, errorMessage(error))
      .catch(() => undefined);
    const failure = await dependencies.repository.fail(
      job.workflowRunId,
      claimToken,
      {
        code: fatal ? "FATAL_GRADING_ERROR" : "GRADING_DELIVERY_FAILED",
        message: errorMessage(error),
        retryable,
      },
    );
    if (failure === "claim_lost") return "claim_lost";
    if (failure === "fatal") return "fatal";
    throw error;
  }
}
