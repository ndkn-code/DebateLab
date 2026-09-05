import test from "node:test";
import assert from "node:assert/strict";
import { assertQuestionImportBinding, inspectPdfBytes, processQuestionImport, questionCandidates } from "./question-import.mjs";
import { createLlamaParseAdapter } from "./llamaparse.mjs";

function pdfBytes(texts) {
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>", `<< /Type /Pages /Kids [${texts.map((_, i) => `${3 + i * 2} 0 R`).join(" ")}] /Count ${texts.length} >>`];
  for (let i = 0; i < texts.length; i += 1) {
    const content = texts[i] ? `BT /F1 12 Tf 72 72 Td (${texts[i]}) Tj ET` : "";
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${3 + texts.length * 2} 0 R >> >> /Contents ${4 + i * 2} 0 R >>`);
    objects.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  }
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  let output = "%PDF-1.4\n";
  const offsets = [0];
  for (let i = 0; i < objects.length; i += 1) { offsets.push(output.length); output += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`; }
  const xref = output.length;
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n `).join("\n")}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(output);
}

test("rejects non-PDF and encrypted sources before provider work", async () => {
  await assert.rejects(() => inspectPdfBytes(new Uint8Array([1, 2, 3])), /empty or corrupt/);
  const encrypted = new Uint8Array([...new TextEncoder().encode("%PDF-1.7\n"), ...new TextEncoder().encode("/Encrypt")]);
  await assert.rejects(() => inspectPdfBytes(encrypted), /Encrypted/);
});

test("inspects valid text, scanned blank, and oversized PDFs", async () => {
  const text = await inspectPdfBytes(pdfBytes(["Original IELTS passage"]));
  assert.equal(text.pages, 1);
  assert.equal(text.scanned, false);
  const scanned = await inspectPdfBytes(pdfBytes([""]));
  assert.equal(scanned.scanned, true);
  await assert.rejects(() => inspectPdfBytes(pdfBytes(Array.from({ length: 101 }, () => "x"))), /between 1 and 100 pages/);
});

test("rejects mismatched organization/material bindings", () => {
  assert.throws(() => assertQuestionImportBinding({ id: "b", club_id: "one" }, { id: "m", club_id: "two" }, { batch_id: "b", material_id: "m" }), /organization/);
});

test("requires all binding records", () => {
  assert.throws(() => assertQuestionImportBinding(null, {}, {}), /missing/);
});

test("duplicate delivery reuses the persisted provider job without submitting or double-processing", async () => {
  const calls = [];
  const result = await processQuestionImport({
    batch: { id: "batch-1", club_id: "club-1" },
    material: { id: "material-1", club_id: "club-1" },
    document: {
      batch_id: "batch-1",
      material_id: "material-1",
      storage_path: "private/source.pdf",
      signed_url: "https://private.test/source.pdf",
      provider_job_id: "job-existing",
    },
    download: async () => new Uint8Array([1]),
    inspect: async () => ({ pages: 2, hasText: true, scanned: false }),
    parse: {
      submit: async () => {
        calls.push("submit");
        return { id: "job-new", status: "pending" };
      },
      get: async (id) => {
        calls.push(`get:${id}`);
        return { id, status: "pending" };
      },
    },
    persist: async (value) => calls.push(value),
  });
  assert.equal(result.reusedProviderJob, true);
  assert.equal(calls.includes("submit"), false);
  assert.equal(calls[0], "get:job-existing");
  assert.equal(calls.filter((value) => typeof value === "object").length, 1);
});

test("LlamaParse uses one job for duplicate delivery and sends the v2 body", async () => {
  process.env.LLAMAPARSE_API_KEY = "test-key";
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    return { ok: true, status: 200, headers: { get: () => null }, json: async () => ({ id: "job-1", status: "pending" }) };
  };
  const adapter = createLlamaParseAdapter({ baseUrl: "https://parse.test", fetchImpl });
  await adapter.submit("https://private.test/source.pdf", "source.pdf");
  await adapter.get("job-1");
  const body = JSON.parse(calls[0].init.body);
  assert.equal(body.source_url, "https://private.test/source.pdf");
  assert.deepEqual(body.processing_options.ocr_parameters.languages, ["en", "vi"]);
  assert.equal(calls[1].url, "https://parse.test/api/v2/parse/job-1?expand=markdown_full&expand=items&expand=images_content_metadata&expand=usage");
  assert.equal(body.version, "latest");
  assert.equal(body.disable_cache, true);
  assert.match(body.agentic_options.custom_prompt, /do not create or paraphrase/i);
  assert.equal("do_not_cache" in body, false);
  assert.equal("output_options" in body, false);
});

test("LlamaParse exposes retry-after on provider throttling", async () => {
  process.env.LLAMAPARSE_API_KEY = "test-key";
  const adapter = createLlamaParseAdapter({ fetchImpl: async () => ({ ok: false, status: 429, headers: { get: () => "7" } }) });
  await assert.rejects(() => adapter.get("job-1"), (error) => error.message === "LLAMAPARSE_RATE_LIMITED" && error.retryAfterSeconds === 7);
});

test("normalizes the v2 nested pages and image metadata shapes", async () => {
  process.env.LLAMAPARSE_API_KEY = "test-key";
  const adapter = createLlamaParseAdapter({ fetchImpl: async () => ({ ok: true, status: 200, headers: { get: () => null }, json: async () => ({ id: "job-v2", status: "completed", markdown_full: { pages: [{ markdown: '{"questions":[{"question_type":"mcq_single","prompt":"Choose one"}]}' }] }, items: { pages: [{ items: [{ question_type: "mcq_single", prompt: "Choose two" }] }] }, images_content_metadata: { images: [{ page: 1, id: "image-1" }] }, usage: { credits: 3 } }) }) });
  const result = await adapter.get("job-v2");
  assert.equal(result.markdown.includes("questions"), true);
  assert.equal(result.items.length, 1);
  assert.deepEqual(result.images, [{ page: 1, id: "image-1" }]);
  assert.deepEqual(result.usage, { credits: 3 });
  assert.equal(questionCandidates(result).length, 1);
});

test("rejects an extraction that has no valid taxonomy candidates", () => {
  assert.throws(() => questionCandidates({ markdown: '{"questions":[]}' }), /EMPTY_OR_INVALID/);
  assert.throws(() => questionCandidates({ items: [{ question_type: "invented_type", prompt: "x" }] }), /INVALID_QUESTION_CANDIDATE/);
});

test("accepts JSON code items mixed with original markdown and deduplicates representations", () => {
  const result = questionCandidates({
    items: [{ type: "code", language: "json", value: JSON.stringify({ questions: [{ question_type: "mcq_single", prompt: "Choose one" }] }) }],
    markdown: "Original passage text\n\n```json\n{\"questions\":[{\"question_type\":\"mcq_single\",\"prompt\":\"Choose one\"},{\"question_type\":\"short_answer\",\"prompt\":\"Write one word\"}]}\n```",
  });
  assert.deepEqual(result.map((item) => item.prompt), ["Choose one", "Write one word"]);
});

test("combines valid JSON envelopes from multiple markdown blocks and pages", () => {
  const result = questionCandidates({
    markdown: [
      "Page one\n```json\n{\"questions\":[{\"question_type\":\"mcq_single\",\"prompt\":\"Page one\"}]}\n```",
      "Page two\n```json\n{\"questions\":[{\"question_type\":\"writing_task2_essay\",\"prompt\":\"Page two\"}]}\n```",
    ].join("\n\n"),
  });
  assert.deepEqual(result.map((item) => item.prompt), ["Page one", "Page two"]);
});

test("fails closed for malformed or invalid JSON question blocks", () => {
  assert.throws(() => questionCandidates({ markdown: '```json\n{"questions":[{"question_type":"mcq_single"}]}\n```' }), /INVALID_QUESTION_CANDIDATE/);
  assert.throws(() => questionCandidates({ items: [{ type: "code", language: "json", value: "{\\\"questions\\\":[}" }] }), /INVALID_QUESTION_CANDIDATE/);
  assert.throws(() => questionCandidates({ markdown: "```json\n{\"questions\":[{\"question_type\":\"invented_type\",\"prompt\":\"x\"}]}\n```" }), /INVALID_QUESTION_CANDIDATE/);
});

test("preserves repeated prompts with different answers and page evidence", () => {
  const questions = [
    { question_type: "mcq_single", prompt: "Choose the correct answer.", options: ["Monday", "Thursday"], answer: "B", page: 1 },
    { question_type: "mcq_single", prompt: "Choose the correct answer.", options: ["Blue", "Green"], answer: "A", page: 2 },
  ];
  const envelope = JSON.stringify({ questions });
  const markdown = ["Original source text", "```json", envelope, "```"].join("\n");
  assert.deepEqual(questionCandidates({ items: [{ type: "code", language: "json", value: envelope }], markdown }), questions);
  assert.deepEqual(questionCandidates({ markdown }), questions);
});

test("rejects invalid direct JSON and a malformed later extraction block", () => {
  assert.throws(() => questionCandidates({ markdown: '{"questions":[{"question_type":"invented_type","prompt":"x"}]}' }), /INVALID_QUESTION_CANDIDATE/);
  const valid = JSON.stringify({ questions: [{ question_type: "short_answer", prompt: "Name it." }] });
  assert.throws(() => questionCandidates({ markdown: ["```json", valid, "```", "```json", '{"questions": [}', "```"].join("\n") }), /INVALID_QUESTION_CANDIDATE/);
  assert.throws(() => questionCandidates({ markdown: ["```json", valid, "```", "```json", '{"questions": ['].join("\n") }), /INVALID_QUESTION_CANDIDATE/);
});
