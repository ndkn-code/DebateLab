import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  getCategoryLabel,
  getLocalizedTopics,
  normalizePracticeCategoryKey,
  type CategoryKey,
} from "@/lib/topics";
import { createClient } from "@/lib/supabase/server";
import { tryCreateAdminClient } from "@/lib/supabase/admin";
import type { DebateTopic, PracticeLanguage } from "@/types";

type SourceKind = "legacy" | "calico" | "truong_teen";

interface CatalogSource {
  sourceSlug?: unknown;
  tournamentName?: unknown;
  sourceTag?: unknown;
}

interface ActivePracticeTopicCatalogRow {
  topic_key: string;
  category_key: string;
  difficulty: DebateTopic["difficulty"];
  display_order: number;
  source_kind: SourceKind;
  source_language: PracticeLanguage | null;
  metadata: Record<string, unknown> | null;
  language: PracticeLanguage;
  title: string;
  context: string | null;
  suggested_points: unknown;
  sources: CatalogSource[] | null;
  source_count: number | null;
  has_info_slide: boolean | null;
  has_stats: boolean | null;
}

export type ActivePracticeTopic = DebateTopic & {
  displayOrder: number;
  sourceKind: SourceKind;
  sourceLanguage?: PracticeLanguage;
  sourceCount: number;
  sourceTags: string[];
  tournamentNames: string[];
  hasInfoSlide: boolean;
  hasStats: boolean;
  metadata: Record<string, unknown>;
  ragReady: boolean;
  aiConfidence?: number;
  aggregateConfidence?: number;
  priorityTier: NonNullable<DebateTopic["priorityTier"]>;
};

function normalizeCategoryKey(
  value: string | null | undefined,
  textForInference?: string | null
): CategoryKey {
  return normalizePracticeCategoryKey(value, textForInference);
}

function parseSuggestedPoints(value: unknown): DebateTopic["suggestedPoints"] {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const candidate = value as {
    proposition?: unknown;
    opposition?: unknown;
  };

  if (
    !Array.isArray(candidate.proposition) ||
    !Array.isArray(candidate.opposition)
  ) {
    return undefined;
  }

  return {
    proposition: candidate.proposition.filter(
      (point): point is string => typeof point === "string"
    ),
    opposition: candidate.opposition.filter(
      (point): point is string => typeof point === "string"
    ),
  };
}

function uniqueStrings(values: unknown[]) {
  return [
    ...new Set(
      values
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean)
    ),
  ];
}

function readMetadataNumber(
  metadata: Record<string, unknown>,
  keys: string[]
) {
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }
  return undefined;
}

function readMetadataBoolean(
  metadata: Record<string, unknown>,
  keys: string[]
) {
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "boolean") {
      return value;
    }
  }
  return false;
}

function resolveTopicPriority(input: {
  sourceKind: SourceKind;
  metadata: Record<string, unknown>;
}) {
  const aggregateConfidence = readMetadataNumber(input.metadata, [
    "aggregateConfidence",
    "aggregate_confidence",
  ]);
  const aiConfidence =
    readMetadataNumber(input.metadata, ["aiConfidence", "ai_confidence"]) ??
    aggregateConfidence;
  const metadataRagReady = readMetadataBoolean(input.metadata, [
    "ragReady",
    "rag_ready",
  ]);
  const ragReady = input.sourceKind === "truong_teen" || metadataRagReady;
  const priorityTier: NonNullable<DebateTopic["priorityTier"]> =
    input.sourceKind === "truong_teen"
      ? "truong_teen"
      : ragReady
        ? "rag_ready"
        : (aiConfidence ?? 0) >= 0.85
          ? "high_confidence"
          : "standard";

  return {
    aggregateConfidence,
    aiConfidence,
    ragReady,
    priorityTier,
  };
}

function mapCatalogRow(
  row: ActivePracticeTopicCatalogRow,
  language: PracticeLanguage
): ActivePracticeTopic {
  const metadata = row.metadata ?? {};
  const priority = resolveTopicPriority({
    sourceKind: row.source_kind,
    metadata,
  });
  const categoryKey = normalizeCategoryKey(
    row.category_key,
    `${row.title} ${row.context ?? ""}`
  );
  const sources = Array.isArray(row.sources) ? row.sources : [];

  return {
    id: row.topic_key,
    topicKey: row.topic_key,
    categoryKey,
    title: row.title,
    category: getCategoryLabel(categoryKey, language),
    difficulty: row.difficulty,
    context: row.context ?? undefined,
    suggestedPoints: parseSuggestedPoints(row.suggested_points),
    displayOrder: row.display_order,
    sourceKind: row.source_kind,
    sourceLanguage: row.source_language ?? undefined,
    sourceCount: row.source_count ?? sources.length,
    sourceTags: uniqueStrings(sources.map((source) => source.sourceTag)),
    tournamentNames: uniqueStrings(
      sources.map((source) => source.tournamentName)
    ),
    hasInfoSlide: Boolean(row.has_info_slide),
    hasStats: Boolean(row.has_stats),
    metadata,
    ...priority,
  };
}

function getBundledPracticeTopics(language: PracticeLanguage): ActivePracticeTopic[] {
  return getLocalizedTopics(language).map((topic, index) => {
    const metadata = topic.metadata ?? {};
    const sourceKind = topic.sourceKind ?? "legacy";
    const priority = resolveTopicPriority({
      sourceKind,
      metadata: {
        ...metadata,
        ragReady: topic.ragReady ?? metadata.ragReady,
        aiConfidence: topic.aiConfidence ?? metadata.aiConfidence,
        aggregateConfidence:
          topic.aggregateConfidence ?? metadata.aggregateConfidence,
      },
    });
    const categoryKey = normalizeCategoryKey(
      topic.categoryKey ?? topic.category,
      `${topic.title} ${topic.context ?? ""}`
    );

    return {
      ...topic,
      categoryKey,
      category: getCategoryLabel(categoryKey, language),
      displayOrder: topic.displayOrder ?? index + 1,
      sourceKind,
      sourceLanguage: topic.sourceLanguage,
      sourceCount: topic.sourceCount ?? 0,
      sourceTags: topic.sourceTags ?? [],
      tournamentNames: topic.tournamentNames ?? [],
      hasInfoSlide: Boolean(topic.hasInfoSlide),
      hasStats: Boolean(topic.hasStats),
      metadata,
      ...priority,
    };
  });
}

async function queryActivePracticeTopics(
  supabase: SupabaseClient,
  language: PracticeLanguage
) {
  const { data, error } = await supabase
    .from("active_practice_topic_catalog")
    .select(
      [
        "topic_key",
        "category_key",
        "difficulty",
        "display_order",
        "source_kind",
        "source_language",
        "metadata",
        "language",
        "title",
        "context",
        "suggested_points",
        "sources",
        "source_count",
        "has_info_slide",
        "has_stats",
      ].join(", ")
    )
    .eq("language", language)
    .order("display_order", { ascending: true });

  if (error) {
    return { topics: [], error };
  }

  return {
    topics: ((data ?? []) as unknown as ActivePracticeTopicCatalogRow[]).map((row) =>
      mapCatalogRow(row, language)
    ),
    error: null,
  };
}

export async function getActivePracticeTopicsWithClient(
  supabase: SupabaseClient,
  language: PracticeLanguage
) {
  const result = await queryActivePracticeTopics(supabase, language);
  if (result.error) {
    throw new Error(result.error.message);
  }

  return result.topics;
}

export async function getActivePracticeTopics(
  language: PracticeLanguage,
  options: { allowAdminFallback?: boolean } = {}
) {
  const bundledTopics = getBundledPracticeTopics(language);
  const supabase = await createClient();
  const result = await queryActivePracticeTopics(supabase, language);
  if (!result.error && (result.topics.length > 0 || !options.allowAdminFallback)) {
    return result.topics.length > 0 ? result.topics : bundledTopics;
  }

  if (options.allowAdminFallback) {
    const admin = tryCreateAdminClient();
    if (admin) {
      const adminResult = await queryActivePracticeTopics(admin, language);
      if (!adminResult.error) {
        return adminResult.topics.length > 0 ? adminResult.topics : bundledTopics;
      }
    }
  }

  if (!result.error) {
    return result.topics.length > 0 ? result.topics : bundledTopics;
  }

  console.warn(
    "Failed to load active practice topics; using bundled topic catalog",
    result.error.message
  );
  return bundledTopics;
}
