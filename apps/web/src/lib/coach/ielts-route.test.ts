import assert from "node:assert/strict";
import test from "node:test";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import {
  handleIeltsCoachRequest,
  type IeltsCoachApiRequest,
} from "./ielts-route";
import { IeltsCoachRuntimeError, runIeltsCoachTurn } from "./ielts-runtime";

const USER_ID = "00000000-0000-4000-8000-000000000001";
const CONVERSATION_ID = "00000000-0000-4000-8000-000000000002";
const REQUEST_ID = "00000000-0000-4000-8000-000000000003";
const TURN_ID = "00000000-0000-4000-8000-000000000004";
const CLAIM_TOKEN = "00000000-0000-4000-8000-000000000005";
const ASSISTANT_ID = "00000000-0000-4000-8000-000000000006";

const REQUEST: IeltsCoachApiRequest = {
  message: "What should I practise next?",
  conversationId: CONVERSATION_ID,
  requestId: REQUEST_ID,
  contextType: "ielts-coach",
  locale: "en",
  googleAiConsent: false,
};

const OUTPUT = {
  contractVersion: "ielts-coach.v1" as const,
  product: "ielts" as const,
  outcome: "needs_evidence" as const,
  locale: "en" as const,
  diagnosis: {
    summary: "Complete one IELTS diagnostic first.",
    skill: "writing" as const,
    criteria: ["task_response" as const],
  },
  learnerEvidenceUsed: [],
  bandCriterionGap: {
    criterion: "task_response" as const,
    current: null,
    targetBand: null,
    gapBands: null,
    explanation: "No authorized score is available yet.",
  },
  recommendedTask: {
    taskId: "ielts-study-plan",
    title: "Open your IELTS study plan",
    instructions: "Complete the first assigned diagnostic.",
    whyItHelps: "It creates evidence for a specific recommendation.",
    expectedSignal: "authorized_ielts_task_completed",
  },
  confidence: {
    level: "low" as const,
    value: 0.2,
    limitations: ["No authorized score evidence was used."],
  },
  sources: [],
  scoreAuthority: {
    effective: null,
    learnerLabel: null,
    isOfficialTestResult: false as const,
  },
  action: {
    kind: "open_study_plan" as const,
    resourceId: "ielts-study-plan",
    skill: "writing" as const,
    criterion: "task_response" as const,
    label: "Open plan",
  },
};

class FakeQuery {
  constructor(
    private readonly table: string,
    private readonly product: "ielts" | "debate",
  ) {}
  select() {
    return this;
  }
  eq() {
    return this;
  }
  order() {
    return this;
  }
  async maybeSingle() {
    return {
      data:
        this.table === "chat_conversations"
          ? {
              id: CONVERSATION_ID,
              product_context: this.product,
              context_type:
                this.product === "ielts" ? "ielts-coach" : "coach-home",
              context_id: null,
            }
          : null,
      error: null,
    };
  }
  async limit() {
    return { data: [], error: null };
  }
}

function fakeSupabase(options?: {
  product?: "ielts" | "debate";
  timeout?: boolean;
}) {
  let completed = false;
  let storedRequestHash: unknown;
  const rpcCalls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const client = {
    from(table: string) {
      return new FakeQuery(table, options?.product ?? "ielts");
    },
    async rpc(name: string, args: Record<string, unknown>) {
      rpcCalls.push({ name, args });
      if (name === "claim_ai_coach_turn") {
        if (
          storedRequestHash !== undefined &&
          storedRequestHash !== args.p_request_hash
        ) {
          return {
            data: null,
            error: { message: "Coach request identity mismatch" },
          };
        }
        storedRequestHash = args.p_request_hash;
        return completed
          ? {
              data: {
                outcome: "completed",
                turnId: TURN_ID,
                responseText: "Cached response",
                responseMetadata: { productContext: "ielts" },
                assistantMessageId: ASSISTANT_ID,
                attemptCount: 1,
              },
              error: null,
            }
          : {
              data: {
                outcome: "claimed",
                turnId: TURN_ID,
                attemptCount: 1,
                claimToken: CLAIM_TOKEN,
              },
              error: null,
            };
      }
      if (name === "complete_ai_coach_turn") {
        completed = true;
        return {
          data: { assistantMessageId: ASSISTANT_ID },
          error: null,
        };
      }
      return { data: null, error: null };
    },
  };
  return {
    supabase: client as unknown as SupabaseClient<Database>,
    rpcCalls,
  };
}

test("duplicate request reuses the completed result without a second generation", async () => {
  const fake = fakeSupabase();
  let generations = 0;
  let observedConsent: boolean | undefined;
  const runTurn: typeof runIeltsCoachTurn = async (params) => {
    generations += 1;
    observedConsent = params.googleAiConsent;
    return {
      output: OUTPUT,
      text: "First response",
      provider: "groq",
      model: "fast-model",
      traceId: REQUEST_ID,
      fallbackUsed: false,
      latencyMs: 25,
      promptVersion: "ielts-coach-prompt.v1" as const,
      rubricVersion: "rubric-v1",
      knowledgeEvidence: [],
    };
  };

  const first = await handleIeltsCoachRequest({
    supabase: fake.supabase,
    trustedSupabase: fake.supabase,
    userId: USER_ID,
    request: REQUEST,
    dependencies: { runTurn, capture: () => undefined },
  });
  assert.equal(first.status, 200);
  const second = await handleIeltsCoachRequest({
    supabase: fake.supabase,
    trustedSupabase: fake.supabase,
    userId: USER_ID,
    request: REQUEST,
    dependencies: { runTurn, capture: () => undefined },
  });
  assert.equal(second.status, 200);
  assert.match(await second.text(), /Cached response/);
  assert.equal(generations, 1);
  assert.equal(observedConsent, false);
  const claims = fake.rpcCalls.filter(
    (call) => call.name === "claim_ai_coach_turn",
  );
  assert.equal(claims.length, 2);
  assert.equal(claims[0]?.args.p_request_hash, claims[1]?.args.p_request_hash);
  assert.equal(
    fake.rpcCalls.find((call) => call.name === "complete_ai_coach_turn")?.args
      .p_claim_token,
    CLAIM_TOKEN,
  );
});

test("conversation product mismatch fails before claim or generation", async () => {
  const fake = fakeSupabase({ product: "debate" });
  let generations = 0;
  const response = await handleIeltsCoachRequest({
    supabase: fake.supabase,
    trustedSupabase: fake.supabase,
    userId: USER_ID,
    request: REQUEST,
    dependencies: {
      runTurn: async () => {
        generations += 1;
        throw new Error("must not run");
      },
      capture: () => undefined,
    },
  });
  assert.equal(response.status, 409);
  assert.equal(generations, 0);
  assert.equal(fake.rpcCalls.length, 0);
});

test("reusing a request id for different content fails closed", async () => {
  const fake = fakeSupabase();
  let generations = 0;
  const runTurn = async () => {
    generations += 1;
    return {
      output: OUTPUT,
      text: "First response",
      provider: "groq",
      model: "fast-model",
      traceId: REQUEST_ID,
      fallbackUsed: false,
      latencyMs: 25,
      promptVersion: "ielts-coach-prompt.v1" as const,
      rubricVersion: "rubric-v1",
      knowledgeEvidence: [],
    };
  };
  await handleIeltsCoachRequest({
    supabase: fake.supabase,
    trustedSupabase: fake.supabase,
    userId: USER_ID,
    request: REQUEST,
    dependencies: { runTurn, capture: () => undefined },
  });
  const conflict = await handleIeltsCoachRequest({
    supabase: fake.supabase,
    trustedSupabase: fake.supabase,
    userId: USER_ID,
    request: { ...REQUEST, message: "A different question" },
    dependencies: { runTurn, capture: () => undefined },
  });
  assert.equal(conflict.status, 409);
  const body = await conflict.json();
  assert.equal(body.code, "IELTS_COACH_CONTEXT_BLOCKED");
  assert.equal(body.manualRetry.allowed, false);
  assert.equal(generations, 1);
});

test("provider timeout returns a safe bounded manual retry", async () => {
  const fake = fakeSupabase({ timeout: true });
  const response = await handleIeltsCoachRequest({
    supabase: fake.supabase,
    trustedSupabase: fake.supabase,
    userId: USER_ID,
    request: REQUEST,
    dependencies: {
      runTurn: async () => {
        throw new IeltsCoachRuntimeError("IELTS_COACH_TIMEOUT", true);
      },
      capture: () => undefined,
    },
  });
  assert.equal(response.status, 503);
  const body = await response.json();
  assert.equal(body.code, "IELTS_COACH_TIMEOUT");
  assert.equal(body.manualRetry.allowed, true);
  assert.equal(body.manualRetry.idempotencyKey, REQUEST_ID);
  assert.equal("provider" in body, false);
  const failure = fake.rpcCalls.find(
    (call) => call.name === "fail_ai_coach_turn",
  );
  assert.equal(failure?.args.p_claim_token, CLAIM_TOKEN);
  assert.equal(failure?.args.p_attempt_count, 1);
});
