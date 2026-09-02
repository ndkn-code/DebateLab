import "server-only";

import { access, chmod, open, readFile, rename, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  OPERATIONAL_FAULT_SCENARIOS,
  type OperationalFaultScenario,
} from "./operational-faults";
import {
  assertOperationalEvidenceComplete,
  assertOperationalTarget,
  assertScenarioToken,
  operationalDetailsHash,
  operationalScenarioCounts,
  type OperationalEvidenceState,
} from "./operational-evidence";

type JsonRecord = Record<string, unknown>;
type AdminClient = ReturnType<typeof createAdminClient>;

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name}_REQUIRED`);
  return value;
}

function row(value: unknown, label: string): JsonRecord {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate || typeof candidate !== "object") {
    throw new Error(`${label}_EMPTY`);
  }
  return candidate as JsonRecord;
}

function uuid(value: unknown, label: string): string {
  if (
    typeof value !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  ) {
    throw new Error(`${label}_INVALID`);
  }
  return value;
}

function scenario(): OperationalFaultScenario {
  const value = required("AI_GRADING_OPERATIONAL_SCENARIO");
  if (
    !OPERATIONAL_FAULT_SCENARIOS.includes(value as OperationalFaultScenario)
  ) {
    throw new Error("AI_GRADING_OPERATIONAL_SCENARIO_INVALID");
  }
  return value as OperationalFaultScenario;
}

function statePath(): string {
  return resolve(required("AI_GRADING_OPERATIONAL_STATE_FILE"));
}

async function readState(path = statePath()): Promise<OperationalEvidenceState> {
  const metadata = await stat(path);
  if ((metadata.mode & 0o077) !== 0) {
    throw new Error("AI_GRADING_OPERATIONAL_STATE_FILE_PERMISSIONS_INVALID");
  }
  const value = JSON.parse(await readFile(path, "utf8"));
  if (!value || typeof value !== "object" || value.schemaVersion !== 1) {
    throw new Error("AI_GRADING_OPERATIONAL_STATE_INVALID");
  }
  return value as OperationalEvidenceState;
}

async function writeState(path: string, state: OperationalEvidenceState) {
  const temporary = `${path}.${process.pid}.tmp`;
  const handle = await open(temporary, "wx", 0o600);
  try {
    await handle.writeFile(`${JSON.stringify(state, null, 2)}\n`, "utf8");
  } finally {
    await handle.close();
  }
  await chmod(temporary, 0o600);
  await rename(temporary, path);
}

function rpcError(error: { message: string } | null, label: string) {
  if (error) throw new Error(`${label}: ${error.message}`);
}

function assertStateTarget(
  state: OperationalEvidenceState,
  target: ReturnType<typeof assertOperationalTarget>,
) {
  if (
    state.environment !== target.environment ||
    state.targetUrl !== target.targetUrl ||
    state.deploymentRef !== target.deploymentRef ||
    state.databaseRef !== target.databaseRef
  ) {
    throw new Error("AI_GRADING_OPERATIONAL_STATE_TARGET_MISMATCH");
  }
}

async function assertDatabaseMarker(
  supabase: AdminClient,
  target: ReturnType<typeof assertOperationalTarget>,
) {
  const { data, error } = await supabase.rpc(
    "get_ai_grading_environment_marker",
  );
  rpcError(error, "load operational database environment marker");
  const marker = row(data, "OPERATIONAL_DATABASE_MARKER");
  if (
    marker.environment !== target.environment ||
    marker.project_ref !== target.databaseRef ||
    (marker.environment !== "preview" && marker.environment !== "staging")
  ) {
    throw new Error("AI_GRADING_OPERATIONAL_DATABASE_MARKER_MISMATCH");
  }
}

async function recoverState(
  supabase: AdminClient,
  evidence: JsonRecord,
  target: ReturnType<typeof assertOperationalTarget>,
): Promise<OperationalEvidenceState> {
  if (
    evidence.environment !== target.environment ||
    evidence.deployment_id !== required("K_REVISION") ||
    evidence.image_digest !== required("AI_GRADING_IMAGE_DIGEST") ||
    evidence.grader_version !== required("AI_GRADING_GATE_VERSION") ||
    Number(evidence.corpus_version) !==
      Number(required("AI_GRADING_GATE_CORPUS_VERSION"))
  ) {
    throw new Error("AI_GRADING_OPERATIONAL_EXISTING_EVIDENCE_MISMATCH");
  }
  const evidenceId = uuid(evidence.id, "EVIDENCE_ID");
  const { data: claims, error: claimError } = await supabase
    .from("ai_grading_operational_claims")
    .select("id,workflow_run_id,scenario,injection_token")
    .eq("evidence_id", evidenceId);
  rpcError(claimError, "recover operational claims");
  const { data: finalized, error: finalizedError } = await supabase
    .from("ai_grading_operational_scenarios")
    .select("claim_id,passed")
    .eq("evidence_id", evidenceId);
  rpcError(finalizedError, "recover operational scenarios");
  const finalizedClaims = new Set(
    (finalized ?? [])
      .filter((item) => item.passed === true)
      .map((item) => item.claim_id),
  );
  const scenarios: OperationalEvidenceState["scenarios"] = {};
  for (const claim of claims ?? []) {
    if (
      !OPERATIONAL_FAULT_SCENARIOS.includes(
        claim.scenario as OperationalFaultScenario,
      )
    ) {
      throw new Error("AI_GRADING_OPERATIONAL_SCENARIO_INVALID");
    }
    scenarios[claim.scenario as OperationalFaultScenario] = {
      workflowRunId: uuid(claim.workflow_run_id, "WORKFLOW_RUN_ID"),
      claimId: uuid(claim.id, "CLAIM_ID"),
      injectionToken: uuid(claim.injection_token, "INJECTION_TOKEN"),
      finalized: finalizedClaims.has(claim.id),
    };
  }
  return {
    schemaVersion: 1,
    evidenceId,
    ...target,
    scenarios,
    sealed: evidence.status === "sealed",
  };
}

async function begin() {
  const target = assertOperationalTarget();
  const path = statePath();
  await access(dirname(path));
  const supabase = createAdminClient();
  await assertDatabaseMarker(supabase, target);
  const existingState = await readState(path).catch(() => null);
  if (existingState) {
    assertStateTarget(existingState, target);
    return {
      command: "begin",
      recovered: true,
      stateFile: path,
      ...operationalScenarioCounts(existingState),
    };
  }
  const corpusVersion = Number(required("AI_GRADING_GATE_CORPUS_VERSION"));
  if (!Number.isInteger(corpusVersion) || corpusVersion < 1) {
    throw new Error("AI_GRADING_GATE_CORPUS_VERSION_INVALID");
  }
  const runId = required("AI_GRADING_OPERATIONAL_RUN_ID");
  const { data: existingEvidence, error: existingError } = await supabase
    .from("ai_grading_operational_evidence")
    .select("id,grader_version,corpus_version,environment,deployment_id,image_digest,status")
    .eq("run_id", runId)
    .maybeSingle();
  rpcError(existingError, "recover operational evidence");
  if (existingEvidence) {
    const state = await recoverState(supabase, existingEvidence, target);
    await writeState(path, state);
    return {
      command: "begin",
      recovered: true,
      stateFile: path,
      ...operationalScenarioCounts(state),
    };
  }
  const { data, error } = await supabase.rpc(
    "begin_ai_grading_operational_evidence",
    {
      p_run_id: runId,
      p_grader_version: required("AI_GRADING_GATE_VERSION"),
      p_corpus_version: corpusVersion,
      p_environment: target.environment,
      p_deployment_id: required("K_REVISION"),
      p_image_digest: required("AI_GRADING_IMAGE_DIGEST"),
    },
  );
  rpcError(error, "begin operational evidence");
  const state: OperationalEvidenceState = {
    schemaVersion: 1,
    evidenceId: uuid(row(data, "OPERATIONAL_EVIDENCE").id, "EVIDENCE_ID"),
    ...target,
    scenarios: {},
    sealed: false,
  };
  await writeState(path, state);
  return {
    command: "begin",
    stateFile: path,
    ...operationalScenarioCounts(state),
  };
}

async function declare() {
  const target = assertOperationalTarget();
  const path = statePath();
  const supabase = createAdminClient();
  await assertDatabaseMarker(supabase, target);
  const state = await readState(path);
  assertStateTarget(state, target);
  if (state.sealed) throw new Error("AI_GRADING_OPERATIONAL_STATE_SEALED");
  const selected = scenario();
  if (state.scenarios[selected]) {
    return { command: "declare", scenario: selected, recovered: true, stateFile: path };
  }
  const workflowRunId = uuid(
    required("AI_GRADING_OPERATIONAL_WORKFLOW_RUN_ID"),
    "WORKFLOW_RUN_ID",
  );
  const { data: existingClaim, error: existingError } = await supabase
    .from("ai_grading_operational_claims")
    .select("id,workflow_run_id,injection_token")
    .eq("evidence_id", state.evidenceId)
    .eq("scenario", selected)
    .maybeSingle();
  rpcError(existingError, "recover operational scenario declaration");
  if (existingClaim) {
    if (existingClaim.workflow_run_id !== workflowRunId) {
      throw new Error("AI_GRADING_OPERATIONAL_EXISTING_CLAIM_MISMATCH");
    }
    state.scenarios[selected] = {
      workflowRunId,
      claimId: uuid(existingClaim.id, "CLAIM_ID"),
      injectionToken: uuid(existingClaim.injection_token, "INJECTION_TOKEN"),
      finalized: false,
    };
    await writeState(path, state);
    return { command: "declare", scenario: selected, recovered: true, stateFile: path };
  }
  const { data, error } = await supabase.rpc(
    "declare_ai_grading_operational_scenario",
    {
      p_evidence_id: state.evidenceId,
      p_workflow_run_id: workflowRunId,
      p_scenario: selected,
    },
  );
  rpcError(error, "declare operational scenario");
  const claim = row(data, "OPERATIONAL_CLAIM");
  state.scenarios[selected] = {
    workflowRunId,
    claimId: uuid(claim.id, "CLAIM_ID"),
    injectionToken: uuid(claim.injection_token, "INJECTION_TOKEN"),
    finalized: false,
  };
  await writeState(path, state);
  return { command: "declare", scenario: selected, stateFile: path };
}

async function poll() {
  const target = assertOperationalTarget();
  const supabase = createAdminClient();
  await assertDatabaseMarker(supabase, target);
  const state = await readState();
  assertStateTarget(state, target);
  const ids = OPERATIONAL_FAULT_SCENARIOS.flatMap((item) => {
    const declared = state.scenarios[item];
    return declared ? [declared.workflowRunId] : [];
  });
  if (ids.length === 0) {
    return {
      command: "poll",
      terminal: 0,
      ...operationalScenarioCounts(state),
    };
  }
  const { data, error } = await supabase
    .from("ai_workflow_runs")
    .select("id,status")
    .in("id", ids);
  rpcError(error, "poll operational scenarios");
  const terminal = (data ?? []).filter(
    (item) => item.status === "completed" || item.status === "failed",
  ).length;
  return { command: "poll", terminal, ...operationalScenarioCounts(state) };
}

async function finalize() {
  const target = assertOperationalTarget();
  const path = statePath();
  const supabase = createAdminClient();
  await assertDatabaseMarker(supabase, target);
  const state = await readState(path);
  assertStateTarget(state, target);
  const selected = scenario();
  const declared = state.scenarios[selected];
  if (!declared) {
    throw new Error("AI_GRADING_OPERATIONAL_SCENARIO_NOT_FINALIZABLE");
  }
  if (declared.finalized) {
    return { command: "finalize", scenario: selected, passed: true, recovered: true };
  }
  assertScenarioToken({
    state,
    scenario: selected,
    configuredTokens:
      process.env.AI_GRADING_OPERATIONAL_FAULT_INJECTION_TOKENS,
  });
  const { data: existingFinal, error: existingFinalError } = await supabase
    .from("ai_grading_operational_scenarios")
    .select("passed")
    .eq("claim_id", declared.claimId)
    .maybeSingle();
  rpcError(existingFinalError, "recover finalized operational scenario");
  if (existingFinal) {
    if (existingFinal.passed !== true) {
      throw new Error("AI_GRADING_OPERATIONAL_SCENARIO_FAILED");
    }
    declared.finalized = true;
    await writeState(path, state);
    return { command: "finalize", scenario: selected, passed: true, recovered: true };
  }
  const { data: run, error: runError } = await supabase
    .from("ai_workflow_runs")
    .select(
      "id,status,last_error_code,provider_attempt_count,workflow_attempt_count,last_delivery_attempt,updated_at",
    )
    .eq("id", declared.workflowRunId)
    .single();
  rpcError(runError, "load operational scenario details");
  const detailsHash = operationalDetailsHash({ scenario: selected, run });
  const invalidCitationCount = Number(
    process.env.AI_GRADING_OPERATIONAL_INVALID_CITATION_COUNT ?? "0",
  );
  if (!Number.isInteger(invalidCitationCount) || invalidCitationCount < 0) {
    throw new Error("AI_GRADING_OPERATIONAL_INVALID_CITATION_COUNT_INVALID");
  }
  const { data, error } = await supabase.rpc(
    "finalize_ai_grading_operational_scenario",
    {
      p_claim_id: declared.claimId,
      p_injection_token: declared.injectionToken,
      p_invalid_authoritative_citation_count: invalidCitationCount,
      p_details_hash: detailsHash,
    },
  );
  rpcError(error, "finalize operational scenario");
  const finalized = row(data, "OPERATIONAL_SCENARIO");
  if (finalized.passed !== true) {
    throw new Error("AI_GRADING_OPERATIONAL_SCENARIO_FAILED");
  }
  declared.finalized = true;
  await writeState(path, state);
  return { command: "finalize", scenario: selected, passed: true };
}

async function seal() {
  const target = assertOperationalTarget();
  const path = statePath();
  const supabase = createAdminClient();
  await assertDatabaseMarker(supabase, target);
  const state = await readState(path);
  assertStateTarget(state, target);
  if (state.sealed) {
    return { command: "seal", sealed: true, recovered: true, ...operationalScenarioCounts(state) };
  }
  const { data: existingEvidence, error: existingEvidenceError } = await supabase
    .from("ai_grading_operational_evidence")
    .select("status")
    .eq("id", state.evidenceId)
    .single();
  rpcError(existingEvidenceError, "recover sealed operational evidence");
  if (!existingEvidence) {
    throw new Error("AI_GRADING_OPERATIONAL_EVIDENCE_NOT_FOUND");
  }
  if (existingEvidence.status === "sealed") {
    state.sealed = true;
    await writeState(path, state);
    return { command: "seal", sealed: true, recovered: true, ...operationalScenarioCounts(state) };
  }
  assertOperationalEvidenceComplete(state);
  const { data: scenarios, error: scenarioError } = await supabase
    .from("ai_grading_operational_scenarios")
    .select("scenario,passed,details_hash,workflow_run_id")
    .eq("evidence_id", state.evidenceId);
  rpcError(scenarioError, "load finalized operational scenarios");
  if (
    !Array.isArray(scenarios) ||
    scenarios.length !== OPERATIONAL_FAULT_SCENARIOS.length ||
    scenarios.some((item) => item.passed !== true)
  ) {
    throw new Error("AI_GRADING_OPERATIONAL_SCENARIOS_INCOMPLETE");
  }
  const evidenceHash = operationalDetailsHash(
    [...scenarios].sort((left, right) =>
      left.scenario.localeCompare(right.scenario),
    ),
  );
  const { error } = await supabase.rpc("seal_ai_grading_operational_evidence", {
    p_evidence_id: state.evidenceId,
    p_evidence_hash: evidenceHash,
  });
  rpcError(error, "seal operational evidence");
  state.sealed = true;
  await writeState(path, state);
  return { command: "seal", sealed: true, ...operationalScenarioCounts(state) };
}

async function main() {
  const command = process.argv[2];
  const result =
    command === "begin"
      ? await begin()
      : command === "declare"
        ? await declare()
        : command === "poll"
          ? await poll()
          : command === "finalize"
            ? await finalize()
            : command === "seal"
              ? await seal()
              : (() => {
                  throw new Error(
                    "Usage: operational:evidence -- begin|declare|poll|finalize|seal",
                  );
                })();
  // Never emit the protected state, injection token, learner data, or labels.
  process.stdout.write(`${JSON.stringify({ ok: true, ...result })}\n`);
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : "Operational evidence command failed"}\n`,
  );
  process.exitCode = 1;
});
