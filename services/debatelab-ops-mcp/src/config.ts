export type OpsMcpEnvironment = Record<string, string | undefined>;

export const REQUIRED_ENVIRONMENT = [
  "CLOUD_RUN_SERVICE_URL",
  "GCP_OPS_MCP_CALLER_SERVICE_ACCOUNT_EMAIL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "OPS_MCP_READER_TOKEN",
] as const;

export function requiredEnvironment(
  environment: OpsMcpEnvironment,
  name: (typeof REQUIRED_ENVIRONMENT)[number] | "GROQ_API_KEY",
): string {
  const value = environment[name]?.trim();
  if (!value) throw new Error(`Missing ${name}.`);
  return value;
}

export function syntheticSmokeEnabled(environment: OpsMcpEnvironment): boolean {
  return (
    environment.OPS_MCP_ENVIRONMENT?.trim() === "staging" &&
    environment.MCP_ALLOW_SYNTHETIC_SMOKE?.trim() === "true"
  );
}
