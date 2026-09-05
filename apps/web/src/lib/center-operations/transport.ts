import "server-only";
import { getVercelOidcToken } from "@vercel/oidc";
import { ExternalAccountClient } from "google-auth-library";
import { createTypedServerClient } from "@/lib/supabase/server";
import { requireClubOwner } from "@/lib/api/class-manager-access";

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value)
    throw new Error("The integration service has not been configured yet.");
  return value;
}

export async function callCenterService<T>(
  path:
    | "/oauth/google/start"
    | "/resources/list"
    | "/resources/bind"
    | "/resources/picker"
    | "/resources/sync",
  clubId: string,
  input?: unknown,
): Promise<T> {
  if (process.env.CENTER_OPERATIONS_V1 !== "true")
    throw new Error("Center operations are unavailable.");
  const client = await createTypedServerClient();
  await requireClubOwner(client, clubId);
  const {
    data: { session },
  } = await client.auth.getSession();
  if (!session) throw new Error("Sign in again to connect Google.");
  const origin = new URL(required("CENTER_OPERATIONS_SERVICE_URL"));
  if (origin.protocol !== "https:" || origin.username || origin.password)
    throw new Error("Invalid integration service configuration.");
  const account = required("GCP_SERVICE_ACCOUNT_EMAIL");
  const auth = ExternalAccountClient.fromJSON({
    type: "external_account",
    audience: `//iam.googleapis.com/projects/${required("GCP_PROJECT_NUMBER")}/locations/global/workloadIdentityPools/${required("GCP_WORKLOAD_IDENTITY_POOL_ID")}/providers/${required("GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID")}`,
    subject_token_type: "urn:ietf:params:oauth:token-type:jwt",
    token_url: "https://sts.googleapis.com/v1/token",
    service_account_impersonation_url: `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${account}:generateAccessToken`,
    subject_token_supplier: {
      getSubjectToken: () => getVercelOidcToken({ expirationBufferMs: 300000 }),
    },
  });
  const access = await auth?.getAccessToken();
  if (!access?.token)
    throw new Error("Integration service authentication failed.");
  const tokenResponse = await fetch(
    `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${encodeURIComponent(account)}:generateIdToken`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${access.token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ audience: origin.origin, includeEmail: true }),
      signal: AbortSignal.timeout(15000),
    },
  );
  if (!tokenResponse.ok)
    throw new Error("Integration service authentication failed.");
  const identity = (await tokenResponse.json()) as { token?: string };
  if (!identity.token)
    throw new Error("Integration service authentication failed.");
  const response = await fetch(new URL(path, origin), {
    method: "POST",
    headers: {
      authorization: `Bearer ${identity.token}`,
      "x-thinkfy-user-token": session.access_token,
      "content-type": "application/json",
    },
    body: JSON.stringify({ clubId, input }),
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok)
    throw new Error(
      "Google connection could not start. Check your center permissions and integration setup.",
    );
  return (await response.json()) as T;
}

export async function startGoogleConnection(
  clubId: string,
  existingCalendars = false,
): Promise<{ url: string }> {
  if (
    existingCalendars &&
    process.env.CENTER_GOOGLE_EXISTING_CALENDARS_ENABLED !== "true"
  )
    throw new Error(
      "Existing-calendar access is awaiting Google verification. Connect with a Thinkfy-created calendar instead.",
    );
  const result = await callCenterService<{ url: string }>(
    "/oauth/google/start",
    clubId,
    { existingCalendars },
  );
  if (
    !result.url ||
    new URL(result.url).origin !== "https://accounts.google.com"
  )
    throw new Error("Invalid Google authorization response.");
  return result;
}
