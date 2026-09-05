const DEFAULT_BASE_URL = "https://api.cloud.llamaindex.ai";
const REQUEST_TIMEOUT_MS = Math.min(120_000, Math.max(1_000, Number(process.env.LLAMAPARSE_TIMEOUT_MS) || 60_000));
export const QUESTION_EXTRACTION_PROMPT = "This is an IELTS-style assessment source. Extract only questions, instructions, passages, answer keys, and source-page evidence already present; do not create or paraphrase questions. Use only this taxonomy: mcq_single, mcq_multi, true_false_notgiven, yes_no_notgiven, matching_headings, matching_information, matching_features, matching_sentence_endings, sentence_completion, summary_completion, note_table_form_flowchart_completion, short_answer, diagram_label, map_plan_label, writing_task1_academic, writing_task1_general, writing_task2_essay, speaking_part1, speaking_part2_cuecard, speaking_part3. Return one JSON object with a questions array. For page-wise output, each page may contain a JSON object or array; preserve page numbers and concatenate page results into the one questions array. Each question must include question_type, skill, prompt, options, answer when printed, suggested_answer only when the printed key is missing, page, regions, stimulus, and has_required_media.";

function requiredKey() {
  const value = process.env.LLAMAPARSE_API_KEY?.trim();
  if (!value) throw new Error("LLAMAPARSE_API_KEY is not configured.");
  return value;
}

function flattenPages(value) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((page) => {
    if (!page || typeof page !== "object") return [];
    const row = page;
    return Array.isArray(row.items) ? row.items : [page];
  });
}

function flattenMarkdown(value) {
  if (!Array.isArray(value)) return null;
  const pages = value.map((page) => {
    if (typeof page === "string") return page;
    if (!page || typeof page !== "object") return "";
    return typeof page.markdown === "string" ? page.markdown : typeof page.markdown_full === "string" ? page.markdown_full : typeof page.text === "string" ? page.text : "";
  }).filter(Boolean);
  return pages.length ? pages.join("\n\n") : null;
}

function parseJob(value, fallbackId = "") {
  const row = value && typeof value === "object" ? value : {};
  const job = row.job && typeof row.job === "object" ? row.job : row;
  return {
    id: String(job.id ?? row.id ?? row.job_id ?? fallbackId ?? ""),
    status: String(job.status ?? row.status ?? "pending"),
    items: Array.isArray(row.items?.pages) ? flattenPages(row.items.pages) : Array.isArray(row.items) ? row.items : [],
    images: Array.isArray(row.images_content_metadata?.images)
      ? row.images_content_metadata.images
      : Array.isArray(row.images_content_metadata)
        ? row.images_content_metadata
      : Array.isArray(row.images)
        ? row.images
        : [],
    markdown:
      typeof row.markdown_full === "string"
        ? row.markdown_full
        : flattenMarkdown(row.markdown_full?.pages ?? row.markdown?.pages) ??
          (typeof row.markdown === "string" ? row.markdown : null),
    usage:
      job.usage && typeof job.usage === "object"
        ? job.usage
        : row.usage && typeof row.usage === "object"
          ? row.usage
          : null,
    error: typeof job.error_message === "string" ? job.error_message : typeof row.error_message === "string" ? row.error_message : typeof job.error === "string" ? job.error : typeof row.error === "string" ? row.error : null,
  };
}

export function createLlamaParseAdapter({ fetchImpl = fetch, baseUrl = process.env.LLAMAPARSE_BASE_URL, submitPath = process.env.LLAMAPARSE_SUBMIT_PATH, resultPath = process.env.LLAMAPARSE_RESULT_PATH } = {}) {
  const root = (baseUrl?.trim() || DEFAULT_BASE_URL).replace(/\/$/, "");
  const submit = submitPath?.trim() || "/api/v2/parse";
  const result = resultPath?.trim() || "/api/v2/parse/{jobId}?expand=markdown_full&expand=items&expand=images_content_metadata&expand=usage";
  async function request(path, init, fallbackId = "") {
    const response = await fetchImpl(`${root}${path}`, { ...init, headers: { Authorization: `Bearer ${requiredKey()}`, Accept: "application/json", "Content-Type": "application/json", ...(init.headers ?? {}) }, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    if (response.status === 402) throw Object.assign(new Error("LLAMAPARSE_PAYMENT_REQUIRED"), { definitive: true });
    if (response.status === 429) throw Object.assign(new Error("LLAMAPARSE_RATE_LIMITED"), { retryAfterSeconds: Number(response.headers.get("retry-after") ?? 0) || undefined, definitive: false });
    if (!response.ok) throw Object.assign(new Error(`LLAMAPARSE_HTTP_${response.status}`), { definitive: response.status >= 400 && response.status < 500 && response.status !== 408 });
    const parsed = parseJob(await response.json(), fallbackId);
    if (!parsed.id) throw new Error("LLAMAPARSE_MISSING_JOB_ID");
    return parsed;
  }
  return {
    submit: (sourceUrl) => request(submit, { method: "POST", body: JSON.stringify({ source_url: sourceUrl, tier: "agentic", version: process.env.LLAMAPARSE_VERSION?.trim() || "latest", processing_options: { ocr_parameters: { languages: ["en", "vi"] } }, agentic_options: { custom_prompt: QUESTION_EXTRACTION_PROMPT }, page_ranges: { max_pages: 100 }, disable_cache: true }) }),
    get: (jobId) => request(result.replace("{jobId}", encodeURIComponent(jobId)), { method: "GET" }, jobId),
  };
}
