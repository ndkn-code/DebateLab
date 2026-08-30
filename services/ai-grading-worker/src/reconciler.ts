import { GoogleAuth } from "google-auth-library";
import {
  AI_GRADING_TOPIC,
  type AiGradingJob,
} from "@/lib/ai/grading/contracts";
import { markAiWorkflowRunPublished } from "@/lib/ai/workflow-runs";
import { listReconciliationCandidates } from "./repository";

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}.`);
  return value;
}
export type ReconcileResult = { scanned: number; published: number };

async function accessToken(): Promise<string> {
  const client = await new GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/pubsub"],
  }).getClient();
  const token = await client.getAccessToken();
  if (!token.token) throw new Error("GCP_ADC_ACCESS_TOKEN_MISSING");
  return token.token;
}

export async function reconcileAiGradingRuns(dependencies?: {
  candidates?: () => Promise<AiGradingJob[]>;
  fetch?: typeof fetch;
  token?: () => Promise<string>;
  markPublished?: (params: { id: string; messageId: string }) => Promise<void>;
}): Promise<ReconcileResult> {
  const candidates = await (dependencies?.candidates ??
    (() => listReconciliationCandidates(50)))();
  if (candidates.length === 0) return { scanned: 0, published: 0 };
  const projectId = requiredEnvironment("GCP_PROJECT_ID");
  const topic = process.env.GCP_AI_GRADING_TOPIC?.trim() || AI_GRADING_TOPIC;
  const response = await (dependencies?.fetch ?? fetch)(
    `https://pubsub.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/topics/${encodeURIComponent(topic)}:publish`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${await (dependencies?.token ?? accessToken)()}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        messages: candidates.map((job) => ({
          data: Buffer.from(JSON.stringify(job)).toString("base64"),
          orderingKey: job.workflowRunId,
          attributes: {
            kind: job.kind,
            workflowRunId: job.workflowRunId,
            schemaVersion: String(job.schemaVersion),
            reconciled: "true",
          },
        })),
      }),
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!response.ok)
    throw new Error(`Could not republish AI grading jobs (${response.status}).`);
  const body = (await response.json()) as { messageIds?: string[] };
  if (body.messageIds?.length !== candidates.length)
    throw new Error("GCP Pub/Sub reconciliation acknowledgement mismatch.");
  const mark = dependencies?.markPublished ?? markAiWorkflowRunPublished;
  await Promise.all(
    candidates.map((job, index) =>
      mark({ id: job.workflowRunId, messageId: body.messageIds![index]! }),
    ),
  );
  return { scanned: candidates.length, published: candidates.length };
}
