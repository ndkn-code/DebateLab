import assert from "node:assert/strict";
import { test } from "node:test";
import { createQuestionImportBrowserAdapter } from "./browser-adapter";

type Call = { name: string; args: Record<string, unknown> };

function fakeDb(calls: Call[], uploadCalls: string[] = []) {
  const rows = {
    batch: { data: { status: "review" }, error: null },
    drafts: { data: [], error: null },
    keys: { data: [], error: null },
  };
  const chain = (value: unknown) => {
    const builder = {
      select: () => builder,
      eq: () => builder,
      in: () => builder,
      order: () => builder,
      single: async () => value,
    };
    return builder;
  };
  return {
    auth: { getUser: async () => ({ data: { user: { id: "user-1" } } }) },
    storage: {
      from: () => ({
        uploadToSignedUrl: async (...args: unknown[]) => {
          uploadCalls.push(String(args[0]));
          return { data: {}, error: null };
        },
      }),
    },
    from: (table: string) =>
      table === "question_import_batches"
        ? chain(rows.batch)
        : table === "question_import_draft_items"
          ? chain(rows.drafts)
          : chain(rows.keys),
    rpc: async (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args });
      if (name === "create_question_import_batch")
        return { data: "batch-1", error: null };
      return { data: null, error: null };
    },
  };
}

function adapterWith(calls: Call[], fetchImpl: typeof fetch = fetch) {
  return createQuestionImportBrowserAdapter({
    clubId: "club-1",
    locale: "en",
    db: fakeDb(calls) as never,
    fetchImpl,
  });
}

test("saves objective answers as an envelope in draft, confirm, accepted order", async () => {
  const calls: Call[] = [];
  await adapterWith(calls).save(
    {
      id: "q-1",
      type: "mcq_single",
      prompt: "Q",
      page: 1,
      answer: '["A","B"]',
      payload: { question_type: "mcq_single" },
    },
    true,
  );
  assert.deepEqual(
    calls.map((call) => call.name),
    [
      "save_question_import_draft",
      "confirm_question_import_answer",
      "save_question_import_draft",
    ],
  );
  assert.deepEqual(calls[1]?.args.p_answer_payload, { answer: ["A", "B"] });
  assert.equal(calls[0]?.args.p_status, "draft");
  assert.equal(calls[2]?.args.p_status, "accepted");
});

test("does not expose subjective answer keys to confirmation RPC", async () => {
  const calls: Call[] = [];
  await adapterWith(calls).save(
    {
      id: "q-2",
      type: "writing_task2_essay",
      prompt: "Q",
      page: 1,
      answer: "essay",
      payload: { question_type: "writing_task2_essay" },
    },
    true,
  );
  assert.deepEqual(
    calls.map((call) => call.name),
    ["save_question_import_draft"],
  );
  assert.equal(calls[0]?.args.p_status, "accepted");
});

test("persists rejection as a reviewed rejected state", async () => {
  const calls: Call[] = [];
  await adapterWith(calls).save(
    {
      id: "q-3",
      type: "mcq_single",
      prompt: "Q",
      page: 1,
      answer: "A",
      payload: { question_type: "mcq_single" },
    },
    false,
  );
  assert.equal(calls[0]?.name, "save_question_import_draft");
  assert.equal(calls[0]?.args.p_status, "rejected");
});

test("registers every upload before finalizing, with audio finalized first", async () => {
  const calls: Call[] = [];
  const order: string[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input);
    if (url.endsWith("/ingest")) {
      order.push(
        `ingest:${String((JSON.parse(String(init?.body)) as { mimeType: string }).mimeType)}`,
      );
      return new Response(
        JSON.stringify({
          versionId: "v-1",
          upload: { bucket: "b", path: "p", token: "t" },
        }),
        { status: 200 },
      );
    }
    order.push("finalize");
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };
  const db = fakeDb(calls);
  const adapter = createQuestionImportBrowserAdapter({
    clubId: "club-1",
    locale: "en",
    db: db as never,
    fetchImpl,
  });
  await adapter.prepare({
    files: [new File(["pdf"], "a.pdf", { type: "application/pdf" })],
    audio: new File(["audio"], "a.mp3", { type: "audio/mpeg" }),
    rightsAccepted: true,
  });
  assert.deepEqual(order, [
    "ingest:application/pdf",
    "ingest:audio/mpeg",
    "finalize",
    "finalize",
  ]);
});

test("queued replay with no signed upload skips storage and retry sends version identity", async () => {
  const calls: Call[] = [];
  const requests: Array<{ url: string; body: Record<string, unknown> }> = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input);
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    requests.push({ url, body });
    if (url.endsWith("/ingest"))
      return new Response(
        JSON.stringify({ versionId: "version-1", upload: null }),
        { status: 200 },
      );
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };
  const uploads: string[] = [];
  const db = fakeDb(calls, uploads);
  const adapter = createQuestionImportBrowserAdapter({
    clubId: "club-1",
    locale: "en",
    db: db as never,
    fetchImpl,
  });
  await adapter.prepare({
    files: [new File(["pdf"], "a.pdf", { type: "application/pdf" })],
    audio: null,
    rightsAccepted: true,
  });
  assert.deepEqual(uploads, []);
  const retry = (
    adapter as unknown as {
      retryDocumentVersion: (
        materialId: string,
        versionId: string,
      ) => Promise<unknown>;
    }
  ).retryDocumentVersion;
  await retry.call(adapter, "material-1", "version-1");
  assert.match(requests.at(-1)?.url ?? "", /materials\/material-1\/retry$/);
  assert.equal(requests.at(-1)?.body.versionId, "version-1");
});

test("publication replay recovers the collection from its durable receipt", async () => {
  const calls: Call[] = [];
  const db = fakeDb(calls);
  db.from = ((table: string) => {
    assert.equal(table, "question_import_publication_receipts");
    const builder = {
      select: () => builder,
      eq: () => builder,
      maybeSingle: async () => ({ data: { collection_id: "existing-collection" }, error: null }),
    };
    return builder;
  }) as unknown as typeof db.from;
  for (let reload = 0; reload < 2; reload++) {
    const adapter = createQuestionImportBrowserAdapter({ clubId: "club-1", locale: "en", db: db as never });
    adapter.selectBatch("batch-1");
    await adapter.publish(["q-2", "q-1"]);
  }
  assert.deepEqual(calls.map((call) => call.name), ["publish_question_import_items", "publish_question_import_items"]);
  assert.equal(calls[0]?.args.p_collection_id, "existing-collection");
  assert.equal(calls[0]?.args.p_idempotency_key, calls[1]?.args.p_idempotency_key);
});

test("lost upload response recovers a duplicate object through checksum finalization", async () => {
  const calls: Call[] = [];
  const requests: Array<{ url: string; body: Record<string, unknown> }> = [];
  const db = fakeDb(calls);
  db.storage.from = (() => ({ uploadToSignedUrl: async () => ({ data: null, error: { statusCode: "409", message: "Already exists" } }) })) as unknown as typeof db.storage.from;
  const adapter = createQuestionImportBrowserAdapter({
    clubId: "club-1", locale: "en", db: db as never,
    fetchImpl: async (input, init) => {
      requests.push({ url: String(input), body: JSON.parse(String(init?.body)) });
      return new Response(JSON.stringify(String(input).endsWith("/ingest")
        ? { versionId: "v-1", upload: { bucket: "b", path: "p", token: "t" } } : { ok: true }));
    },
  });
  await adapter.prepare({ files: [new File(["pdf"], "a.pdf", { type: "application/pdf" })], audio: null, rightsAccepted: true });
  assert.match(requests.at(-1)?.url ?? "", /\/finalize$/);
  assert.match(String(requests.at(-1)?.body.sha256), /^[0-9a-f]{64}$/);
});
