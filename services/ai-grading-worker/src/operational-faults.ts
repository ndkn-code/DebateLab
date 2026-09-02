import { timingSafeEqual } from "node:crypto";
import type { AiGradingJob } from "@/lib/ai/grading/contracts";
import type { AiGradingRepository } from "./repository";

export const OPERATIONAL_FAULT_SCENARIOS = [
  "duplicate_delivery",
  "provider_timeout",
  "stale_claim",
  "persistence_retry",
  "retry_exhaustion",
] as const;

export type OperationalFaultScenario =
  (typeof OPERATIONAL_FAULT_SCENARIOS)[number];

export type OperationalFaultPlan = {
  scenario: OperationalFaultScenario;
  attemptCount: number;
  injectionToken: string;
};

type Environment = Record<string, string | undefined>;

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATABASE_REF = /^[a-z0-9]{6,64}$/;

function equalSecret(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  return (
    leftBytes.length === rightBytes.length &&
    timingSafeEqual(leftBytes, rightBytes)
  );
}

export type OperationalFaultConfiguration =
  | { enabled: false }
  | {
      enabled: true;
      environment: "preview" | "staging";
      injectionTokens: string[];
      databaseRef: string;
    };

export function assertOperationalDatabaseIdentity(
  environment: Environment = process.env,
): string {
  const operationalRef =
    environment.AI_GRADING_OPERATIONAL_DATABASE_REF?.trim().toLowerCase();
  const productionRef =
    environment.AI_GRADING_PRODUCTION_DATABASE_REF?.trim().toLowerCase();
  if (!operationalRef || !productionRef) {
    throw new Error("AI_GRADING_OPERATIONAL_DATABASE_REFS_REQUIRED");
  }
  if (
    !DATABASE_REF.test(operationalRef) ||
    !DATABASE_REF.test(productionRef) ||
    operationalRef === productionRef
  ) {
    throw new Error("AI_GRADING_OPERATIONAL_DATABASE_REFS_INVALID");
  }
  let actualRef = "";
  try {
    const hostname = new URL(
      environment.NEXT_PUBLIC_SUPABASE_URL ?? "",
    ).hostname.toLowerCase();
    if (hostname.endsWith(".supabase.co")) {
      actualRef = hostname.slice(0, -".supabase.co".length);
    }
  } catch {
    // Report the same secret-safe identity error below.
  }
  if (!DATABASE_REF.test(actualRef) || actualRef !== operationalRef) {
    throw new Error("AI_GRADING_OPERATIONAL_DATABASE_IDENTITY_MISMATCH");
  }
  return operationalRef;
}

/**
 * Fault injection is a dedicated smoke-revision capability. It cannot be
 * enabled by NODE_ENV, a Pub/Sub attribute, or learner-controlled job data.
 */
export function readOperationalFaultConfiguration(
  environment: Environment = process.env,
): OperationalFaultConfiguration {
  if (
    environment.AI_GRADING_OPERATIONAL_FAULT_INJECTION_ENABLED?.trim() !==
    "true"
  ) {
    return { enabled: false };
  }
  const operationalEnvironment =
    environment.AI_GRADING_OPERATIONAL_ENVIRONMENT?.trim();
  if (
    operationalEnvironment !== "preview" &&
    operationalEnvironment !== "staging"
  ) {
    throw new Error("AI_GRADING_OPERATIONAL_ENVIRONMENT_INVALID");
  }
  const databaseRef = assertOperationalDatabaseIdentity(environment);
  const serviceUrl = environment.CLOUD_RUN_SERVICE_URL?.trim();
  const runtimeRevision = environment.K_REVISION?.trim();
  let serviceHostname = "";
  try {
    const parsed = new URL(serviceUrl ?? "");
    if (parsed.protocol === "https:") {
      serviceHostname = parsed.hostname.toLowerCase();
    }
  } catch {
    // The generic readiness contract reports the malformed service URL too.
  }
  if (
    !serviceHostname.includes(operationalEnvironment) ||
    serviceHostname === "thinkfy.net" ||
    serviceHostname.endsWith(".thinkfy.net") ||
    !runtimeRevision?.toLowerCase().includes(operationalEnvironment) ||
    /(^|[-_])(prod|production)(?=$|[-_])/i.test(runtimeRevision)
  ) {
    throw new Error("AI_GRADING_OPERATIONAL_RUNTIME_NOT_NONPRODUCTION");
  }
  if (
    environment.AI_GRADING_OPERATIONAL_ATTESTATION_ENABLED?.trim() !== "true"
  ) {
    throw new Error("AI_GRADING_OPERATIONAL_ATTESTATION_REQUIRED");
  }
  const injectionTokens =
    environment.AI_GRADING_OPERATIONAL_FAULT_INJECTION_TOKENS?.split(",")
      .map((value) => value.trim())
      .filter(Boolean) ?? [];
  if (
    injectionTokens.length === 0 ||
    injectionTokens.length > OPERATIONAL_FAULT_SCENARIOS.length ||
    new Set(injectionTokens).size !== injectionTokens.length ||
    injectionTokens.some((token) => !UUID.test(token))
  ) {
    throw new Error("AI_GRADING_OPERATIONAL_FAULT_INJECTION_TOKENS_INVALID");
  }
  return {
    enabled: true,
    environment: operationalEnvironment,
    injectionTokens,
    databaseRef,
  };
}

export async function validateOperationalFaultActivation(params: {
  repository: AiGradingRepository;
  environment?: Environment;
}): Promise<OperationalFaultConfiguration> {
  const configuration = readOperationalFaultConfiguration(params.environment);
  if (!configuration.enabled) return configuration;
  if (!params.repository.loadOperationalEnvironmentMarker) {
    throw new Error("AI_GRADING_OPERATIONAL_DATABASE_MARKER_UNAVAILABLE");
  }
  const marker = await params.repository.loadOperationalEnvironmentMarker();
  if (
    !marker ||
    marker.environment !== configuration.environment ||
    marker.projectRef !== configuration.databaseRef ||
    (marker.environment !== "preview" && marker.environment !== "staging")
  ) {
    throw new Error("AI_GRADING_OPERATIONAL_DATABASE_MARKER_MISMATCH");
  }
  return configuration;
}

export async function resolveOperationalFaultPlan(params: {
  repository: AiGradingRepository;
  job: AiGradingJob;
  claimToken: string;
  attemptCount: number;
  environment?: Environment;
  configuration?: OperationalFaultConfiguration;
}): Promise<OperationalFaultPlan | null> {
  const configuration =
    params.configuration ?? readOperationalFaultConfiguration(params.environment);
  if (!configuration.enabled) return null;
  if (!params.repository.loadOperationalFault) {
    throw new Error("AI_GRADING_OPERATIONAL_FAULT_REPOSITORY_UNAVAILABLE");
  }
  const fault = await params.repository.loadOperationalFault(
    params.job.workflowRunId,
    params.claimToken,
  );
  if (!fault) return null;
  if (
    fault.environment !== configuration.environment ||
    !configuration.injectionTokens.some((token) =>
      equalSecret(fault.injectionToken, token),
    )
  ) {
    throw new Error("AI_GRADING_OPERATIONAL_FAULT_BINDING_MISMATCH");
  }
  if (
    !OPERATIONAL_FAULT_SCENARIOS.includes(
      fault.scenario as OperationalFaultScenario,
    )
  ) {
    throw new Error("AI_GRADING_OPERATIONAL_SCENARIO_INVALID");
  }
  return {
    scenario: fault.scenario as OperationalFaultScenario,
    attemptCount: params.attemptCount,
    injectionToken: fault.injectionToken,
  };
}

export function injectsOnceAtAttempt(
  plan: OperationalFaultPlan | null,
  scenario: OperationalFaultScenario,
  attemptCount = 1,
): boolean {
  return plan?.scenario === scenario && plan.attemptCount === attemptCount;
}

export function injectsDefiniteFailure(
  plan: OperationalFaultPlan | null,
): boolean {
  return (
    plan?.scenario === "retry_exhaustion" &&
    plan.attemptCount >= 1 &&
    plan.attemptCount <= 3
  );
}

export function operationalAmbiguousTimeout(): Error {
  return Object.assign(new Error("Operational provider outcome is ambiguous."), {
    kind: "deadline_exceeded",
  });
}

export function operationalDefiniteProviderFailure(): Error {
  return Object.assign(new Error("Operational provider response failed."), {
    kind: "provider_unavailable",
    status: 503,
  });
}
