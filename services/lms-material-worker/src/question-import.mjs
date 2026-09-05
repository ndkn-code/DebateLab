import { createHash } from "node:crypto";
import { extractText } from "unpdf";

export const QUESTION_IMPORT_LIMITS = Object.freeze({
  maxDocuments: 5,
  maxPdfBytes: 25 * 1024 * 1024,
  maxPdfPages: 100,
  maxAudioBytes: 100 * 1024 * 1024,
});

export async function inspectPdfBytes(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength < 8) throw new Error("PDF source is empty or corrupt.");
  if (bytes.byteLength > QUESTION_IMPORT_LIMITS.maxPdfBytes) throw new Error("PDF source exceeds the 25 MB limit.");
  const header = new TextDecoder().decode(bytes.slice(0, 5));
  if (header !== "%PDF-") throw new Error("Uploaded source is not a PDF.");
  if (bytes.includes(0x2f) && new TextDecoder("latin1").decode(bytes.slice(-1024)).includes("/Encrypt")) throw new Error("Encrypted PDFs are not supported.");
  return extractText(bytes, { mergePages: false }).then((result) => {
    const pages = Array.isArray(result.text) ? result.text.length : 1;
    if (pages < 1 || pages > QUESTION_IMPORT_LIMITS.maxPdfPages) throw new Error("PDF must contain between 1 and 100 pages.");
    const text = Array.isArray(result.text) ? result.text.join("\n") : String(result.text ?? "");
    return { pages, hasText: text.trim().length > 0, scanned: text.trim().length === 0 };
  }).catch((error) => {
    if (error instanceof Error && /100 pages|Encrypted|25 MB|not a PDF|empty|corrupt/.test(error.message)) throw error;
    throw new Error("PDF is corrupt or cannot be inspected.");
  });
}

export function assertQuestionImportBinding(batch, material, document) {
  if (!batch || !material || !document) throw new Error("Question import binding is missing.");
  if (String(batch.club_id) !== String(material.club_id) || String(document.material_id) !== String(material.id) || String(document.batch_id) !== String(batch.id)) {
    throw new Error("Question import organization or material binding is invalid.");
  }
}

export function questionCandidates(job) {
  const taxonomy = new Set(["mcq_single", "mcq_multi", "true_false_notgiven", "yes_no_notgiven", "matching_headings", "matching_information", "matching_features", "matching_sentence_endings", "sentence_completion", "summary_completion", "note_table_form_flowchart_completion", "short_answer", "diagram_label", "map_plan_label", "writing_task1_academic", "writing_task1_general", "writing_task2_essay", "speaking_part1", "speaking_part2_cuecard", "speaking_part3"]);
  const items = Array.isArray(job.items) ? job.items : [];
  const structured = items.filter((item) => item && typeof item === "object" && typeof item.question_type === "string" && taxonomy.has(item.question_type) && typeof (item.prompt ?? item.question) === "string");
  if (items.some((item) => item && typeof item === "object" && ("question_type" in item || "prompt" in item || "question" in item)) && structured.length !== items.filter((item) => item && typeof item === "object" && ("question_type" in item || "prompt" in item || "question" in item)).length) throw new Error("LLAMAPARSE_INVALID_QUESTION_CANDIDATE");
  if (structured.length) return structured;
  if (typeof job.markdown !== "string") throw new Error("LLAMAPARSE_EMPTY_OR_INVALID_RESULT");
  const candidate = job.markdown.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    const parsed = JSON.parse(candidate);
    const values = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.questions) ? parsed.questions : Array.isArray(parsed?.pages) ? parsed.pages.flatMap((page) => Array.isArray(page) ? page : Array.isArray(page?.questions) ? page.questions : page?.questions ? [page.questions] : []) : [];
    const normalized = values.filter((item) => item && typeof item === "object" && taxonomy.has(item.question_type) && typeof (item.prompt ?? item.question) === "string");
    if (values.length && normalized.length !== values.length) throw new Error("LLAMAPARSE_INVALID_QUESTION_CANDIDATE");
    if (!normalized.length) throw new Error("LLAMAPARSE_EMPTY_OR_INVALID_RESULT");
    return normalized;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("LLAMAPARSE_INVALID")) throw error;
    throw new Error("LLAMAPARSE_EMPTY_OR_INVALID_RESULT");
  }
}

export async function processQuestionImport({ batch, material, document, download, parse, persist, inspect = inspectPdfBytes }) {
  assertQuestionImportBinding(batch, material, document);
  if (["quarantined", "deleted"].includes(String(batch.status))) throw new Error("QUESTION_IMPORT_BATCH_UNAVAILABLE");
  if (!document.provider_job_id && ["submitting", "ambiguous_submit"].includes(String(document.provider_status))) throw new Error("LLAMAPARSE_SUBMIT_AMBIGUOUS");
  const bytes = await download(document.storage_path);
  const inspection = await inspect(bytes);
  const existingJobId = document.provider_job_id;
  if (!existingJobId) await persist({ stage: "submitting", providerJobId: null, inspection });
  let job;
  try { job = existingJobId ? await parse.get(existingJobId) : await parse.submit(document.signed_url); }
  catch (error) { if (!existingJobId && !error?.definitive) await persist({ stage: "ambiguous_submit", providerJobId: null, inspection, error: String(error?.message ?? error) }); throw error; }
  if (!job?.id) throw new Error("LLAMAPARSE_MISSING_JOB_ID");
  await persist({ stage: "processing", providerJobId: job.id || existingJobId, inspection });
  return { job, inspection, reusedProviderJob: Boolean(existingJobId) };
}

export async function processQuestionImportVersion({ supabase, version, parse, inspect = inspectPdfBytes, sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)) }) {
  if (String(version.source_mime_type ?? "").startsWith("audio/")) {
    const audioMaterial = await supabase.from("lms_materials").select("id,club_id").eq("id", version.material_id).maybeSingle();
    if (audioMaterial.error) throw new Error(audioMaterial.error.message);
    const media = await supabase.from("question_import_batch_documents").select("id,batch_id,club_id,media_material_id,media_version_id,status").eq("media_version_id", version.id).maybeSingle();
    if (media.error) throw new Error(media.error.message);
    if (!media.data || String(media.data.media_version_id) !== String(version.id) || String(media.data.media_material_id) !== String(version.material_id) || ["quarantined", "deleted"].includes(String(media.data.status))) throw new Error("QUESTION_IMPORT_AUDIO_BINDING_INVALID");
    const batch = await supabase.from("question_import_batches").select("id,club_id,status").eq("id", media.data.batch_id).maybeSingle();
    if (batch.error) throw new Error(batch.error.message);
    if (!audioMaterial.data || String(batch.data?.club_id) !== String(media.data.club_id) || String(audioMaterial.data?.club_id) !== String(media.data.club_id) || ["quarantined", "deleted"].includes(String(batch.data?.status))) throw new Error("QUESTION_IMPORT_AUDIO_BINDING_INVALID");
    return { status: "media_ready", providerJobId: null, reusedProviderJob: false, pages: 0 };
  }
  const materialResult = await supabase.from("lms_materials").select("id, club_id").eq("id", version.material_id).maybeSingle();
  if (materialResult.error) throw new Error(materialResult.error.message);
  const documentResult = await supabase.from("question_import_documents").select("*").eq("material_version_id", version.id).maybeSingle();
  if (documentResult.error) throw new Error(documentResult.error.message);
  const document = documentResult.data;
  const batchResult = await supabase.from("question_import_batches").select("*").eq("id", document?.batch_id).maybeSingle();
  if (batchResult.error) throw new Error(batchResult.error.message);
  assertQuestionImportBinding(batchResult.data, materialResult.data, document);
  if (String(document.material_version_id) !== String(version.id) || String(document.club_id) !== String(materialResult.data?.club_id)) throw new Error("Question import organization or material binding is invalid.");
  if (["quarantined", "deleted"].includes(String(batchResult.data.status)) || ["quarantined", "deleted"].includes(String(document.status))) throw new Error("QUESTION_IMPORT_BATCH_UNAVAILABLE");
  if (!document.provider_job_id && ["submitting", "ambiguous_submit"].includes(String(document.provider_status))) throw new Error("LLAMAPARSE_SUBMIT_AMBIGUOUS");
  if (String(document.status) === "ready") return { status: "ready", providerJobId: document.provider_job_id, reusedProviderJob: true, pages: Number(document.page_count ?? 0) };
  const source = await supabase.storage.from("lms-material-originals").createSignedUrl(version.original_path, 600);
  if (source.error) throw new Error(source.error.message);
  const response = await fetch(source.data.signedUrl, { signal: AbortSignal.timeout(Math.min(120_000, Math.max(1_000, Number(process.env.LLAMAPARSE_TIMEOUT_MS) || 60_000))) });
  if (!response.ok) throw new Error(`QUESTION_IMPORT_SOURCE_DOWNLOAD_FAILED:${response.status}`);
  const bytes = await response.arrayBuffer();
  const sha256 = createHash("sha256").update(new Uint8Array(bytes)).digest("hex");
  if (version.sha256 && version.sha256 !== sha256) throw new Error("QUESTION_IMPORT_SOURCE_CHECKSUM_MISMATCH");
  const hashed = await supabase.from("question_import_documents").update({ sha256 }).eq("id", document.id).eq("batch_id", document.batch_id);
  if (hashed.error) throw new Error(hashed.error.message);
  const inspection = await inspect(new Uint8Array(bytes));
  const reservationKey = `question-import:${batchResult.data.id}:${document.id}`;
  const claimed = await supabase.rpc("claim_question_import_provider_job", { p_batch_id: batchResult.data.id, p_document_id: document.id, p_pages: inspection.pages, p_question_estimate: 0, p_reservation_key: reservationKey });
  if (claimed.error) throw new Error(claimed.error.message);
  const existingJobId = document.provider_job_id;
  if (!existingJobId) {
    const marker = await supabase.from("question_import_documents").update({ provider_status: "submitting", updated_at: new Date().toISOString() }).eq("id", document.id).eq("batch_id", batchResult.data.id);
    if (marker.error) throw new Error(marker.error.message);
  }
  let job;
  try { job = existingJobId ? await parse.get(existingJobId) : await parse.submit(source.data.signedUrl, version.source_file_name); }
  catch (error) {
    if (!existingJobId) {
      const marker = await supabase.from("question_import_documents").update({
        provider_status: error?.definitive ? "submission_rejected" : "ambiguous_submit",
        error_code: error?.definitive ? "LLAMAPARSE_SUBMISSION_REJECTED" : "LLAMAPARSE_SUBMIT_AMBIGUOUS",
        error_message: String(error?.message ?? error).slice(0, 2_000), updated_at: new Date().toISOString(),
      }).eq("id", document.id).eq("batch_id", batchResult.data.id);
      if (marker.error) throw new Error(marker.error.message);
      if (!error?.definitive) throw new Error("LLAMAPARSE_SUBMIT_AMBIGUOUS");
    }
    throw error;
  }
  if (!job?.id) throw new Error("LLAMAPARSE_MISSING_JOB_ID");
  const update = await supabase.from("question_import_documents").update({ provider_job_id: job.id || document.provider_job_id, provider_status: job.status, page_count: inspection.pages, scanned: inspection.scanned, updated_at: new Date().toISOString() }).eq("id", document.id).eq("batch_id", batchResult.data.id);
  if (update.error) throw new Error(update.error.message);
  for (let attempt = 0; attempt < 6 && !["completed", "succeeded", "success", "failed", "error", "cancelled", "canceled"].includes(job.status.toLowerCase()); attempt += 1) {
    await sleep(Math.min(5_000, 1_000 * 2 ** attempt));
    job = await parse.get(job.id || document.provider_job_id);
  }
  if (["failed", "error", "cancelled", "canceled"].includes(job.status.toLowerCase())) {
    const failed = await supabase.from("question_import_documents").update({ provider_status: job.status, provider_result: { markdown: job.markdown ?? null, items: job.items ?? [], images: job.images ?? [], error: job.error ?? null }, provider_usage: job.usage ?? {}, error_code: "LLAMAPARSE_FAILED", error_message: String(job.error ?? "LLAMAPARSE_FAILED").slice(0, 2_000), updated_at: new Date().toISOString() }).eq("id", document.id).eq("batch_id", batchResult.data.id);
    if (failed.error) throw new Error(failed.error.message);
    await supabase.rpc("release_question_import_worker_quota", { p_club_id: batchResult.data.club_id, p_reservation_key: reservationKey });
    throw new Error(job.error || "LLAMAPARSE_FAILED");
  }
  if (!["completed", "succeeded", "success"].includes(job.status.toLowerCase())) throw new Error("LLAMAPARSE_PENDING");
  const usageUpdate = await supabase.from("question_import_documents").update({ provider_status: job.status, provider_usage: job.usage ?? {}, updated_at: new Date().toISOString() }).eq("id", document.id).eq("batch_id", batchResult.data.id);
  if (usageUpdate.error) throw new Error(usageUpdate.error.message);
  const rpc = await supabase.rpc("persist_question_import_result", { p_batch_id: batchResult.data.id, p_document_id: document.id, p_provider_status: job.status, p_provider_result: { markdown: job.markdown, items: questionCandidates(job), images: job.images }, p_provider_usage: job.usage ?? {}, p_pages: inspection.pages });
  if (rpc.error) throw new Error(rpc.error.message);
  return { status: job.status, providerJobId: job.id || document.provider_job_id, reusedProviderJob: Boolean(document.provider_job_id), pages: inspection.pages };
}

export async function releaseQuestionImportVersionQuota({ supabase, version, error }) {
  const documentResult = await supabase
    .from("question_import_documents")
    .select("id,batch_id,club_id")
    .eq("material_version_id", version.id)
    .maybeSingle();
  if (documentResult.error) throw new Error(documentResult.error.message);
  if (!documentResult.data) return false;
  const document = documentResult.data;
  const reservationKey = `question-import:${document.batch_id}:${document.id}`;
  const released = await supabase.rpc("release_question_import_worker_quota", {
    p_club_id: document.club_id,
    p_reservation_key: reservationKey,
  });
  if (released.error) throw new Error(released.error.message);
  const failed = await supabase
    .from("question_import_documents")
    .update({
      status: "failed",
      error_code: "QUESTION_IMPORT_FAILED",
      error_message: String(error instanceof Error ? error.message : error).slice(0, 2_000),
      updated_at: new Date().toISOString(),
    })
    .eq("id", document.id)
    .eq("batch_id", document.batch_id)
    .in("status", ["pending", "validating", "queued", "parsing", "extracting"]);
  if (failed.error) throw new Error(failed.error.message);
  return true;
}
