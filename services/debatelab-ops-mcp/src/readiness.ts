import type { OpsRepository } from "./repository.js";
import {
  REQUIRED_ENVIRONMENT,
  syntheticSmokeEnabled,
  type OpsMcpEnvironment,
} from "./config.js";

export type ReadinessResult = {
  ready: boolean;
  missing: string[];
  invalid: string[];
  database: "ready" | "unavailable" | "unchecked";
};

export function checkConfiguration(
  environment: OpsMcpEnvironment = process.env,
): Omit<ReadinessResult, "database"> {
  const missing = REQUIRED_ENVIRONMENT.filter(
    (name) => !environment[name]?.trim(),
  ) as string[];
  if (syntheticSmokeEnabled(environment) && !environment.GROQ_API_KEY?.trim()) {
    missing.push("GROQ_API_KEY");
  }
  const invalid: string[] = [];
  const serviceUrl = environment.CLOUD_RUN_SERVICE_URL?.trim();
  const supabaseUrl = environment.NEXT_PUBLIC_SUPABASE_URL?.trim();
  for (const [name, value] of [
    ["CLOUD_RUN_SERVICE_URL", serviceUrl],
    ["NEXT_PUBLIC_SUPABASE_URL", supabaseUrl],
  ] as const) {
    if (!value) continue;
    try {
      if (new URL(value).protocol !== "https:") invalid.push(name);
    } catch {
      invalid.push(name);
    }
  }
  const caller = environment.GCP_OPS_MCP_CALLER_SERVICE_ACCOUNT_EMAIL?.trim();
  if (caller && !/^[^@\s]+@[^@\s]+\.iam\.gserviceaccount\.com$/i.test(caller)) {
    invalid.push("GCP_OPS_MCP_CALLER_SERVICE_ACCOUNT_EMAIL");
  }
  return {
    ready: missing.length === 0 && invalid.length === 0,
    missing,
    invalid,
  };
}

export async function checkReadiness(
  repository: Pick<OpsRepository, "ping">,
  environment: OpsMcpEnvironment = process.env,
): Promise<ReadinessResult> {
  const configuration = checkConfiguration(environment);
  if (!configuration.ready) {
    return { ...configuration, database: "unchecked" };
  }
  try {
    await repository.ping();
    return { ...configuration, database: "ready" };
  } catch {
    return { ...configuration, ready: false, database: "unavailable" };
  }
}
