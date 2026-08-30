import { parseAiGradingPubSubEnvelope } from "@/lib/ai/grading/contracts";
import { verifyCloudRunCaller, type CallerRole } from "./auth";
import { createProductionOperations, isFatalAiGradingError } from "./operations";
import { processAiGradingDelivery } from "./processor";
import { reconcileAiGradingRuns } from "./reconciler";
import { createProductionRepository } from "./repository";

export type WorkerRequest = {
  method: string;
  path: string;
  authorization?: string;
  body?: unknown;
};

export type WorkerResponse = {
  status: number;
  body?: Record<string, unknown>;
};

type HandlerDependencies = {
  verify?: (authorization: string | undefined, role: CallerRole) => Promise<void>;
  processDelivery?: (
    delivery: ReturnType<typeof parseAiGradingPubSubEnvelope>,
  ) => Promise<string>;
  reconcile?: typeof reconcileAiGradingRuns;
};

export async function routeWorkerRequest(
  request: WorkerRequest,
  dependencies: HandlerDependencies = {},
): Promise<WorkerResponse> {
  if (request.method === "GET" && request.path === "/healthz") {
    return { status: 200, body: { ok: true } };
  }
  const verify = dependencies.verify ?? verifyCloudRunCaller;
  if (request.method === "POST" && request.path === "/") {
    await verify(request.authorization, "pubsub");
    const delivery = parseAiGradingPubSubEnvelope(request.body);
    const outcome = dependencies.processDelivery
      ? await dependencies.processDelivery(delivery)
      : await processAiGradingDelivery(delivery, {
          repository: createProductionRepository(),
          operations: createProductionOperations(),
          isFatalError: isFatalAiGradingError,
        });
    return { status: 204, body: { outcome } };
  }
  if (request.method === "POST" && request.path === "/internal/reconcile") {
    await verify(request.authorization, "scheduler");
    const result = await (dependencies.reconcile ?? reconcileAiGradingRuns)();
    return { status: 200, body: { ok: true, ...result } };
  }
  return { status: 404 };
}
