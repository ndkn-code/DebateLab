import "server-only";

import { getVercelOidcToken } from "@vercel/oidc";
import { ExternalAccountClient } from "google-auth-library";
import {
  MATERIAL_PIPELINE_TOPIC,
  type MaterialQueueMessage,
} from "@/lib/api/class-lms/material-pipeline/contracts";

type GcpQueueConfig = {
  projectId: string;
  projectNumber: string;
  serviceAccountEmail: string;
  workloadIdentityPoolId: string;
  workloadIdentityProviderId: string;
  topic: string;
};

function requiredEnvironment(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name} for LMS material processing.`);
  return value;
}

function queueConfig(): GcpQueueConfig {
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
    topic: process.env.GCP_PUBSUB_TOPIC?.trim() || MATERIAL_PIPELINE_TOPIC,
  };
}

async function publisherAccessToken(config: GcpQueueConfig) {
  const authClient = ExternalAccountClient.fromJSON({
    type: "external_account",
    audience: `//iam.googleapis.com/projects/${config.projectNumber}/locations/global/workloadIdentityPools/${config.workloadIdentityPoolId}/providers/${config.workloadIdentityProviderId}`,
    subject_token_type: "urn:ietf:params:oauth:token-type:jwt",
    token_url: "https://sts.googleapis.com/v1/token",
    service_account_impersonation_url: `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${config.serviceAccountEmail}:generateAccessToken`,
    subject_token_supplier: {
      getSubjectToken: () =>
        getVercelOidcToken({ expirationBufferMs: 5 * 60 * 1_000 }),
    },
  });
  if (!authClient) {
    throw new Error("Could not initialize GCP workload identity federation.");
  }
  const accessToken = await authClient.getAccessToken();
  if (!accessToken.token) {
    throw new Error("GCP workload identity federation returned no token.");
  }
  return accessToken.token;
}

export async function enqueueMaterialProcessing(message: MaterialQueueMessage) {
  const config = queueConfig();
  const accessToken = await publisherAccessToken(config);
  const response = await fetch(
    `https://pubsub.googleapis.com/v1/projects/${encodeURIComponent(config.projectId)}/topics/${encodeURIComponent(config.topic)}:publish`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        messages: [
          {
            data: Buffer.from(JSON.stringify(message)).toString("base64"),
            attributes: {
              materialId: message.materialId,
              versionId: message.versionId,
              idempotencyKey: message.idempotencyKey,
            },
          },
        ],
      }),
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!response.ok) {
    throw new Error(`Could not enqueue material processing (${response.status}).`);
  }
  const body = (await response.json()) as { messageIds?: string[] };
  if (!body.messageIds?.[0]) {
    throw new Error("GCP Pub/Sub returned no material message ID.");
  }
  return {
    messageId: body.messageIds[0],
    idempotencyKey: message.idempotencyKey,
  };
}
