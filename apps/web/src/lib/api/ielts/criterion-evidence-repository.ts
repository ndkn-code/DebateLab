import "server-only";
import type { Json, Tables } from "@/types/supabase";
import type { IeltsDbClient } from "./client";
import {
  IeltsCriterionEvidenceSchema,
  type IeltsCriterionEvidenceContract,
} from "@/lib/ielts/criterion-evidence-contract";

type ResponseIdentity = Pick<
  Tables<"writing_responses">,
  "id" | "attempt_id" | "user_id" | "question_id" | "revision"
>;
type SpeakingResponseIdentity = Pick<
  Tables<"speaking_responses">,
  "id" | "attempt_id" | "user_id" | "question_id" | "revision"
>;
type CriterionEvidenceInsert = {
  user_id: string;
  attempt_id: string;
  question_id: string;
  response_id: string;
  writing_response_id: string | null;
  speaking_response_id: string | null;
  skill: "writing" | "speaking";
  revision: number;
  criterion: string;
  stage: "provisional" | "adjudicated";
  band: number;
  rationale: string;
  grading_version: string;
  trace_id: string;
  run_id: string;
  provider: string;
  model: string;
  metadata: Json;
};
type CriterionEvidenceClient = {
  from(table: "ielts_criterion_evidence"): {
    upsert(
      rows: CriterionEvidenceInsert[],
      options: { onConflict: string; ignoreDuplicates: boolean },
    ): PromiseLike<{ error: { message: string } | null }>;
  };
};
function toJson(value: unknown): Json {
  return value as Json;
}
function evidenceInsert(
  identity: ResponseIdentity | SpeakingResponseIdentity,
  evidence: IeltsCriterionEvidenceContract,
): CriterionEvidenceInsert {
  return {
    user_id: identity.user_id,
    attempt_id: identity.attempt_id,
    question_id: identity.question_id,
    response_id: identity.id,
    writing_response_id: evidence.skill === "writing" ? identity.id : null,
    speaking_response_id: evidence.skill === "speaking" ? identity.id : null,
    skill: evidence.skill,
    revision: identity.revision,
    criterion: evidence.criterion,
    stage: evidence.stage,
    band: evidence.band,
    rationale: evidence.rationale,
    grading_version: evidence.gradingVersion,
    trace_id: evidence.traceId,
    run_id: evidence.runId,
    provider: evidence.provider,
    model: evidence.model,
    metadata: toJson({ contractVersion: evidence.gradingVersion }),
  };
}

export async function recordIeltsWritingCriterionEvidence(params: {
  client: IeltsDbClient;
  writingResponseId: string;
  evidence: IeltsCriterionEvidenceContract[];
}): Promise<void> {
  const { data: identity, error } = await params.client
    .from("writing_responses")
    .select("id, attempt_id, user_id, question_id, revision")
    .eq("id", params.writingResponseId)
    .maybeSingle();
  if (error)
    throw new Error(
      `recordWritingCriterionEvidence(identity): ${error.message}`,
    );
  if (!identity || params.evidence.length === 0) return;
  const rows = params.evidence.map((item) => {
    const parsed = IeltsCriterionEvidenceSchema.parse(item);
    if (parsed.skill !== "writing")
      throw new Error("Writing response cannot receive speaking evidence");
    return evidenceInsert(identity, parsed);
  });
  // The generated Supabase types intentionally land in the integration branch
  // with this migration; keep this temporary cast narrow until regeneration.
  const { error: insertError } = await (
    params.client as unknown as CriterionEvidenceClient
  )
    .from("ielts_criterion_evidence")
    .upsert(rows, {
      onConflict: "response_id,revision,run_id,stage,criterion",
      ignoreDuplicates: true,
    });
  if (insertError)
    throw new Error(
      `recordWritingCriterionEvidence(insert): ${insertError.message}`,
    );
}

export async function recordIeltsSpeakingCriterionEvidence(params: {
  client: IeltsDbClient;
  speakingResponseId: string;
  evidence: IeltsCriterionEvidenceContract[];
}): Promise<void> {
  const { data: identity, error } = await params.client
    .from("speaking_responses")
    .select("id, attempt_id, user_id, question_id, revision")
    .eq("id", params.speakingResponseId)
    .maybeSingle();
  if (error)
    throw new Error(
      `recordSpeakingCriterionEvidence(identity): ${error.message}`,
    );
  if (!identity || params.evidence.length === 0) return;
  const rows = params.evidence.map((item) => {
    const parsed = IeltsCriterionEvidenceSchema.parse(item);
    if (parsed.skill !== "speaking")
      throw new Error("Speaking response cannot receive writing evidence");
    return evidenceInsert(identity, parsed);
  });
  const { error: insertError } = await (
    params.client as unknown as CriterionEvidenceClient
  )
    .from("ielts_criterion_evidence")
    .upsert(rows, {
      onConflict: "response_id,revision,run_id,stage,criterion",
      ignoreDuplicates: true,
    });
  if (insertError)
    throw new Error(
      `recordSpeakingCriterionEvidence(insert): ${insertError.message}`,
    );
}
