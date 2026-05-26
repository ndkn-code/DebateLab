import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildCorpusMotionCandidatePlans,
  hashCorpusMotionTitle,
  inferCorpusMotionCategory,
  inferCorpusMotionDifficulty,
  parseCorpusImportText,
  slugifyCorpusText,
  summarizeCorpusSeed,
} from "./importer";
import {
  buildDebateCorpusItemPlans,
  estimateDebateCorpusTokens,
  hashDebateCorpusContent,
  type DebateCorpusSeed,
} from "./model";
import {
  getDebateCorpusEmbeddingConfig,
} from "./config";
import { createDebateCorpusEmbeddings } from "./embeddings";

type JsonRecord = Record<string, unknown>;

export const CORPUS_REVIEW_STATUSES = [
  "candidate",
  "approved",
  "rejected",
  "needs_review",
] as const;

export const MOTION_REVIEW_STATUSES = [
  "candidate",
  "approved",
  "rejected",
  "needs_review",
  "published",
] as const;

export type CorpusReviewStatus = (typeof CORPUS_REVIEW_STATUSES)[number];
export type CorpusMotionReviewStatus = (typeof MOTION_REVIEW_STATUSES)[number];

function nowIso() {
  return new Date().toISOString();
}

function safeJson(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function asCorpusReviewStatus(value: unknown): CorpusReviewStatus | null {
  return CORPUS_REVIEW_STATUSES.includes(value as CorpusReviewStatus)
    ? (value as CorpusReviewStatus)
    : null;
}

function asMotionReviewStatus(value: unknown): CorpusMotionReviewStatus | null {
  return MOTION_REVIEW_STATUSES.includes(value as CorpusMotionReviewStatus)
    ? (value as CorpusMotionReviewStatus)
    : null;
}

function toSourceRows(seed: DebateCorpusSeed, importFileName?: string | null) {
  return seed.sources.map((source) => ({
    id: source.source_id,
    youtube_url: source.youtube_url,
    youtube_video_id: source.youtube_video_id ?? null,
    video_title: source.video_title,
    source_type: source.source_type,
    season: source.season ?? null,
    episode: source.episode ?? null,
    stage: source.stage ?? null,
    language: source.language === "en" ? "en" : "vi",
    transcript_quality: source.transcript_quality,
    overall_confidence: source.overall_confidence,
    recommended_import_status: source.recommended_import_status,
    recommended_use: source.recommended_use ?? [],
    reason: source.reason ?? null,
    raw_line: source.raw_line ?? null,
    review_status:
      source.recommended_import_status === "approved"
        ? "approved"
        : source.recommended_import_status === "do_not_import"
          ? "rejected"
          : "needs_review",
    metadata: {
      sourceIndex: source.source_index ?? null,
      importedFrom: importFileName ?? "corpus-studio",
    },
    updated_at: nowIso(),
  }));
}

function toMatchRows(seed: DebateCorpusSeed) {
  return seed.canonical_matches.map((match) => ({
    canonical_match_key: match.canonical_match_key,
    motion_vi: match.motion.vi,
    motion_en: match.motion.en_translation ?? null,
    motion_key: match.motion.motion_key,
    motion_confidence: match.motion.motion_confidence,
    teams: match.teams,
    source_match_refs: match.source_match_refs,
    import_decision: match.import_decision,
    aggregate_confidence: match.aggregate_confidence,
    rejected_reason: match.rejected_reason ?? null,
    review_status:
      match.import_decision === "reject"
        ? "rejected"
        : match.import_decision === "metadata_only"
          ? "needs_review"
          : "candidate",
    metadata: {
      sourceMatchCount: match.source_match_refs.length,
      debateMomentCount: match.debate_moments?.length ?? 0,
      phraseCount: match.phrase_bank?.length ?? 0,
      judgingLessonCount: match.judging_lessons?.length ?? 0,
    },
    updated_at: nowIso(),
  }));
}

async function getMatchIdByKey(
  supabase: SupabaseClient,
  matchRows: Array<{ canonical_match_key: string }>
) {
  const keys = matchRows.map((match) => match.canonical_match_key);
  if (keys.length === 0) return new Map<string, string>();
  const { data, error } = await supabase
    .from("debate_corpus_matches")
    .select("id, canonical_match_key")
    .in("canonical_match_key", keys);
  if (error) throw new Error(error.message);
  return new Map(
    (data ?? []).map((match) => [
      match.canonical_match_key as string,
      match.id as string,
    ])
  );
}

async function getExistingReviewStatusById(
  supabase: SupabaseClient,
  table: "debate_corpus_sources",
  ids: string[]
) {
  if (ids.length === 0) return new Map<string, string>();
  const { data, error } = await supabase
    .from(table)
    .select("id, review_status")
    .in("id", ids);
  if (error) throw new Error(error.message);
  return new Map(
    ((data ?? []) as Array<{ id: string; review_status: string }>).map((row) => [
      row.id,
      asCorpusReviewStatus(row.review_status) ?? "needs_review",
    ])
  );
}

async function getExistingMatchReviewStatusByKey(
  supabase: SupabaseClient,
  keys: string[]
) {
  if (keys.length === 0) return new Map<string, string>();
  const { data, error } = await supabase
    .from("debate_corpus_matches")
    .select("canonical_match_key, review_status")
    .in("canonical_match_key", keys);
  if (error) throw new Error(error.message);
  return new Map(
    ((data ?? []) as Array<{ canonical_match_key: string; review_status: string }>).map(
      (row) => [row.canonical_match_key, asCorpusReviewStatus(row.review_status) ?? "candidate"]
    )
  );
}

export async function importCorpusBundle(params: {
  supabase: SupabaseClient;
  content: string;
  fileName?: string | null;
  importedBy?: string | null;
}) {
  const parsed = parseCorpusImportText(params.content);
  const summary = summarizeCorpusSeed(parsed.seed);
  const importKey = `import_${hashDebateCorpusContent({
    content: params.content,
    fileName: params.fileName ?? null,
  }).slice(0, 24)}`;
  const contentHash = hashDebateCorpusContent(params.content);
  const createdAt = nowIso();

  const { data: batch, error: batchError } = await params.supabase
    .from("debate_corpus_import_batches")
    .upsert(
      {
        import_key: importKey,
        file_name: params.fileName ?? null,
        input_format: parsed.inputFormat,
        source_count: summary.sources,
        match_count: summary.matches,
        item_count: summary.items,
        motion_count: summary.motions,
        status: "imported",
        error_message: null,
        metadata: {
          objectCount: parsed.objectCount,
          schemaVersion: parsed.seed.schema_version,
        },
        imported_by: params.importedBy ?? null,
        updated_at: createdAt,
      },
      { onConflict: "import_key" }
    )
    .select("id")
    .single();
  if (batchError) throw new Error(batchError.message);

  const { data: document, error: documentError } = await params.supabase
    .from("debate_corpus_documents")
    .upsert(
      {
        import_batch_id: batch.id,
        document_type: "import_bundle",
        title: params.fileName ?? "Corpus Studio import",
        language: "vi",
        content_text: params.content,
        content_hash: contentHash,
        metadata: {
          inputFormat: parsed.inputFormat,
          objectCount: parsed.objectCount,
        },
        created_by: params.importedBy ?? null,
        updated_at: createdAt,
      },
      { onConflict: "content_hash" }
    )
    .select("id")
    .single();
  if (documentError) throw new Error(documentError.message);

  await params.supabase
    .from("debate_corpus_import_batches")
    .update({ original_document_id: document.id, updated_at: nowIso() })
    .eq("id", batch.id);

  const sourceRows = toSourceRows(parsed.seed, params.fileName);
  if (sourceRows.length) {
    const existingStatusById = await getExistingReviewStatusById(
      params.supabase,
      "debate_corpus_sources",
      sourceRows.map((source) => source.id)
    );
    sourceRows.forEach((source) => {
      source.review_status = existingStatusById.get(source.id) ?? source.review_status;
    });

    const { error } = await params.supabase
      .from("debate_corpus_sources")
      .upsert(sourceRows, { onConflict: "id" });
    if (error) throw new Error(error.message);
  }

  const matchRows = toMatchRows(parsed.seed);
  if (matchRows.length) {
    const existingStatusByKey = await getExistingMatchReviewStatusByKey(
      params.supabase,
      matchRows.map((match) => match.canonical_match_key)
    );
    matchRows.forEach((match) => {
      match.review_status =
        existingStatusByKey.get(match.canonical_match_key) ?? match.review_status;
    });

    const { error } = await params.supabase
      .from("debate_corpus_matches")
      .upsert(matchRows, { onConflict: "canonical_match_key" });
    if (error) throw new Error(error.message);
  }

  const matchIdByKey = await getMatchIdByKey(params.supabase, matchRows);
  const itemPlans = buildDebateCorpusItemPlans(parsed.seed);
  const itemRows = itemPlans.map((item) => {
    const canonicalMatchId = matchIdByKey.get(item.canonicalMatchKey);
    if (!canonicalMatchId) {
      throw new Error(`Missing match id for ${item.canonicalMatchKey}`);
    }
    return {
      canonical_match_id: canonicalMatchId,
      source_id: item.sourceId,
      source_match_key: item.sourceMatchKey,
      item_type: item.itemType,
      canonical_fingerprint: item.canonicalFingerprint,
      language: item.language,
      side: item.side,
      usable_for: item.usableFor,
      evidence_status: item.evidenceStatus,
      confidence: item.confidence,
      review_status: item.reviewStatus,
      embedding_text: item.embeddingText,
      content_hash: item.contentHash,
      content: item.content,
      metadata: item.metadata ?? {},
      updated_at: nowIso(),
    };
  });

  if (itemRows.length) {
    const { data: existingItems, error: existingItemsError } = await params.supabase
      .from("debate_corpus_items")
      .select("canonical_match_id, item_type, canonical_fingerprint, review_status")
      .in("canonical_match_id", Array.from(new Set(itemRows.map((item) => item.canonical_match_id))));
    if (existingItemsError) throw new Error(existingItemsError.message);
    const existingItemStatus = new Map(
      ((existingItems ?? []) as Array<{
        canonical_match_id: string;
        item_type: string;
        canonical_fingerprint: string;
        review_status: string;
      }>).map((item) => [
        `${item.canonical_match_id}:${item.item_type}:${item.canonical_fingerprint}`,
        asCorpusReviewStatus(item.review_status) ?? "candidate",
      ])
    );
    itemRows.forEach((item) => {
      item.review_status =
        existingItemStatus.get(
          `${item.canonical_match_id}:${item.item_type}:${item.canonical_fingerprint}`
        ) ?? item.review_status;
    });
  }

  for (let index = 0; index < itemRows.length; index += 100) {
    const { error } = await params.supabase
      .from("debate_corpus_items")
      .upsert(itemRows.slice(index, index + 100), {
        onConflict: "canonical_match_id,item_type,canonical_fingerprint",
      });
    if (error) throw new Error(error.message);
  }

  const motionPlans = buildCorpusMotionCandidatePlans(parsed.seed);
  const motionRows = motionPlans.map((motion) => {
    const canonicalMatchId = matchIdByKey.get(motion.canonicalMatchKey);
    return {
      canonical_match_id: canonicalMatchId ?? null,
      source_id: motion.sourceId,
      motion_vi: motion.motionVi,
      motion_en: motion.motionEn,
      normalized_title_hash: motion.normalizedTitleHash,
      motion_key: motion.motionKey,
      category_key: motion.categoryKey,
      difficulty: motion.difficulty,
      source_stage: motion.sourceStage,
      source_season: motion.sourceSeason,
      source_url: motion.sourceUrl,
      teams: motion.teams,
      review_status: "candidate",
      metadata: motion.metadata,
      updated_at: nowIso(),
    };
  });

  if (motionRows.length) {
    const motionMatchIds = Array.from(
      new Set(
        motionRows
          .map((motion) => motion.canonical_match_id)
          .filter((id): id is string => Boolean(id))
      )
    );
    if (motionMatchIds.length) {
      const { data: existingMotions, error: existingMotionsError } = await params.supabase
        .from("debate_corpus_motion_candidates")
        .select("canonical_match_id, normalized_title_hash, review_status")
        .in("canonical_match_id", motionMatchIds);
      if (existingMotionsError) throw new Error(existingMotionsError.message);
      const existingMotionStatus = new Map(
        ((existingMotions ?? []) as Array<{
          canonical_match_id: string;
          normalized_title_hash: string;
          review_status: string;
        }>).map((motion) => [
          `${motion.canonical_match_id}:${motion.normalized_title_hash}`,
          asMotionReviewStatus(motion.review_status) ?? "candidate",
        ])
      );
      motionRows.forEach((motion) => {
        if (!motion.canonical_match_id) return;
        motion.review_status =
          existingMotionStatus.get(
            `${motion.canonical_match_id}:${motion.normalized_title_hash}`
          ) ?? motion.review_status;
      });
    }
  }

  for (let index = 0; index < motionRows.length; index += 100) {
    const { error } = await params.supabase
      .from("debate_corpus_motion_candidates")
      .upsert(motionRows.slice(index, index + 100), {
        onConflict: "canonical_match_id,normalized_title_hash",
      });
    if (error) throw new Error(error.message);
  }

  return {
    importBatchId: batch.id as string,
    documentId: document.id as string,
    summary,
  };
}

export async function runCorpusEmbeddingBatch(params: {
  supabase: SupabaseClient;
  limit?: number;
}) {
  const limit = Math.max(1, Math.min(16, params.limit ?? 16));
  const config = getDebateCorpusEmbeddingConfig();

  const { data: items, error: itemError } = await params.supabase
    .from("debate_corpus_items")
    .select("id, content_hash, embedding_text")
    .neq("review_status", "rejected")
    .order("updated_at", { ascending: true })
    .limit(400);
  if (itemError) throw new Error(itemError.message);

  const candidates = (items ?? []) as Array<{
    id: string;
    content_hash: string;
    embedding_text: string;
  }>;
  if (candidates.length === 0) return { embedded: 0, skipped: 0 };

  const { data: existing, error: existingError } = await params.supabase
    .from("debate_corpus_embeddings")
    .select("item_id, content_hash")
    .eq("provider", config.provider)
    .eq("model", config.model)
    .eq("dimensions", config.dimensions)
    .eq("input_type", "document")
    .in("item_id", candidates.map((item) => item.id));
  if (existingError) throw new Error(existingError.message);

  const existingById = new Map(
    ((existing ?? []) as Array<{ item_id: string; content_hash: string }>).map(
      (row) => [row.item_id, row.content_hash]
    )
  );
  const stale = candidates
    .filter((item) => existingById.get(item.id) !== item.content_hash)
    .slice(0, limit);

  if (stale.length === 0) {
    return { embedded: 0, skipped: candidates.length };
  }

  const embeddingResult = await createDebateCorpusEmbeddings({
    texts: stale.map((item) => item.embedding_text),
    inputType: "document",
    timeoutMs: 30000,
  });

  const rows = stale.map((item, index) => ({
    item_id: item.id,
    provider: config.provider,
    model: config.model,
    dimensions: config.dimensions,
    input_type: "document",
    content_hash: item.content_hash,
    embedding: embeddingResult.embeddings[index],
    token_count_estimate: estimateDebateCorpusTokens(item.embedding_text),
    embedded_at: nowIso(),
    updated_at: nowIso(),
  }));

  const { error: upsertError } = await params.supabase
    .from("debate_corpus_embeddings")
    .upsert(rows, {
      onConflict: "item_id,provider,model,dimensions,input_type",
    });
  if (upsertError) throw new Error(upsertError.message);

  return { embedded: rows.length, skipped: candidates.length - rows.length };
}

export async function publishCorpusMotionCandidate(params: {
  supabase: SupabaseClient;
  motionId: string;
  reviewedBy?: string | null;
}) {
  const { data: motion, error } = await params.supabase
    .from("debate_corpus_motion_candidates")
    .select("*")
    .eq("id", params.motionId)
    .single();
  if (error || !motion) throw new Error(error?.message ?? "Motion not found.");

  const motionRow = motion as {
    id: string;
    motion_vi: string;
    motion_en: string | null;
    normalized_title_hash: string;
    category_key: string | null;
    difficulty: string | null;
    source_stage: string | null;
    source_season: number | null;
    source_url: string | null;
    source_id: string | null;
    metadata: JsonRecord | null;
    published_topic_key: string | null;
  };
  const topicKey =
    motionRow.published_topic_key ??
    `tt-${motionRow.source_season ?? "corpus"}-${motionRow.normalized_title_hash.slice(0, 10)}`;

  const { data: maxRows } = await params.supabase
    .from("practice_topics")
    .select("display_order")
    .order("display_order", { ascending: false })
    .limit(1);
  const displayOrder = Number((maxRows?.[0] as { display_order?: number })?.display_order ?? 0) + 1;
  const metadata = safeJson(motionRow.metadata);

  const { error: topicError } = await params.supabase
    .from("practice_topics")
    .upsert(
      {
        topic_key: topicKey,
        category_key:
          motionRow.category_key && motionRow.category_key !== "vietnam"
            ? motionRow.category_key
            : inferCorpusMotionCategory(motionRow.motion_vi),
        difficulty:
          motionRow.difficulty ?? inferCorpusMotionDifficulty(motionRow.motion_vi),
        display_order: displayOrder,
        is_active: true,
        source_kind: "truong_teen",
        source_language: "vi",
        normalized_title_hash:
          motionRow.normalized_title_hash || hashCorpusMotionTitle(motionRow.motion_vi),
        metadata: {
          ...metadata,
          corpusMotionCandidateId: motionRow.id,
          sourceId: motionRow.source_id,
        },
        updated_at: nowIso(),
      },
      { onConflict: "topic_key" }
    );
  if (topicError) throw new Error(topicError.message);

  const translations = [
    {
      topic_key: topicKey,
      language: "vi",
      title: motionRow.motion_vi,
      context: `Trường Teen${motionRow.source_season ? ` ${motionRow.source_season}` : ""}${motionRow.source_stage ? ` · ${motionRow.source_stage}` : ""}`,
      suggested_points: {},
      updated_at: nowIso(),
    },
  ];
  if (motionRow.motion_en) {
    translations.push({
      topic_key: topicKey,
      language: "en",
      title: motionRow.motion_en,
      context: `Truong Teen${motionRow.source_season ? ` ${motionRow.source_season}` : ""}${motionRow.source_stage ? ` · ${motionRow.source_stage}` : ""}`,
      suggested_points: {},
      updated_at: nowIso(),
    });
  }

  const { error: translationError } = await params.supabase
    .from("practice_topic_translations")
    .upsert(translations, { onConflict: "topic_key,language" });
  if (translationError) throw new Error(translationError.message);

  const rawMotionHash =
    motionRow.normalized_title_hash || hashCorpusMotionTitle(motionRow.motion_vi);
  const { error: sourceError } = await params.supabase
    .from("practice_topic_sources")
    .upsert(
      {
        topic_key: topicKey,
        source_slug: motionRow.source_id ?? `corpus-motion-${motionRow.id}`,
        tournament_name: `Trường Teen${motionRow.source_season ? ` ${motionRow.source_season}` : ""}`,
        source_url: motionRow.source_url ?? `internal://debate-corpus-motion/${motionRow.id}`,
        source_page_type: "video_transcript",
        source_language: "vi",
        source_motion_index: 1,
        round_label: motionRow.source_stage,
        stage_label: motionRow.source_stage,
        source_tag: "truong_teen",
        info_slide: null,
        stats: {
          corpusMotionCandidateId: motionRow.id,
          sourceId: motionRow.source_id,
        },
        raw_motion_text: motionRow.motion_vi,
        raw_motion_hash: rawMotionHash,
        updated_at: nowIso(),
      },
      { onConflict: "source_slug,source_motion_index,raw_motion_hash" }
    );
  if (sourceError) throw new Error(sourceError.message);

  const { data: updated, error: updateError } = await params.supabase
    .from("debate_corpus_motion_candidates")
    .update({
      review_status: "published",
      publish_status: "published",
      published_topic_key: topicKey,
      reviewed_by: params.reviewedBy ?? null,
      reviewed_at: nowIso(),
      updated_at: nowIso(),
    })
    .eq("id", params.motionId)
    .select("*")
    .single();
  if (updateError) throw new Error(updateError.message);

  return { motion: updated, topicKey };
}

export function createMotionCandidatePatch(input: {
  motionVi?: string;
  motionEn?: string | null;
  categoryKey?: string;
  difficulty?: string;
  reviewStatus?: CorpusMotionReviewStatus;
  adminNotes?: string | null;
  qualityFlags?: JsonRecord;
  reviewerId?: string | null;
}) {
  const patch: JsonRecord = { updated_at: nowIso() };
  if (input.motionVi) {
    patch.motion_vi = input.motionVi;
    patch.normalized_title_hash = hashCorpusMotionTitle(input.motionVi);
    patch.motion_key = slugifyCorpusText(input.motionVi, "motion");
  }
  if (input.motionEn !== undefined) patch.motion_en = input.motionEn;
  if (input.categoryKey) patch.category_key = input.categoryKey;
  if (input.difficulty) patch.difficulty = input.difficulty;
  if (input.reviewStatus) {
    patch.review_status = input.reviewStatus;
    patch.reviewed_by = input.reviewerId ?? null;
    patch.reviewed_at = nowIso();
  }
  if (input.adminNotes !== undefined) patch.admin_notes = input.adminNotes;
  if (input.qualityFlags) patch.quality_flags = input.qualityFlags;
  return patch;
}
