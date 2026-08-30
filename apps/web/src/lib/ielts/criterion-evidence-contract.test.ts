import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { resolve } from "node:path";
import { normalizeSpeakingScore } from "@/lib/scoring/ielts-speaking/normalize";
import { normalizeWritingScore } from "@/lib/scoring/ielts-writing/normalize";
import {
  buildSpeakingCriterionEvidence,
  buildWritingCriterionEvidence,
  IeltsCriterionEvidenceSchema,
} from "./criterion-evidence-contract";

const context = {
  stage: "provisional" as const,
  gradingVersion: "provisional-v1",
  traceId: "trace-1",
  runId: "run-1",
  provider: "groq",
  model: "test-model",
};

function writingOutput() {
  return {
    criteria: {
      taskResponse: { band: 6.2, rationale: "TR rationale" },
      coherenceCohesion: { band: 6.4, rationale: "CC rationale" },
      lexicalResource: { band: 6.5, rationale: "LR rationale" },
      grammaticalRangeAccuracy: { band: 6.6, rationale: "GRA rationale" },
    },
    overallSummary: "summary",
    inlineCorrections: [],
    paragraphFeedback: [],
    modelAnswer: "model answer",
  } as const;
}

function speakingOutput() {
  return {
    criteria: {
      fluencyCoherence: { band: 6.2, rationale: "FC rationale" },
      lexicalResource: { band: 6.4, rationale: "LR rationale" },
      grammaticalRangeAccuracy: { band: 6.5, rationale: "GRA rationale" },
      pronunciation: { band: 6.6, rationale: "Pron rationale" },
    },
    overallSummary: "summary",
    strengths: [],
    improvements: [],
    excerptFeedback: [],
  } as const;
}

test("writing evidence emits the four normalized half-band criteria", () => {
  const evidence = buildWritingCriterionEvidence({
    score: normalizeWritingScore(writingOutput()),
    context,
  });
  assert.deepEqual(
    evidence.map((item) => item.criterion),
    [
      "taskResponse",
      "coherenceCohesion",
      "lexicalResource",
      "grammaticalRangeAccuracy",
    ],
  );
  assert.deepEqual(
    evidence.map((item) => item.band),
    [6, 6.5, 6.5, 6.5],
  );
  assert.equal(
    evidence.every((item) => item.stage === "provisional"),
    true,
  );
});

test("speaking evidence emits the four normalized half-band criteria", () => {
  const evidence = buildSpeakingCriterionEvidence({
    score: normalizeSpeakingScore(speakingOutput()),
    context,
  });
  assert.deepEqual(
    evidence.map((item) => item.criterion),
    [
      "fluencyCoherence",
      "lexicalResource",
      "grammaticalRangeAccuracy",
      "pronunciation",
    ],
  );
  assert.deepEqual(
    evidence.map((item) => item.band),
    [6, 6.5, 6.5, 6.5],
  );
});

test("criterion contract rejects non-half bands and cross-skill criteria", () => {
  assert.equal(
    IeltsCriterionEvidenceSchema.safeParse({
      ...context,
      skill: "writing",
      criterion: "taskResponse",
      band: 6.25,
      rationale: "x",
    }).success,
    false,
  );
  assert.equal(
    IeltsCriterionEvidenceSchema.safeParse({
      ...context,
      skill: "writing",
      criterion: "pronunciation",
      band: 6.5,
      rationale: "x",
    }).success,
    false,
  );
});

test("criterion evidence migration is private, immutable, and admits IELTS telemetry", () => {
  const migration = readFileSync(
    resolve(
      process.cwd(),
      "../../supabase/migrations/20260829200000_ielts_criterion_evidence.sql",
    ),
    "utf8",
  );
  assert.match(
    migration,
    /grant select, insert on table public\.ielts_criterion_evidence to service_role/,
  );
  assert.doesNotMatch(migration, /grant select[^;]*to authenticated/);
  assert.match(
    migration,
    /before update or delete[\s\S]*reject_ielts_criterion_evidence_mutation/,
  );
  assert.match(
    migration,
    /unique \(response_id, revision, run_id, stage, criterion\)/,
  );
  assert.match(migration, /'ielts_writing_score_adjudication'/);
  assert.match(migration, /'ielts_speaking_score_adjudication'/);
});
