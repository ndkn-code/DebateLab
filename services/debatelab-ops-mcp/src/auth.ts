import { OAuth2Client } from "google-auth-library";
import { requiredEnvironment, type OpsMcpEnvironment } from "./config.js";

export type VerifiedIdToken = {
  email?: string;
  email_verified?: boolean;
};

export type IdTokenVerifier = (params: {
  idToken: string;
  audience: string;
}) => Promise<VerifiedIdToken>;

const defaultVerifier: IdTokenVerifier = async ({ idToken, audience }) => {
  const ticket = await new OAuth2Client().verifyIdToken({ idToken, audience });
  return ticket.getPayload() ?? {};
};

export async function verifyOpsMcpCaller(
  authorization: string | undefined,
  environment: OpsMcpEnvironment = process.env,
  verifier: IdTokenVerifier = defaultVerifier,
): Promise<void> {
  const token = authorization?.match(/^Bearer\s+([^\s]+)$/i)?.[1];
  if (!token) throw new Error("OPS_MCP_CALLER_TOKEN_MISSING");
  const audience = requiredEnvironment(environment, "CLOUD_RUN_SERVICE_URL");
  const expectedEmail = requiredEnvironment(
    environment,
    "GCP_OPS_MCP_CALLER_SERVICE_ACCOUNT_EMAIL",
  ).toLowerCase();
  const payload = await verifier({ idToken: token, audience });
  if (
    payload.email_verified !== true ||
    payload.email?.toLowerCase() !== expectedEmail
  ) {
    throw new Error("OPS_MCP_CALLER_IDENTITY_MISMATCH");
  }
}
