import { createHash } from "node:crypto";
import {
  assertOperationalDatabaseIdentity,
  OPERATIONAL_FAULT_SCENARIOS,
  type OperationalFaultScenario,
} from "./operational-faults";

type Environment = Record<string, string | undefined>;

export type OperationalEvidenceState = {
  schemaVersion: 1;
  evidenceId: string;
  environment: "preview" | "staging";
  targetUrl: string;
  deploymentRef: string;
  databaseRef: string;
  scenarios: Partial<
    Record<
      OperationalFaultScenario,
      {
        workflowRunId: string;
        claimId: string;
        injectionToken: string;
        finalized: boolean;
      }
    >
  >;
  sealed: boolean;
};

export type OperationalTarget = Pick<
  OperationalEvidenceState,
  "environment" | "targetUrl" | "deploymentRef" | "databaseRef"
>;

function required(environment: Environment, name: string): string {
  const value = environment[name]?.trim();
  if (!value) throw new Error(`${name}_REQUIRED`);
  return value;
}

/** The ops CLI never accepts the public production host or production refs. */
export function assertOperationalTarget(
  environment: Environment = process.env,
): OperationalTarget {
  const operationalEnvironment = required(
    environment,
    "AI_GRADING_OPERATIONAL_ENVIRONMENT",
  );
  if (
    operationalEnvironment !== "preview" &&
    operationalEnvironment !== "staging"
  ) {
    throw new Error("AI_GRADING_OPERATIONAL_ENVIRONMENT_INVALID");
  }
  const rawUrl = required(environment, "AI_GRADING_OPERATIONAL_TARGET_URL");
  let targetUrl: URL;
  try {
    targetUrl = new URL(rawUrl);
  } catch {
    throw new Error("AI_GRADING_OPERATIONAL_TARGET_URL_INVALID");
  }
  const hostname = targetUrl.hostname.toLowerCase();
  if (
    targetUrl.protocol !== "https:" ||
    hostname === "thinkfy.net" ||
    hostname.endsWith(".thinkfy.net") ||
    !hostname.includes(operationalEnvironment)
  ) {
    throw new Error("AI_GRADING_OPERATIONAL_TARGET_URL_NOT_NONPRODUCTION");
  }
  const deploymentRef = required(
    environment,
    "AI_GRADING_OPERATIONAL_DEPLOYMENT_REF",
  );
  if (
    /(^|[/:_-])(main|master|prod|production)(?=$|[/:_-])/i.test(deploymentRef)
  ) {
    throw new Error("AI_GRADING_OPERATIONAL_DEPLOYMENT_REF_PRODUCTION");
  }
  const databaseRef = assertOperationalDatabaseIdentity(environment);
  return {
    environment: operationalEnvironment,
    targetUrl: targetUrl.toString().replace(/\/$/, ""),
    deploymentRef,
    databaseRef,
  };
}

export function operationalScenarioCounts(state: OperationalEvidenceState) {
  const declared = OPERATIONAL_FAULT_SCENARIOS.filter(
    (scenario) => state.scenarios[scenario],
  ).length;
  const finalized = OPERATIONAL_FAULT_SCENARIOS.filter(
    (scenario) => state.scenarios[scenario]?.finalized,
  ).length;
  return { required: OPERATIONAL_FAULT_SCENARIOS.length, declared, finalized };
}

export function assertOperationalEvidenceComplete(
  state: OperationalEvidenceState,
): void {
  const counts = operationalScenarioCounts(state);
  if (counts.declared !== counts.required || counts.finalized !== counts.required) {
    throw new Error("AI_GRADING_OPERATIONAL_SCENARIOS_INCOMPLETE");
  }
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function operationalDetailsHash(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

export function assertScenarioToken(params: {
  state: OperationalEvidenceState;
  scenario: OperationalFaultScenario;
  configuredTokens: string | undefined;
}): void {
  const declared = params.state.scenarios[params.scenario];
  if (!declared) throw new Error("AI_GRADING_OPERATIONAL_SCENARIO_NOT_DECLARED");
  const tokens =
    params.configuredTokens
      ?.split(",")
      .map((value) => value.trim())
      .filter(Boolean) ?? [];
  if (tokens.length === 0) {
    throw new Error("AI_GRADING_OPERATIONAL_FAULT_INJECTION_TOKENS_REQUIRED");
  }
  if (!tokens.includes(declared.injectionToken)) {
    throw new Error("AI_GRADING_OPERATIONAL_FAULT_BINDING_MISMATCH");
  }
}
