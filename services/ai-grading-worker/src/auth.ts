import { OAuth2Client } from "google-auth-library";

export type CallerRole = "pubsub" | "scheduler";

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}.`);
  return value;
}
export async function verifyCloudRunCaller(
  authorization: string | undefined,
  role: CallerRole,
): Promise<void> {
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) throw new Error("CLOUD_RUN_CALLER_TOKEN_MISSING");
  const audience = requiredEnvironment("CLOUD_RUN_SERVICE_URL");
  const expectedEmail = requiredEnvironment(
    role === "pubsub"
      ? "GCP_PUBSUB_PUSH_SERVICE_ACCOUNT_EMAIL"
      : "GCP_SCHEDULER_SERVICE_ACCOUNT_EMAIL",
  );
  const ticket = await new OAuth2Client().verifyIdToken({
    idToken: token,
    audience,
  });
  const payload = ticket.getPayload();
  if (
    !payload?.email_verified ||
    payload.email?.toLowerCase() !== expectedEmail.toLowerCase()
  ) {
    throw new Error("CLOUD_RUN_CALLER_IDENTITY_MISMATCH");
  }
}
