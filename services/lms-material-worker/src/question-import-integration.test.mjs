import test from "node:test";
import assert from "node:assert/strict";
import { processQuestionImportVersion } from "./question-import.mjs";

function query(data, updates = []) {
  const result = { data, error: null };
  const chain = {
    select() { return chain; },
    update(payload) { updates.push(payload); result.data = data; return chain; },
    eq() { return chain; },
    in() { return chain; },
    maybeSingle() { return Promise.resolve(result); },
    then(resolve, reject) { return Promise.resolve(result).then(resolve, reject); },
  };
  return chain;
}

function fakeSupabase({ material, document, batch, media, updates = [], rpcs = [] } = {}) {
  return {
    from(table) {
      if (table === "lms_materials") return query(material, updates);
      if (table === "question_import_documents") return query(document, updates);
      if (table === "question_import_batches") return query(batch, updates);
      if (table === "question_import_batch_documents") return query(media, updates);
      return query(null, updates);
    },
    rpc(name, args) { rpcs.push({ name, args }); return Promise.resolve({ data: 1, error: null }); },
    storage: { from() { return { createSignedUrl: async () => ({ data: { signedUrl: "https://source.test/file.pdf" }, error: null }) }; } },
  };
}

const base = {
  version: { id: "v1", material_id: "m1", source_mime_type: "application/pdf", original_path: "m1/v1.pdf", source_file_name: "source.pdf" },
  material: { id: "m1", club_id: "c1" },
  batch: { id: "b1", club_id: "c1", status: "processing" },
  document: { id: "d1", batch_id: "b1", club_id: "c1", material_id: "m1", material_version_id: "v1", provider_job_id: "job-1", provider_status: "pending", status: "parsing", page_count: 1 },
};

test("ambiguous submission marker refuses a second POST", async () => {
  const supabase = fakeSupabase({ ...base, document: { ...base.document, provider_job_id: null, provider_status: "ambiguous_submit" } });
  let submits = 0;
  await assert.rejects(() => processQuestionImportVersion({ supabase, version: base.version, inspect: async () => ({ pages: 1, scanned: false }), parse: { submit: async () => { submits += 1; return { id: "never" }; }, get: async () => ({}) } }), /LLAMAPARSE_SUBMIT_AMBIGUOUS/);
  assert.equal(submits, 0);
});

test("ready document replays without provider or quota calls", async () => {
  const rpcs = [];
  const supabase = fakeSupabase({ ...base, document: { ...base.document, status: "ready", provider_status: "completed" }, rpcs });
  let submits = 0;
  const result = await processQuestionImportVersion({ supabase, version: base.version, parse: { submit: async () => { submits += 1; }, get: async () => ({}) } });
  assert.equal(result.status, "ready");
  assert.equal(submits, 0);
  assert.equal(rpcs.length, 0);
});

test("stored material, version, and club bindings are enforced", async () => {
  const supabase = fakeSupabase({ ...base, document: { ...base.document, material_id: "attacker-material" } });
  await assert.rejects(() => processQuestionImportVersion({ supabase, version: base.version, parse: {} }), /binding is invalid/);
});

test("audio requires the bound media material", async () => {
  const supabase = fakeSupabase({ material: base.material, media: { id: "d1", batch_id: "b1", club_id: "c1", media_material_id: "other", media_version_id: "audio-v1", status: "pending" }, batch: base.batch });
  await assert.rejects(() => processQuestionImportVersion({ supabase, version: { ...base.version, id: "audio-v1", source_mime_type: "audio/mpeg" } }), /AUDIO_BINDING_INVALID/);
});

test("successful provider result persists usage before extraction", async () => {
  const updates = [];
  const rpcs = [];
  const supabase = fakeSupabase({ ...base, document: { ...base.document, provider_job_id: null }, updates, rpcs });
  const oldFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(8) });
  try {
    const result = await processQuestionImportVersion({ supabase, version: base.version, inspect: async () => ({ pages: 1, scanned: true }), parse: { submit: async () => ({ id: "job-2", status: "completed", items: [{ question_type: "mcq_single", prompt: "Choose", answer: "A" }], usage: { credits: 2 } }), get: async () => ({}) } });
    assert.equal(result.providerJobId, "job-2");
    assert.equal(updates.some((value) => value.provider_usage?.credits === 2), true);
    assert.equal(rpcs.some((value) => value.name === "persist_question_import_result"), true);
  } finally { globalThis.fetch = oldFetch; }
});

test("pending provider job is retried by durable id without POST", async () => {
  const supabase = fakeSupabase({ ...base, document: { ...base.document, provider_status: "pending" } });
  let submits = 0;
  let gets = 0;
  const oldFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(8) });
  try { await assert.rejects(() => processQuestionImportVersion({ supabase, version: base.version, inspect: async () => ({ pages: 1, scanned: false }), sleep: async () => {}, parse: { submit: async () => { submits += 1; }, get: async (id) => { gets += 1; return { id, status: "pending" }; } } }), /LLAMAPARSE_PENDING/); } finally { globalThis.fetch = oldFetch; }
  assert.equal(submits, 0);
  assert.equal(gets > 0, true);
});
