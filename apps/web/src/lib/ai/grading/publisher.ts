import "server-only";

import { getVercelOidcToken } from "@vercel/oidc";
import { ExternalAccountClient } from "google-auth-library";
import { AiGradingPausedError, getAiGradingBackend } from "./backend";
import {
  AI_GRADING_MESSAGE_VERSION,
  AI_GRADING_TOPIC,
  type AiGradingJob,
  type AiGradingKind,
} from "./contracts";
import {
  ensureAiWorkflowRun,
  markAiWorkflowRunPublishing,
  markAiWorkflowRunPublished,
} from "@/lib/ai/workflow-runs";

type PublisherConfig = {
  projectId: string;
  projectNumber: string;
  serviceAccountEmail: string;
  workloadIdentityPoolId: string;
  workloadIdentityProviderId: string;
  topic: string;
};

type Source =
  | { kind: "practice_analysis"; analysisJobId: string }
  | { kind: "ielts_speaking_score"; speakingResponseId: string }
  | { kind: "ielts_writing_score"; writingResponseId: string };

export type PublishAiGradingParams = {
  source: Source;
  userId: string;
};

type PublisherDependencies = {
  fetch?: typeof fetch;
  getSubjectToken?: () => Promise<string>;
};

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name} for GCP AI grading.`);
  return value;
}

function publisherConfig(): PublisherConfig {
  return {
    projectId: requiredEnvironment("GCP_PROJECT_ID"),
    projectNumber: requiredEnvironment("GCP_PROJECT_NUMBER"),
    serviceAccountEmail: requiredEnvironment("GCP_SERVICE_ACCOUNT_EMAIL"),
    workloadIdentityPoolId: requiredEnvironment(
      "GCP_WORKLOAD_IDENTITY_POOL_ID",
    ),
    workloadIdentityProviderId: requiredEnvironment(
      "GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID",
    ),
    topic: process.env.GCP_AI_GRADING_TOPIC?.trim() || AI_GRADING_TOPIC,
  };
}

async function publisherAccessToken(
  config: PublisherConfig,
  getSubjectToken: () => Promise<string>,
): Promise<string> {
  const authClient = ExternalAccountClient.fromJSON({
    type: "external_account",
    audience: `//iam.googleapis.com/projects/${config.projectNumber}/locations/global/workloadIdentityPools/${config.workloadIdentityPoolId}/providers/${config.workloadIdentityProviderId}`,
    subject_token_type: "urn:ietf:params:oauth:token-type:jwt",
    token_url: "https://sts.googleapis.com/v1/token",
    service_account_impersonation_url: `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${config.serviceAccountEmail}:generateAccessToken`,
    subject_token_supplier: { getSubjectToken },
  });
  if (!authClient)
    throw new Error("Could not initialize GCP workload identity federation.");
  const accessToken = await authClient.getAccessToken();
  if (!accessToken.token)
    throw new Error("GCP workload identity federation returned no token.");
  return accessToken.token;
}

function sourceId(source: Source): string {
  if (source.kind === "practice_analysis") return source.analysisJobId;
  if (source.kind === "ielts_speaking_score")
    return source.speakingResponseId;
  return source.writingResponseId;
}

function buildJob(
  kind: AiGradingKind,
  id: string,
  workflowRunId: string,
): AiGradingJob {
  return {
    schemaVersion: AI_GRADING_MESSAGE_VERSION,
    kind,
    sourceId: id,
    workflowRunId,
  };
}

/**
 * Publishes one reference-only job. The Supabase idempotency row is created
 * first, so a publish acknowledgement lost in transit can safely be retried.
 */
export async function publishAiGradingJob(
  params: PublishAiGradingParams,
  injected: PublisherDependencies = {},
) {
  const run = await ensureAiWorkflowRun({
    source: params.source,
    userId: params.userId,
  });
  if (getAiGradingBackend() === "legacy") throw new AiGradingPausedError();
  await markAiWorkflowRunPublishing(run.id);

  const config = publisherConfig();
  const token = await publisherAccessToken(
    config,
    injected.getSubjectToken ??
      (() => getVercelOidcToken({ expirationBufferMs: 5 * 60 * 1_000 })),
  );
  const job = buildJob(params.source.kind, sourceId(params.source), run.id);
  const fetchImpl = injected.fetch ?? fetch;
  const response = await fetchImpl(
    `https://pubsub.googleapis.com/v1/projects/${encodeURIComponent(config.projectId)}/topics/${encodeURIComponent(config.topic)}:publish`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        messages: [
          {
            data: Buffer.from(JSON.stringify(job)).toString("base64"),
            orderingKey: run.id,
            attributes: {
              kind: job.kind,
              workflowRunId: job.workflowRunId,
              schemaVersion: String(job.schemaVersion),
            },
          },
        ],
      }),
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!response.ok) {
    throw new Error(`Could not publish AI grading job (${response.status}).`);
  }
  const body = (await response.json()) as { messageIds?: string[] };
  const messageId = body.messageIds?.[0];
  if (!messageId) throw new Error("GCP Pub/Sub returned no AI grading message ID.");
  await markAiWorkflowRunPublished({ id: run.id, messageId });
  return {
    messageId,
    workflowRunId: run.id,
    idempotencyKey: run.idempotency_key,
  };
}
