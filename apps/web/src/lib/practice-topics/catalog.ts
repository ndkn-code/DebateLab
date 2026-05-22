import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  getCategoryLabel,
  isCategoryKey,
  type CategoryKey,
} from "@/lib/topics";
import { createClient } from "@/lib/supabase/server";
import { tryCreateAdminClient } from "@/lib/supabase/admin";
import type { DebateTopic, PracticeLanguage } from "@/types";

type SourceKind = "legacy" | "calico";

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
};

function normalizeCategoryKey(value: string): CategoryKey {
  return isCategoryKey(value) ? value : "society";
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

function mapCatalogRow(
  row: ActivePracticeTopicCatalogRow,
  language: PracticeLanguage
): ActivePracticeTopic {
  const categoryKey = normalizeCategoryKey(row.category_key);
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
  };
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
  const supabase = await createClient();
  const result = await queryActivePracticeTopics(supabase, language);
  if (!result.error && (result.topics.length > 0 || !options.allowAdminFallback)) {
    return result.topics;
  }

  if (options.allowAdminFallback) {
    const admin = tryCreateAdminClient();
    if (admin) {
      const adminResult = await queryActivePracticeTopics(admin, language);
      if (!adminResult.error) {
        return adminResult.topics;
      }
    }
  }

  if (!result.error) {
    return result.topics;
  }

  console.error("Failed to load active practice topics", result.error.message);
  return [];
}
