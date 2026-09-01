import { createHash } from "node:crypto";

import {
  AI_GRADING_BENCHMARK_PRIVATE_BUCKET,
  parseGradingPrediction,
  parseOperationalSafetyEvidence,
  countInvalidStoredBenchmarkRows,
  protectedBenchmarkInputSchema,
  verifyBenchmarkReleaseAttestation,
} from "@/lib/ai/benchmarks/contracts";
import { assertIeltsBenchmarkModelInputHash } from "@/lib/ai/benchmarks/request";
import {
  deriveIeltsTaskBand,
  evaluateBenchmark,
  evaluateDerivedReleaseGate,
  normalizeIeltsCriterion,
  validateIeltsBenchmarkCoverage,
  type BenchmarkCoverageObservation,
  type BenchmarkObservation,
  type ReleaseGateResult,
} from "@/lib/ai/benchmarks/evaluate";
import { createAdminClient } from "@/lib/supabase/admin";

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function evaluationRows(value: unknown): JsonRecord[] {
  return Array.isArray(value)
    ? value.map(record)
    : value
      ? [record(value)]
      : [];
}

function firstRecord(value: unknown): JsonRecord {
  return Array.isArray(value) ? record(value[0]) : record(value);
}

function storedReleaseBenchmark(row: JsonRecord) {
  const source = firstRecord(row.source);
  const releaseAttestation = firstRecord(row.release_attestation);
  return {
    benchmarkKey: row.benchmark_key,
    skill: row.skill,
    taskType: row.task_type,
    accentGroup: row.accent_group,
    protectedLabel: row.protected_label,
    releaseAttestation: {
      keyId: releaseAttestation.key_id,
      envelope: releaseAttestation.envelope,
      signatureBase64: releaseAttestation.signature_base64,
    },
    metadata: row.metadata,
    source: {
      canonicalUrl: source.canonical_url,
      authorityTier: source.authority_tier,
      rightsStatus: source.rights_status,
      reviewStatus: source.review_status,
      checksum: source.checksum,
      submittedBy: source.submitted_by,
      reviewedBy: source.reviewed_by,
    },
  };
}

function ed25519PublicKeyPem(base64Der: string): string {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64Der)) {
    throw new Error("AI_GRADING_BENCHMARK_ATTESTATION_PUBLIC_KEY_BASE64 is invalid");
  }
  const body = base64Der.match(/.{1,64}/g)?.join("\n") ?? base64Der;
  return `-----BEGIN PUBLIC KEY-----\n${body}\n-----END PUBLIC KEY-----\n`;
}

function verifyStudyLeadReleaseAttestations(params: {
  rows: JsonRecord[];
  keyId: string;
  publicKeyPem: string;
  now: Date;
}) {
  for (const row of params.rows) {
    const stored = storedReleaseBenchmark(row);
    if (stored.releaseAttestation.keyId !== params.keyId) {
      throw new Error("benchmark release attestation key ID is not trusted");
    }
    verifyBenchmarkReleaseAttestation({
      attestation: stored.releaseAttestation,
      publicKeyPem: params.publicKeyPem,
      now: params.now,
    });
  }
}

type UntypedQueryResult = {
  data: unknown;
  error: { message: string } | null;
};

interface UntypedReleaseQuery {
  eq(column: string, value: unknown): UntypedReleaseQuery;
  gte(column: string, value: unknown): UntypedReleaseQuery;
  lte(column: string, value: unknown): UntypedReleaseQuery;
  order(column: string, options: { ascending: boolean }): UntypedReleaseQuery;
  limit(count: number): PromiseLike<UntypedQueryResult>;
}

interface UntypedReleaseClient {
  from(table: string): {
    select(columns: string): UntypedReleaseQuery;
  };
}

interface StorageObjectQuery {
  eq(column: string, value: string): StorageObjectQuery;
  maybeSingle(): PromiseLike<{
    data: {
      id?: unknown;
      public?: unknown;
      version?: unknown;
      metadata?: unknown;
    } | null;
    error: { message: string } | null;
  }>;
}

type StorageMetadataClient = {
  schema(name: "storage"): {
    from(table: "objects" | "buckets"): {
      select(columns: string): StorageObjectQuery;
    };
  };
};

async function assertPrivateBenchmarkBucket(client: StorageMetadataClient) {
  const { data, error } = await client
    .schema("storage")
    .from("buckets")
    .select("id,public")
    .eq("id", AI_GRADING_BENCHMARK_PRIVATE_BUCKET)
    .maybeSingle();
  if (
    error ||
    !data ||
    data.id !== AI_GRADING_BENCHMARK_PRIVATE_BUCKET ||
    data.public !== false
  ) {
    throw new Error("benchmark private storage bucket is unavailable");
  }
}

async function verifyAcousticAttestation(params: {
  client: ReturnType<typeof createAdminClient>;
  benchmarkKey: string;
  input: ReturnType<typeof protectedBenchmarkInputSchema.parse>;
}) {
  const attestation = params.input.audioPreprocessing?.acousticAttestation;
  if (!attestation) return;
  const rpcClient = params.client as unknown as {
    rpc(
      name: string,
      args: Record<string, unknown>,
    ): PromiseLike<{ data: unknown; error: { message: string } | null }>;
  };
  const { data, error } = await rpcClient.rpc(
    "verify_ai_grading_benchmark_acoustic_attestation",
    {
      p_benchmark_key: params.benchmarkKey,
      p_envelope: attestation.envelope,
      p_signature: attestation.signature,
    },
  );
  if (error || data !== true) {
    throw new Error("stored benchmark acoustic attestation verification failed");
  }
}

function sha256(value: string | ArrayBuffer | Uint8Array): string {
  return createHash("sha256")
    .update(
      typeof value === "string"
        ? Buffer.from(value, "utf8")
        : value instanceof Uint8Array
          ? Buffer.from(value)
          : Buffer.from(value),
    )
    .digest("hex");
}

async function verifyStoredArtifactBytes(params: {
  client: ReturnType<typeof createAdminClient>;
  rows: JsonRecord[];
}): Promise<Map<string, Uint8Array>> {
  const audioReports = new Map<string, Uint8Array>();
  const storageMetadataClient =
    params.client as unknown as StorageMetadataClient;
  await assertPrivateBenchmarkBucket(storageMetadataClient);
  for (const row of params.rows) {
    const input = protectedBenchmarkInputSchema.parse(
      record(row.protected_label).input,
    );
    await verifyAcousticAttestation({
      client: params.client,
      benchmarkKey: String(row.benchmark_key),
      input,
    });
    const expectedHash = input.artifactSha256.toLowerCase();
    if (input.responseText) {
      if (sha256(input.responseText) !== expectedHash) {
        throw new Error("stored benchmark text checksum mismatch");
      }
      continue;
    }
    const storagePath = input.audioObjectPath ?? input.responseObjectPath ?? "";
    const [bucket, ...nameParts] = storagePath.split("/");
    const objectName = nameParts.join("/");
    if (bucket !== AI_GRADING_BENCHMARK_PRIVATE_BUCKET || !objectName) {
      throw new Error("stored benchmark object path invalid");
    }
    const { data: objectRow, error: objectError } = await storageMetadataClient
      .schema("storage")
      .from("objects")
      .select("version,metadata")
      .eq("bucket_id", bucket)
      .eq("name", objectName)
      .maybeSingle();
    const metadata = record(objectRow?.metadata);
    if (
      objectError ||
      !objectRow ||
      String(objectRow.version ?? "") !==
        String(input.artifactStorageVersion ?? "") ||
      String(metadata.eTag ?? metadata.etag ?? "") !==
        String(input.artifactEtag ?? "")
    ) {
      throw new Error("stored benchmark object version/ETag mismatch");
    }
    const { data: artifact, error: downloadError } = await params.client.storage
      .from(bucket)
      .download(objectName);
    if (
      downloadError ||
      !artifact ||
      sha256(await artifact.arrayBuffer()) !== expectedHash
    ) {
      throw new Error("stored benchmark object checksum mismatch");
    }
    if (!input.audioObjectPath) continue;
    const report = input.audioPreprocessing!.pronunciation;
    const reportPath = report.reportObjectPath;
    const [reportBucket, ...reportNameParts] = reportPath.split("/");
    const reportName = reportNameParts.join("/");
    if (
      reportBucket !== AI_GRADING_BENCHMARK_PRIVATE_BUCKET ||
      !reportName
    ) {
      throw new Error("stored benchmark Azure report path invalid");
    }
    const { data: reportRow, error: reportObjectError } =
      await storageMetadataClient
        .schema("storage")
        .from("objects")
        .select("version,metadata")
        .eq("bucket_id", reportBucket)
        .eq("name", reportName)
        .maybeSingle();
    const reportMetadata = record(reportRow?.metadata);
    if (
      reportObjectError ||
      !reportRow ||
      String(reportRow.version ?? "") !==
        report.reportStorageVersion ||
      String(reportMetadata.eTag ?? reportMetadata.etag ?? "") !==
        report.reportEtag
    ) {
      throw new Error("stored benchmark Azure report version/ETag mismatch");
    }
    const { data: reportObject, error: reportDownloadError } =
      await params.client.storage.from(reportBucket).download(reportName);
    if (!reportObject || reportDownloadError) {
      throw new Error("stored benchmark Azure report download failed");
    }
    const reportBytes = new Uint8Array(await reportObject.arrayBuffer());
    if (
      sha256(reportBytes) !== report.reportSha256.toLowerCase()
    ) {
      throw new Error("stored benchmark Azure report checksum mismatch");
    }
    audioReports.set(String(row.benchmark_key), reportBytes);
  }
  return audioReports;
}

function verifyStoredModelInputs(params: {
  rows: JsonRecord[];
  audioReports: Map<string, Uint8Array>;
}) {
  for (const row of params.rows) {
    const protectedLabel = record(row.protected_label);
    const input = protectedBenchmarkInputSchema.parse(protectedLabel.input);
    const skill = row.skill;
    if (skill !== "ielts_speaking" && skill !== "ielts_writing") {
      throw new Error("stored benchmark skill invalid");
    }
    if (
      typeof row.task_type !== "string" ||
      typeof protectedLabel.rubricVersion !== "string"
    ) {
      throw new Error("stored benchmark scoring identity incomplete");
    }
    assertIeltsBenchmarkModelInputHash(
      {
        skill,
        taskType: row.task_type,
        rubricVersion: protectedLabel.rubricVersion,
        input,
      },
      {
        audioReportBytes: params.audioReports.get(String(row.benchmark_key)),
      },
    );
  }
}

function operationalScenario(value: unknown) {
  const row = record(value);
  const workflow = firstRecord(row.workflow);
  return {
    workflowRunId: row.workflow_run_id,
    scenario: row.scenario,
    expectedProviderCalls: row.expected_provider_calls,
    observedProviderCalls: row.observed_provider_calls,
    actualProviderCalls: workflow.provider_attempt_count,
    terminalStatus: row.terminal_status,
    actualWorkflowStatus: workflow.status,
    invalidAuthoritativeCitationCount: row.invalid_authoritative_citation_count,
    passed: row.passed,
    detailsHash: row.details_hash,
  };
}

async function loadOperationalEvidence(params: {
  client: ReturnType<typeof createAdminClient>;
  graderVersion: string;
  corpusVersion: number;
  environment: "preview" | "staging";
  deploymentId: string;
  imageDigest: string;
}) {
  const client = params.client as unknown as UntypedReleaseClient;
  const { data, error } = await client
    .from("ai_grading_operational_evidence")
    .select(
      "run_id,grader_version,corpus_version,environment,deployment_id,image_digest,started_at,verified_at,expires_at,evidence_hash,scenarios:ai_grading_operational_scenarios(workflow_run_id,scenario,expected_provider_calls,observed_provider_calls,terminal_status,invalid_authoritative_citation_count,passed,details_hash,workflow:ai_workflow_runs!ai_grading_operational_scenarios_workflow_run_id_fkey(status,provider_attempt_count))",
    )
    .eq("grader_version", params.graderVersion)
    .eq("corpus_version", params.corpusVersion)
    .eq("environment", params.environment)
    .eq("deployment_id", params.deploymentId)
    .eq("image_digest", params.imageDigest)
    .eq("status", "sealed")
    .order("verified_at", { ascending: false })
    .limit(1);
  if (error) {
    throw new Error(`operational evidence query failed: ${error.message}`);
  }
  const row = Array.isArray(data) ? record(data[0]) : {};
  return parseOperationalSafetyEvidence({
    runId: row.run_id,
    graderVersion: row.grader_version,
    corpusVersion: row.corpus_version,
    environment: row.environment,
    deploymentId: row.deployment_id,
    imageDigest: row.image_digest,
    startedAt: row.started_at,
    verifiedAt: row.verified_at,
    expiresAt: row.expires_at,
    evidenceHash: row.evidence_hash,
    scenarios: Array.isArray(row.scenarios)
      ? row.scenarios.map(operationalScenario)
      : [],
  });
}

async function countStrandedCohortRuns(params: {
  client: ReturnType<typeof createAdminClient>;
  safety: NonNullable<ReturnType<typeof parseOperationalSafetyEvidence>>;
}) {
  const client = params.client as unknown as UntypedReleaseClient;
  const { data, error } = await client
    .from("ai_workflow_runs")
    .select("id,status,created_at,updated_at")
    .eq("backend", "gcp_pubsub")
    .gte("created_at", params.safety.startedAt)
    .lte("created_at", params.safety.verifiedAt)
    .limit(10_000);
  if (error) throw new Error(`workflow cohort query failed: ${error.message}`);
  const rows = Array.isArray(data) ? data.map(record) : [];
  const expectedFailedRuns = new Set(
    params.safety.scenarios
      .filter((scenario) => scenario.terminalStatus === "failed")
      .map((scenario) => scenario.workflowRunId),
  );
  const stranded = rows.filter((row) => {
    const status = typeof row.status === "string" ? row.status : "unknown";
    if (status === "completed") return false;
    if (status === "failed") return !expectedFailedRuns.has(String(row.id));
    return true;
  }).length;
  return stranded + (rows.length === 10_000 ? 1 : 0);
}

function numericBand(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const candidate = record(value).band;
  return typeof candidate === "number" && Number.isFinite(candidate)
    ? candidate
    : null;
}

function coverageFromRow(row: JsonRecord): BenchmarkCoverageObservation[] {
  const expectedCriteria = record(record(row.protected_label).criteria);
  const skill = typeof row.skill === "string" ? row.skill : "";
  const taskType = typeof row.task_type === "string" ? row.task_type : "";
  const accentGroup =
    typeof row.accent_group === "string" ? row.accent_group : null;
  return Object.entries(expectedCriteria).flatMap(([criterion, label]) => {
    const expectedBand = numericBand(label);
    return expectedBand === null
      ? []
      : [
          {
            benchmarkId: String(row.id),
            skill,
            criterion,
            expectedBand,
            taskType,
            accentGroup,
          },
        ];
  });
}

function observationsFromPrediction(params: {
  row: JsonRecord;
  prediction: unknown;
}): BenchmarkObservation[] {
  const skill = typeof params.row.skill === "string" ? params.row.skill : "";
  const parsed = parseGradingPrediction(skill, params.prediction);
  if (!parsed) return [];
  const expectedCriteria = record(record(params.row.protected_label).criteria);
  return Object.entries(expectedCriteria).flatMap(([criterion, label]) => {
    const expectedBand = numericBand(label);
    const predictedBand = parsed.criteria[normalizeIeltsCriterion(criterion)];
    if (expectedBand === null || typeof predictedBand !== "number") return [];
    return [
      {
        benchmarkId: String(params.row.id),
        skill,
        criterion,
        expectedBand,
        predictedBand,
        taskType:
          typeof params.row.task_type === "string" ? params.row.task_type : "",
        accentGroup:
          typeof params.row.accent_group === "string"
            ? params.row.accent_group
            : null,
        l1Group:
          typeof record(params.row.metadata).l1Group === "string"
            ? String(record(params.row.metadata).l1Group)
            : null,
        audioQualityGroup:
          typeof record(params.row.metadata).audioQualityGroup === "string"
            ? String(record(params.row.metadata).audioQualityGroup)
            : null,
      },
    ];
  });
}

function overallObservationFromPrediction(params: {
  row: JsonRecord;
  prediction: unknown;
}): BenchmarkObservation | null {
  const skill = typeof params.row.skill === "string" ? params.row.skill : "";
  const parsed = parseGradingPrediction(skill, params.prediction);
  if (!parsed) return null;
  const expectedLabel = record(params.row.protected_label);
  const expectedBand = numericBand(expectedLabel.overallBand);
  const predictedBand = deriveIeltsTaskBand(Object.values(parsed.criteria));
  if (expectedBand === null || predictedBand === null) return null;
  return {
    benchmarkId: String(params.row.id),
    skill,
    criterion: "overall",
    expectedBand,
    predictedBand,
    taskType:
      typeof params.row.task_type === "string" ? params.row.task_type : "",
    accentGroup:
      typeof params.row.accent_group === "string"
        ? params.row.accent_group
        : null,
    l1Group:
      typeof record(params.row.metadata).l1Group === "string"
        ? String(record(params.row.metadata).l1Group)
        : null,
    audioQualityGroup:
      typeof record(params.row.metadata).audioQualityGroup === "string"
        ? String(record(params.row.metadata).audioQualityGroup)
        : null,
  };
}

function matchingRepeatPairs(params: {
  row: JsonRecord;
  primary: BenchmarkObservation[];
  repeatPrediction: unknown;
}) {
  const repeated = observationsFromPrediction({
    row: params.row,
    prediction: params.repeatPrediction,
  });
  const repeatedByCriterion = new Map(
    repeated.map((item) => [item.criterion, item]),
  );
  return params.primary.flatMap((first) => {
    const second = repeatedByCriterion.get(first.criterion);
    return second ? [{ first, second }] : [];
  });
}

async function main() {
  const graderVersion = process.env.AI_GRADING_GATE_VERSION;
  const corpusVersion = Number(process.env.AI_GRADING_GATE_CORPUS_VERSION);
  const environment = process.env.AI_GRADING_GATE_ENVIRONMENT;
  const deploymentId = process.env.AI_GRADING_GATE_DEPLOYMENT_ID;
  const imageDigest = process.env.AI_GRADING_GATE_IMAGE_DIGEST;
  const studyLeadKeyId =
    process.env.AI_GRADING_BENCHMARK_ATTESTATION_KEY_ID;
  const studyLeadPublicKeyBase64 =
    process.env.AI_GRADING_BENCHMARK_ATTESTATION_PUBLIC_KEY_BASE64;
  if (
    !graderVersion ||
    !Number.isInteger(corpusVersion) ||
    corpusVersion <= 0 ||
    (environment !== "preview" && environment !== "staging") ||
    !deploymentId ||
    !imageDigest ||
    !studyLeadKeyId ||
    !studyLeadPublicKeyBase64 ||
    !/^sha256:[a-f0-9]{64}$/.test(imageDigest)
  ) {
    throw new Error(
      "AI_GRADING_GATE_VERSION, a positive AI_GRADING_GATE_CORPUS_VERSION, AI_GRADING_GATE_ENVIRONMENT=preview|staging, AI_GRADING_GATE_DEPLOYMENT_ID, AI_GRADING_GATE_IMAGE_DIGEST=sha256:<digest>, AI_GRADING_BENCHMARK_ATTESTATION_KEY_ID, and AI_GRADING_BENCHMARK_ATTESTATION_PUBLIC_KEY_BASE64 are required",
    );
  }
  const client = createAdminClient();
  // The service-role process is the only component allowed to read these gold
  // labels. Nothing below emits a label or benchmark response to stdout.
  const { data, error } = await client
    .from("ai_grading_benchmarks")
    .select(
      "id, benchmark_key, skill, task_type, accent_group, protected_label, metadata, release_attestation:ai_grading_benchmark_release_attestations!ai_grading_benchmark_release_attestations_benchmark_id_fkey(key_id,envelope,signature_base64,verified_at,expires_at), source:ai_knowledge_sources!ai_grading_benchmarks_source_id_fkey(canonical_url, authority_tier, rights_status, review_status, checksum, submitted_by, reviewed_by), ai_grading_evaluations(id,grader_version,corpus_version,runs:ai_grading_evaluation_runs(run_kind,prediction,provider_request_id,trace_id,started_at,completed_at))",
    )
    .eq("split", "holdout")
    .eq("is_active", true);
  if (error) throw new Error(`grading gate query failed: ${error.message}`);

  const benchmarkRows = (data ?? []).map(record);
  verifyStudyLeadReleaseAttestations({
    rows: benchmarkRows,
    keyId: studyLeadKeyId,
    publicKeyPem: ed25519PublicKeyPem(studyLeadPublicKeyBase64),
    now: new Date(),
  });
  const audioReports = await verifyStoredArtifactBytes({
    client,
    rows: benchmarkRows,
  });
  // A row cannot contribute coverage or accuracy until release independently
  // re-verifies its exact model input and all protected acoustic provenance.
  verifyStoredModelInputs({ rows: benchmarkRows, audioReports });
  const coverage = validateIeltsBenchmarkCoverage(
    benchmarkRows.flatMap(coverageFromRow),
  );
  const observations: BenchmarkObservation[] = [];
  const overallObservations: BenchmarkObservation[] = [];
  const repeats: Array<{
    first: BenchmarkObservation;
    second: BenchmarkObservation;
  }> = [];
  const overallRepeats: Array<{
    first: BenchmarkObservation;
    second: BenchmarkObservation;
  }> = [];
  let schemaValidPredictionCount = 0;

  for (const row of benchmarkRows) {
    const evaluation = evaluationRows(row.ai_grading_evaluations).find(
      (candidate) =>
        candidate.grader_version === graderVersion &&
        candidate.corpus_version === corpusVersion,
    );
    if (!evaluation) continue;
    const evaluationRuns = evaluationRows(evaluation.runs);
    const primaryRun = evaluationRuns.find((run) => run.run_kind === "primary");
    const repeatRun = evaluationRuns.find((run) => run.run_kind === "repeat");
    if (!primaryRun || !repeatRun) continue;
    const primary = observationsFromPrediction({
      row,
      prediction: primaryRun.prediction,
    });
    // A complete criterion-level set is the schema-success denominator. A
    // malformed/incomplete stored JSON document counts as a failed output.
    if (primary.length === coverageFromRow(row).length && primary.length > 0) {
      schemaValidPredictionCount += 1;
    }
    observations.push(...primary);
    const primaryOverall = overallObservationFromPrediction({
      row,
      prediction: primaryRun.prediction,
    });
    const repeatOverall = overallObservationFromPrediction({
      row,
      prediction: repeatRun.prediction,
    });
    if (primaryOverall) overallObservations.push(primaryOverall);
    if (primaryOverall && repeatOverall) {
      overallRepeats.push({ first: primaryOverall, second: repeatOverall });
    }
    repeats.push(
      ...matchingRepeatPairs({
        row,
        primary,
        repeatPrediction: repeatRun.prediction,
      }),
    );
  }

  const safety = await loadOperationalEvidence({
    client,
    graderVersion,
    corpusVersion,
    environment,
    deploymentId,
    imageDigest,
  });
  const safetyFresh =
    safety !== null && new Date(safety.expiresAt).getTime() > Date.now();
  const invalidAuthoritativeCitationCount =
    safety?.scenarios.reduce(
      (sum, scenario) => sum + scenario.invalidAuthoritativeCitationCount,
      0,
    ) ?? 0;
  const duplicatePaidScoringCount =
    safety?.scenarios.reduce(
      (sum, scenario) =>
        sum +
        Math.max(
          0,
          scenario.observedProviderCalls - scenario.expectedProviderCalls,
        ),
      0,
    ) ?? 0;
  const strandedWorkflowCount =
    safety && safetyFresh
      ? await countStrandedCohortRuns({ client, safety })
      : 1;
  const base = evaluateDerivedReleaseGate({
    observations,
    overallObservations,
    coverage,
    expectedEvaluationCount: benchmarkRows.length,
    schemaValidPredictionCount,
    repeatPairs: repeats,
    overallRepeatPairs: overallRepeats,
    expectedRepeatPairCount: observations.length,
    expectedOverallRepeatPairCount: overallObservations.length,
    invalidAuthoritativeCitationCount,
    duplicatePaidScoringCount,
    strandedWorkflowCount,
    invalidBenchmarkLabelCount: countInvalidStoredBenchmarkRows(
      benchmarkRows.map(storedReleaseBenchmark),
    ),
  });
  const result: ReleaseGateResult = safetyFresh
    ? base
    : {
        passed: false,
        failures: [
          ...base.failures,
          "operational_safety_evidence_missing_stale_or_inconsistent",
        ],
      };
  const metrics = evaluateBenchmark(observations);
  const overallMetrics = evaluateBenchmark(overallObservations);
  process.stdout.write(
    `${JSON.stringify(
      {
        graderVersion,
        corpusVersion,
        metrics,
        overallMetrics,
        coverage: {
          passed: coverage.passed,
          requiredCellCount: coverage.requiredCellCount,
          coveredCellCount: coverage.coveredCellCount,
          missingCellCount: coverage.missingCells.length,
          underfilledCellCount: coverage.underfilledCells.length,
          unknownCriteria: coverage.unknownCriteria,
          unknownTaskTypes: coverage.unknownTaskTypes,
        },
        evaluationCount: benchmarkRows.length,
        schemaValidPredictionCount,
        repeatPairCount: repeats.length,
        overallRepeatPairCount: overallRepeats.length,
        ...result,
      },
      null,
      2,
    )}\n`,
  );
  if (!result.passed) process.exitCode = 1;
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
