import "server-only";

export type LlamaParseJob = { id: string; status: string; pages?: number; markdown?: string; items?: unknown[]; images?: unknown[]; usage?: Record<string, unknown>; error?: string };
export type LlamaParseAdapter = { submit(sourceUrl: string): Promise<LlamaParseJob>; get(jobId: string): Promise<LlamaParseJob> };

const DEFAULT_BASE_URL = "https://api.cloud.llamaindex.ai";
const REQUEST_TIMEOUT_MS = Math.min(120_000, Math.max(1_000, Number(process.env.LLAMAPARSE_TIMEOUT_MS) || 60_000));
export const QUESTION_EXTRACTION_PROMPT = "This is an IELTS-style assessment source. Extract only questions, instructions, passages, answer keys, and source-page evidence already present; do not create or paraphrase questions. Use only this taxonomy: mcq_single, mcq_multi, true_false_notgiven, yes_no_notgiven, matching_headings, matching_information, matching_features, matching_sentence_endings, sentence_completion, summary_completion, note_table_form_flowchart_completion, short_answer, diagram_label, map_plan_label, writing_task1_academic, writing_task1_general, writing_task2_essay, speaking_part1, speaking_part2_cuecard, speaking_part3. Return one JSON object with a questions array. For page-wise output, each page may contain a JSON object or array; preserve page numbers and concatenate page results into the one questions array. Each question must include question_type, skill, prompt, options, answer when printed, suggested_answer only when the printed key is missing, page, regions, stimulus, and has_required_media.";

function apiKey() { const value = process.env.LLAMAPARSE_API_KEY?.trim(); if (!value) throw new Error("LLAMAPARSE_API_KEY is not configured."); return value; }
function headers() { return { Authorization: `Bearer ${apiKey()}`, Accept: "application/json", "Content-Type": "application/json" }; }
function flattenPages(value: unknown): unknown[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((page) => page && typeof page === "object" && Array.isArray((page as Record<string, unknown>).items) ? (page as Record<string, unknown>).items as unknown[] : [page]);
}
function flattenMarkdown(value: unknown): string | undefined {
  if (!Array.isArray(value)) return undefined;
  const pages = value.map((page) => typeof page === "string" ? page : page && typeof page === "object" ? String((page as Record<string, unknown>).markdown ?? (page as Record<string, unknown>).markdown_full ?? (page as Record<string, unknown>).text ?? "") : "").filter(Boolean);
  return pages.length ? pages.join("\n\n") : undefined;
}
function parseResponse(value: unknown, fallbackId = ""): LlamaParseJob {
  if (!value || typeof value !== "object") throw new Error("Invalid LlamaParse response.");
  const row = value as Record<string, unknown>;
  const job = row.job && typeof row.job === "object" ? row.job as Record<string, unknown> : row;
  const id = String(job.id ?? row.id ?? row.job_id ?? fallbackId);
  if (!id) throw new Error("LLAMAPARSE_MISSING_JOB_ID");
  return { id, status: String(job.status ?? row.status ?? "pending"), pages: typeof row.pages === "number" ? row.pages : undefined, markdown: typeof row.markdown_full === "string" ? row.markdown_full : flattenMarkdown((row.markdown_full as Record<string, unknown> | undefined)?.pages ?? (row.markdown as Record<string, unknown> | undefined)?.pages) ?? (typeof row.markdown === "string" ? row.markdown : undefined), items: Array.isArray((row.items as Record<string, unknown> | undefined)?.pages) ? flattenPages((row.items as Record<string, unknown>).pages) : Array.isArray(row.items) ? row.items : undefined, images: Array.isArray((row.images_content_metadata as Record<string, unknown> | undefined)?.images) ? (row.images_content_metadata as Record<string, unknown>).images as unknown[] : Array.isArray(row.images_content_metadata) ? row.images_content_metadata : Array.isArray(row.images) ? row.images : undefined, usage: job.usage && typeof job.usage === "object" ? job.usage as Record<string, unknown> : row.usage && typeof row.usage === "object" ? row.usage as Record<string, unknown> : undefined, error: typeof job.error_message === "string" ? job.error_message : typeof row.error_message === "string" ? row.error_message : typeof job.error === "string" ? job.error : typeof row.error === "string" ? row.error : undefined };
}

async function request(baseUrl: string, path: string, init: RequestInit, fallbackId = ""): Promise<LlamaParseJob> {
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}${path}`, { ...init, headers: { ...headers(), ...(init.headers ?? {}) }, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  if (response.status === 402) throw Object.assign(new Error("LLAMAPARSE_PAYMENT_REQUIRED"), { definitive: true });
  if (response.status === 429) { const retryAfter = response.headers.get("retry-after"); throw Object.assign(new Error("LLAMAPARSE_RATE_LIMITED"), { retryAfterSeconds: retryAfter ? Number(retryAfter) : undefined, definitive: false }); }
  if (!response.ok) throw Object.assign(new Error(`LLAMAPARSE_HTTP_${response.status}`), { definitive: response.status >= 400 && response.status < 500 && response.status !== 408 });
  return parseResponse(await response.json(), fallbackId);
}

export function createLlamaParseAdapter(): LlamaParseAdapter {
  const baseUrl = process.env.LLAMAPARSE_BASE_URL?.trim() || DEFAULT_BASE_URL;
  const submitPath = process.env.LLAMAPARSE_SUBMIT_PATH?.trim() || "/api/v2/parse";
  const resultPath = process.env.LLAMAPARSE_RESULT_PATH?.trim() || "/api/v2/parse/{jobId}?expand=markdown_full&expand=items&expand=images_content_metadata&expand=usage";
  return {
    submit: (sourceUrl) => request(baseUrl, submitPath, { method: "POST", body: JSON.stringify({ source_url: sourceUrl, tier: "agentic", version: process.env.LLAMAPARSE_VERSION?.trim() || "latest", processing_options: { ocr_parameters: { languages: ["en", "vi"] } }, agentic_options: { custom_prompt: QUESTION_EXTRACTION_PROMPT }, page_ranges: { max_pages: 100 }, disable_cache: true }) }),
    get: (jobId) => request(baseUrl, resultPath.replace("{jobId}", encodeURIComponent(jobId)), { method: "GET" }, jobId),
  };
}

export async function pollLlamaParse(adapter: LlamaParseAdapter, jobId: string, options: { maxAttempts?: number; sleep?: (milliseconds: number) => Promise<void>; random?: () => number } = {}) {
  const maxAttempts = options.maxAttempts ?? 8;
  const sleep = options.sleep ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  const random = options.random ?? Math.random;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const result = await adapter.get(jobId);
    if (["completed", "succeeded", "ready"].includes(result.status.toLowerCase())) return result;
    if (["failed", "error", "cancelled", "canceled"].includes(result.status.toLowerCase())) throw new Error(result.error ?? "LLAMAPARSE_FAILED");
    await sleep(Math.min(30_000, 1_000 * 2 ** attempt + Math.floor(random() * 500)));
  }
  throw new Error("LLAMAPARSE_PENDING_TIMEOUT");
}
