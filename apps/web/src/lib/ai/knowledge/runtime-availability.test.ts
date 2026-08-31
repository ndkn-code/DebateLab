import assert from "node:assert/strict";
import { test } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";

import { searchGenericKnowledge } from "./runtime";

function fakeKnowledgeClient(approvedCount: number) {
  const client = {
    from(table: string) {
      const builder: Record<string, unknown> = {};
      builder.select = () => builder;
      builder.eq = () => builder;
      builder.insert = () => builder;
      builder.limit = () =>
        Promise.resolve({ data: null, error: null, count: approvedCount });
      builder.maybeSingle = () =>
        Promise.resolve({
          data:
            table === "ai_knowledge_collections"
              ? { id: "collection-1", active_version: 1 }
              : { id: "retrieval-log-1" },
          error: null,
        });
      return builder;
    },
    rpc() {
      return Promise.resolve({ data: [], error: null });
    },
  };
  return client as unknown as SupabaseClient;
}

function request(supabase: SupabaseClient) {
  return searchGenericKnowledge({
    collection: "ielts.writing",
    query: "How can I improve task response?",
    purpose: "coaching",
    language: "en",
    sourceRoute: "runtime-availability-test",
    supabase,
  });
}

test("an empty active collection skips Voyage and uses the local fallback path", async () => {
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = (async () => {
    fetchCalls += 1;
    throw new Error("Voyage should not be called");
  }) as typeof fetch;
  try {
    const result = await request(fakeKnowledgeClient(0));
    assert.equal(result.skippedReason, "no_approved_knowledge");
    assert.equal(result.evidence.length, 0);
    assert.equal(fetchCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("parallel rubric and exemplar retrieval shares one query embedding", async () => {
  const originalFetch = globalThis.fetch;
  const originalVoyageKey = process.env.VOYAGE_API_KEY;
  let fetchCalls = 0;
  process.env.VOYAGE_API_KEY = "test-voyage-key";
  globalThis.fetch = (async () => {
    fetchCalls += 1;
    return new Response(
      JSON.stringify({
        data: [{ index: 0, embedding: Array.from({ length: 1024 }, () => 0) }],
        usage: { total_tokens: 8 },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }) as typeof fetch;
  try {
    const client = fakeKnowledgeClient(1);
    const [first, second] = await Promise.all([
      request(client),
      request(client),
    ]);
    assert.equal(first.skippedReason, "no_approved_knowledge");
    assert.equal(second.skippedReason, "no_approved_knowledge");
    assert.equal(fetchCalls, 1);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalVoyageKey === undefined) delete process.env.VOYAGE_API_KEY;
    else process.env.VOYAGE_API_KEY = originalVoyageKey;
  }
});
