import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const migration = readFileSync(
  fileURLToPath(
    new URL(
      "../../../../../supabase/migrations/20260830070000_chat_product_context.sql",
      import.meta.url,
    ),
  ),
  "utf8",
);

test("conversation product identity is immutable and IELTS contexts are explicit", () => {
  assert.match(migration, /Coach conversation context is immutable/);
  assert.match(
    migration,
    /before insert or update of product_context, context_type, context_id, initial_request_id/,
  );
  assert.match(migration, /IELTS conversations require an explicit IELTS context type/);
  assert.match(migration, /Entity-scoped IELTS coach contexts are not supported yet/);
  assert.doesNotMatch(
    migration.match(/do \$\$[\s\S]*?\$\$;/)?.[0] ?? "",
    /\btg_op\b|\bold\.|\bnew\./i,
  );
});

test("coach turn claims are content-bound, bounded and fenced", () => {
  assert.match(migration, /request_hash text not null/);
  assert.match(migration, /v_turn\.request_hash <> p_request_hash/);
  assert.match(migration, /attempt_count between 0 and 2/);
  assert.match(migration, /if v_turn\.attempt_count >= 2/);
  assert.match(migration, /claim_token = gen_random_uuid\(\)/);
  assert.match(migration, /t\.claim_token = p_claim_token/);
  assert.match(migration, /t\.attempt_count = p_attempt_count/);
  assert.match(migration, /and claim_token = p_claim_token/);
  assert.match(migration, /and attempt_count = p_attempt_count/);
});

test("raw coach ledger is not directly readable by authenticated clients", () => {
  assert.match(
    migration,
    /revoke all on table public\.ai_coach_turns from public, anon, authenticated/,
  );
  assert.doesNotMatch(
    migration,
    /grant select on table public\.ai_coach_turns to authenticated/,
  );
});

test("only the trusted server can persist IELTS assistant metadata", () => {
  assert.match(
    migration,
    /create policy "Users can insert own Debate messages"[\s\S]*c\.product_context = 'debate'/,
  );
  assert.match(migration, /Trusted server role required/);
  assert.match(
    migration,
    /revoke all on function public\.complete_ai_coach_turn\([\s\S]*from public, anon, authenticated/,
  );
  assert.match(
    migration,
    /grant execute on function public\.complete_ai_coach_turn\([\s\S]*to service_role/,
  );
  assert.doesNotMatch(
    migration,
    /grant execute on function public\.complete_ai_coach_turn\([^;]+to authenticated/,
  );
});
