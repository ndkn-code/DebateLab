import { createHash } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import type {
  CategoryKey,
  DebateTopic,
  PracticeLanguage,
} from "@thinkfy/shared/practice";

type SourcePageType = "statistics" | "motion_list";
type Difficulty = DebateTopic["difficulty"];
type EmitSqlTarget =
  | "legacy"
  | "topics"
  | "translations"
  | "sources"
  | `sources:${string}`;

export interface CalicoSource {
  slug: string;
  tournamentName: string;
  url: string;
  pageType: SourcePageType;
}

export interface ParsedCalicoMotion {
  sourceSlug: string;
  tournamentName: string;
  sourceUrl: string;
  sourcePageType: SourcePageType;
  sourceMotionIndex: number;
  roundLabel: string | null;
  stageLabel: string | null;
  sourceTag: string | null;
  infoSlide: string | null;
  stats: Record<string, unknown>;
  rawMotionText: string;
}

export interface CalicoTopicImport {
  topicKey: string;
  title: string;
  language: PracticeLanguage;
  categoryKey: CategoryKey;
  difficulty: Difficulty;
  normalizedTitleHash: string;
  displayOrder: number;
  context: string | null;
  sourceTags: string[];
  tournamentSlugs: string[];
  sources: CalicoTopicSourceImport[];
}

export interface CalicoTopicSourceImport extends ParsedCalicoMotion {
  topicKey: string;
  sourceLanguage: PracticeLanguage;
  rawMotionHash: string;
}

export interface CalicoImportPlan {
  topics: CalicoTopicImport[];
  sources: CalicoTopicSourceImport[];
  occurrences: ParsedCalicoMotion[];
  skipped: Array<{ sourceSlug: string; reason: string; rawMotionText: string }>;
}

export const CALICO_SOURCES: CalicoSource[] = [
  {
    slug: "wudc-2024",
    tournamentName: "WUDC 2024",
    url: "https://wudc2024.calicotab.com/wudc/motions/statistics/",
    pageType: "statistics",
  },
  {
    slug: "codoc-26",
    tournamentName: "CODOC26",
    url: "https://codoc26.calicotab.com/codoc26/motions/statistics/",
    pageType: "statistics",
  },
  {
    slug: "wudc-2025",
    tournamentName: "WUDC 2025",
    url: "https://wudc2025.calicotab.com/open/motions/statistics/",
    pageType: "statistics",
  },
  {
    slug: "asdc-2025",
    tournamentName: "ASDC 2025",
    url: "https://asdc2025.calicotab.com/asdc2025/motions/statistics/",
    pageType: "statistics",
  },
  {
    slug: "asdc-2024",
    tournamentName: "ASDC 2024",
    url: "https://asdc2024.calicotab.com/asdc2024/motions/",
    pageType: "motion_list",
  },
  {
    slug: "nsdc-2025",
    tournamentName: "NSDC 2025",
    url: "https://vnnsdc2025.calicotab.com/nsdc2025/motions/statistics/",
    pageType: "statistics",
  },
  {
    slug: "nsdc-2024",
    tournamentName: "NSDC 2024",
    url: "https://vnnsdc2024.calicotab.com/nsdc2024/motions/",
    pageType: "motion_list",
  },
  {
    slug: "nsdc-2023",
    tournamentName: "NSDC 2023",
    url: "https://nsdc.calicotab.com/nsdc2023/motions/statistics/",
    pageType: "statistics",
  },
];

const SOURCE_TAG_KEYWORDS: Array<[CategoryKey, RegExp]> = [
  ["education", /\b(education|school|student|teacher|university|academic)\b/i],
  ["technology", /\b(tech|technology|ai|artificial intelligence|social media|online|internet|digital|privacy|surveillance)\b/i],
  ["environment", /\b(environment|climate|carbon|energy|pollution|green|sustainability|animal|agriculture)\b/i],
  ["ethics", /\b(ethic|philosophy|religion|moral|justice|rights|democracy|law|criminal|punishment)\b/i],
  ["vietnam", /\b(vietnam|việt nam|hanoi|hà nội|saigon|sài gòn|vietnamese|việt)\b/i],
];

const TITLE_CATEGORY_KEYWORDS: Array<[CategoryKey, RegExp]> = [
  ["vietnam", /\b(vietnam|việt nam|hanoi|hà nội|saigon|sài gòn|vietnamese|việt)\b/i],
  ["education", /\b(school|student|teacher|education|university|academic|curriculum|exam|classroom|homework)\b/i],
  ["technology", /\b(ai|artificial intelligence|algorithm|internet|online|digital|social media|platform|technology|privacy|surveillance)\b/i],
  ["environment", /\b(climate|environment|carbon|energy|pollution|emission|green|fossil|plastic|wildlife|animal)\b/i],
  ["ethics", /\b(should punish|ethical|moral|justice|rights|democracy|court|criminal|law|religion|philosophy)\b/i],
];

const VIETNAMESE_CHARACTERS =
  /[ăâđêôơưáàảãạắằẳẵặấầẩẫậéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/i;

const VIETNAMESE_WORDS =
  /\b(này|rằng|không|những|các|của|và|trong|cho|đối|với|chính|phủ|xã|hội|việt|nam|nên|tin|nhà|nước|người)\b/i;

const HTML_ENTITIES: Record<string, string> = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  nbsp: " ",
  quot: '"',
};

function decodeHtml(input: string): string {
  return input.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
    if (entity.startsWith("#x")) {
      return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
    }

    if (entity.startsWith("#")) {
      return String.fromCodePoint(Number.parseInt(entity.slice(1), 10));
    }

    return HTML_ENTITIES[entity.toLowerCase()] ?? match;
  });
}

function cleanText(input: string): string {
  return decodeHtml(
    input
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/\u00a0/g, " ")
    .replace(/[ \t\r\n]+/g, " ")
    .trim();
}

function extractClassBlock(
  html: string,
  classPattern: RegExp,
  tagName = "div"
): RegExpMatchArray | null {
  const pattern = new RegExp(
    `<${tagName}\\b(?=[^>]*class=["'][^"']*${classPattern.source}[^"']*["'])[^>]*>([\\s\\S]*?)<\\/${tagName}>`,
    "i"
  );
  return html.match(pattern);
}

function stripMotionTag(h4Html: string) {
  const tagMatch = h4Html.match(/<small\b[^>]*>\s*\(([\s\S]*?)\)\s*<\/small>/i);
  const sourceTag = tagMatch ? cleanText(tagMatch[1]) : null;
  const motionHtml = h4Html.replace(/<small\b[^>]*>[\s\S]*?<\/small>/gi, "");

  return {
    sourceTag,
    motionText: cleanText(motionHtml),
  };
}

function findLastRoundBadge(html: string, beforeIndex: number) {
  const windowHtml = html.slice(Math.max(0, beforeIndex - 5000), beforeIndex);
  const matches = [...windowHtml.matchAll(/<span\b[^>]*class=["'][^"']*\bbadge\b[^"']*\bbadge-secondary\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/gi)];
  const last = matches.at(-1);

  return last ? cleanText(last[1]) : null;
}

function findLastCardTitle(html: string, beforeIndex: number) {
  const windowHtml = html.slice(Math.max(0, beforeIndex - 5000), beforeIndex);
  const matches = [...windowHtml.matchAll(/<h4\b[^>]*class=["'][^"']*\bcard-title\b[^"']*["'][^>]*>([\s\S]*?)<\/h4>/gi)];
  const last = matches.at(-1);

  return last ? cleanText(last[1]) : null;
}

function extractInfoSlide(blockHtml: string) {
  const modalMatch = extractClassBlock(blockHtml, /\bmodal-body\b[\s\S]*\blead\b/);
  if (!modalMatch) {
    return null;
  }

  const infoSlide = cleanText(modalMatch[1]);
  return infoSlide.length > 0 ? infoSlide : null;
}

function extractStats(blockHtml: string): Record<string, unknown> {
  const text = cleanText(blockHtml);
  const tooltips = [
    ...blockHtml.matchAll(/(?:data-original-title|title)=["']([^"']+)["']/gi),
  ]
    .map((match) => cleanText(match[1]))
    .filter((value) => value.length > 0);

  const hasChiSquare = /χ|chi-square|chi square/i.test(`${text} ${tooltips.join(" ")}`);
  const hasGovernmentOppositionAverage = /government|opposition/i.test(text);
  const hasBenchAverage = /\bbench\b|opening|closing/i.test(text);
  const hasHalfAverage = /\bhalf\b|top half|bottom half/i.test(text);
  const hasOutroundAdvancement = /outround|advancement|advance/i.test(text);
  const hasStats =
    hasChiSquare ||
    hasGovernmentOppositionAverage ||
    hasBenchAverage ||
    hasHalfAverage ||
    hasOutroundAdvancement;

  if (!hasStats && tooltips.length === 0) {
    return {};
  }

  return {
    hasChiSquare,
    hasGovernmentOppositionAverage,
    hasBenchAverage,
    hasHalfAverage,
    hasOutroundAdvancement,
    tooltips: tooltips.slice(0, 12),
  };
}

function parseStatisticsPage(source: CalicoSource, html: string): ParsedCalicoMotion[] {
  const h4Matches = [
    ...html.matchAll(/<h4\b[^>]*>([\s\S]*?)<\/h4>/gi),
  ].filter((match) => cleanText(match[1]).length > 0);

  return h4Matches
    .map((match, index) => {
      const currentEnd = match.index + match[0].length;
      const nextStart = h4Matches[index + 1]?.index ?? html.length;
      const blockHtml = html.slice(currentEnd, nextStart);
      const { motionText, sourceTag } = stripMotionTag(match[1]);

      return {
        sourceSlug: source.slug,
        tournamentName: source.tournamentName,
        sourceUrl: source.url,
        sourcePageType: source.pageType,
        sourceMotionIndex: index + 1,
        roundLabel: findLastRoundBadge(html, match.index),
        stageLabel: null,
        sourceTag,
        infoSlide: extractInfoSlide(blockHtml),
        stats: extractStats(blockHtml),
        rawMotionText: motionText,
      };
    })
    .filter((motion) => motion.rawMotionText.length > 0);
}

function parseMotionListPage(source: CalicoSource, html: string): ParsedCalicoMotion[] {
  const motionMatches = [
    ...html.matchAll(
      /<div\b(?=[^>]*class=["'][^"']*\bmr-auto\b)(?=[^>]*class=["'][^"']*\bpr-3\b)(?=[^>]*class=["'][^"']*\blead\b)[^>]*>([\s\S]*?)<\/div>/gi
    ),
  ].filter((match) => cleanText(match[1]).length > 0);

  return motionMatches.map((match, index) => {
    const currentEnd = match.index + match[0].length;
    const nextStart = motionMatches[index + 1]?.index ?? html.length;
    const blockHtml = html.slice(currentEnd, nextStart);

    return {
      sourceSlug: source.slug,
      tournamentName: source.tournamentName,
      sourceUrl: source.url,
      sourcePageType: source.pageType,
      sourceMotionIndex: index + 1,
      roundLabel: findLastCardTitle(html, match.index),
      stageLabel: null,
      sourceTag: null,
      infoSlide: extractInfoSlide(blockHtml),
      stats: {},
      rawMotionText: cleanText(match[1]),
    };
  });
}

export function parseCalicoMotionPage(
  source: CalicoSource,
  html: string
): ParsedCalicoMotion[] {
  return source.pageType === "statistics"
    ? parseStatisticsPage(source, html)
    : parseMotionListPage(source, html);
}

export function normalizeMotionTitle(title: string): string {
  return cleanText(title)
    .normalize("NFC")
    .toLowerCase()
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function hashMotionTitle(title: string): string {
  return createHash("sha256").update(normalizeMotionTitle(title)).digest("hex");
}

function hashRawMotion(title: string): string {
  return createHash("sha256").update(cleanText(title).normalize("NFC")).digest("hex");
}

export function detectMotionLanguage(title: string): PracticeLanguage {
  const normalized = cleanText(title).toLowerCase();
  return VIETNAMESE_CHARACTERS.test(normalized) || VIETNAMESE_WORDS.test(normalized)
    ? "vi"
    : "en";
}

export function inferCategoryKey(
  title: string,
  sourceTag: string | null,
  language: PracticeLanguage
): CategoryKey {
  const tag = sourceTag ?? "";
  const combined = `${tag} ${title}`;

  for (const [categoryKey, pattern] of SOURCE_TAG_KEYWORDS) {
    if (pattern.test(tag)) {
      return categoryKey;
    }
  }

  for (const [categoryKey, pattern] of TITLE_CATEGORY_KEYWORDS) {
    if (pattern.test(combined)) {
      return categoryKey;
    }
  }

  return language === "vi" ? "vietnam" : "society";
}

export function inferDifficulty(
  motion: ParsedCalicoMotion,
  title: string
): Difficulty {
  const combined = `${motion.roundLabel ?? ""} ${title}`.toLowerCase();

  if (/final|semi|quarter|octo|advanced|round 7|round 8|round 9|round 10/.test(combined)) {
    return "advanced";
  }

  if (/round 1|round 2|novice|preliminary|prelim/.test(combined)) {
    return "beginner";
  }

  return "intermediate";
}

export function buildCalicoImportPlan(
  occurrences: ParsedCalicoMotion[]
): CalicoImportPlan {
  const topicsByKey = new Map<string, CalicoTopicImport>();
  const skipped: CalicoImportPlan["skipped"] = [];

  for (const occurrence of occurrences) {
    const title = cleanText(occurrence.rawMotionText);
    if (title.length === 0) {
      skipped.push({
        sourceSlug: occurrence.sourceSlug,
        reason: "empty_motion",
        rawMotionText: occurrence.rawMotionText,
      });
      continue;
    }

    const language = detectMotionLanguage(title);
    const normalizedTitleHash = hashMotionTitle(title);
    const topicKey = `calico-${language}-${normalizedTitleHash.slice(0, 16)}`;
    const rawMotionHash = hashRawMotion(title);
    const topicSource: CalicoTopicSourceImport = {
      ...occurrence,
      topicKey,
      sourceLanguage: language,
      rawMotionHash,
      rawMotionText: title,
    };

    let topic = topicsByKey.get(`${language}:${normalizedTitleHash}`);
    if (!topic) {
      topic = {
        topicKey,
        title,
        language,
        categoryKey: inferCategoryKey(title, occurrence.sourceTag, language),
        difficulty: inferDifficulty(occurrence, title),
        normalizedTitleHash,
        displayOrder: topicsByKey.size + 1,
        context: occurrence.infoSlide,
        sourceTags: [],
        tournamentSlugs: [],
        sources: [],
      };
      topicsByKey.set(`${language}:${normalizedTitleHash}`, topic);
    }

    if (occurrence.sourceTag && !topic.sourceTags.includes(occurrence.sourceTag)) {
      topic.sourceTags.push(occurrence.sourceTag);
    }

    if (!topic.tournamentSlugs.includes(occurrence.sourceSlug)) {
      topic.tournamentSlugs.push(occurrence.sourceSlug);
    }

    if (!topic.context && occurrence.infoSlide) {
      topic.context = occurrence.infoSlide;
    }

    topic.sources.push(topicSource);
  }

  const topics = [...topicsByKey.values()];
  return {
    topics,
    sources: topics.flatMap((topic) => topic.sources),
    occurrences,
    skipped,
  };
}

async function fetchSource(source: CalicoSource): Promise<ParsedCalicoMotion[]> {
  const response = await fetch(source.url, {
    headers: {
      "user-agent": "DebateLab motion importer/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${source.slug}: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  return parseCalicoMotionPage(source, html);
}

function printPlanSummary(plan: CalicoImportPlan) {
  const occurrenceCountByLanguage = plan.sources.reduce<Record<PracticeLanguage, number>>(
    (counts, source) => {
      counts[source.sourceLanguage] += 1;
      return counts;
    },
    { en: 0, vi: 0 }
  );
  const topicCountByLanguage = plan.topics.reduce<Record<PracticeLanguage, number>>(
    (counts, topic) => {
      counts[topic.language] += 1;
      return counts;
    },
    { en: 0, vi: 0 }
  );
  const duplicateMergeCount = plan.sources.length - plan.topics.length;
  const infoSlideCount = plan.sources.filter((source) => source.infoSlide).length;
  const statsCount = plan.sources.filter(
    (source) => Object.keys(source.stats).length > 0
  ).length;

  console.log(
    JSON.stringify(
      {
        occurrences: plan.occurrences.length,
        uniqueTopics: plan.topics.length,
        duplicateMergeCount,
        occurrenceCountByLanguage,
        topicCountByLanguage,
        infoSlideCount,
        statsCount,
        skipped: plan.skipped.length,
      },
      null,
      2
    )
  );
}

async function applyImport(plan: CalicoImportPlan) {
  loadEnvConfig(process.cwd());
  loadEnvConfig(path.join(process.cwd(), "apps/web"));

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: process.env.CALICO_IMPORT_SECRET
      ? {
          headers: {
            "x-calico-import-secret": process.env.CALICO_IMPORT_SECRET,
          },
        }
      : undefined,
  });

  const topicRows = plan.topics.map((topic) => ({
    topic_key: topic.topicKey,
    category_key: topic.categoryKey,
    difficulty: topic.difficulty,
    display_order: topic.displayOrder,
    is_active: true,
    source_kind: "calico",
    source_language: topic.language,
    normalized_title_hash: topic.normalizedTitleHash,
    metadata: {
      importedFrom: "calico",
      sourceTags: topic.sourceTags,
      tournamentSlugs: topic.tournamentSlugs,
      sourceOccurrenceCount: topic.sources.length,
      firstSourceUrl: topic.sources[0]?.sourceUrl ?? null,
    },
  }));

  const translationRows = plan.topics.map((topic) => ({
    topic_key: topic.topicKey,
    language: topic.language,
    title: topic.title,
    context: topic.context,
    suggested_points: {},
  }));

  const sourceRows = plan.sources.map((source) => ({
    topic_key: source.topicKey,
    source_slug: source.sourceSlug,
    tournament_name: source.tournamentName,
    source_url: source.sourceUrl,
    source_page_type: source.sourcePageType,
    source_language: source.sourceLanguage,
    source_motion_index: source.sourceMotionIndex,
    round_label: source.roundLabel,
    stage_label: source.stageLabel,
    source_tag: source.sourceTag,
    info_slide: source.infoSlide,
    stats: source.stats,
    raw_motion_text: source.rawMotionText,
    raw_motion_hash: source.rawMotionHash,
  }));

  const { error: legacyUpdateError } = await admin
    .from("practice_topics")
    .update({ source_kind: "legacy", is_active: false })
    .neq("source_kind", "calico");
  if (legacyUpdateError) throw new Error(legacyUpdateError.message);

  const { error: topicError } = await admin
    .from("practice_topics")
    .upsert(topicRows, { onConflict: "topic_key" });
  if (topicError) throw new Error(topicError.message);

  const { error: translationError } = await admin
    .from("practice_topic_translations")
    .upsert(translationRows, { onConflict: "topic_key,language" });
  if (translationError) throw new Error(translationError.message);

  const { error: sourceError } = await admin
    .from("practice_topic_sources")
    .upsert(sourceRows, {
      onConflict: "source_slug,source_motion_index,raw_motion_hash",
    });
  if (sourceError) throw new Error(sourceError.message);

  const { data: activeRows, error: activeError } = await admin
    .from("active_practice_topic_catalog")
    .select("topic_key, language, source_kind", { count: "exact" })
    .eq("source_kind", "calico");
  if (activeError) throw new Error(activeError.message);

  console.log(
    JSON.stringify(
      {
        applied: true,
        importedTopics: topicRows.length,
        importedSources: sourceRows.length,
        activeCatalogRows: activeRows?.length ?? 0,
      },
      null,
      2
    )
  );
}

function parseArgs(argv: string[]) {
  const args = new Set(argv);
  const sourceArg = argv.find((arg) => arg.startsWith("--source="));
  const emitSqlArg = argv.find((arg) => arg.startsWith("--emit-sql="));

  return {
    apply: args.has("--apply"),
    emitSql: emitSqlArg
      ? (emitSqlArg.slice("--emit-sql=".length) as EmitSqlTarget)
      : null,
    sources: sourceArg
      ? new Set(sourceArg.slice("--source=".length).split(",").filter(Boolean))
      : null,
  };
}

function jsonbExpression(rows: unknown[]) {
  const encoded = Buffer.from(JSON.stringify(rows), "utf8").toString("base64");
  return `convert_from(decode('${encoded}', 'base64'), 'UTF8')::jsonb`;
}

function buildTopicRows(plan: CalicoImportPlan) {
  return plan.topics.map((topic) => ({
    topic_key: topic.topicKey,
    category_key: topic.categoryKey,
    difficulty: topic.difficulty,
    display_order: topic.displayOrder,
    is_active: true,
    source_kind: "calico",
    source_language: topic.language,
    normalized_title_hash: topic.normalizedTitleHash,
    metadata: {
      importedFrom: "calico",
      sourceTags: topic.sourceTags,
      tournamentSlugs: topic.tournamentSlugs,
      sourceOccurrenceCount: topic.sources.length,
      firstSourceUrl: topic.sources[0]?.sourceUrl ?? null,
    },
  }));
}

function buildTranslationRows(plan: CalicoImportPlan) {
  return plan.topics.map((topic) => ({
    topic_key: topic.topicKey,
    language: topic.language,
    title: topic.title,
    context: topic.context,
    suggested_points: {},
  }));
}

function buildSourceRows(plan: CalicoImportPlan, sourceSlug?: string) {
  return plan.sources
    .filter((source) => !sourceSlug || source.sourceSlug === sourceSlug)
    .map((source) => ({
      topic_key: source.topicKey,
      source_slug: source.sourceSlug,
      tournament_name: source.tournamentName,
      source_url: source.sourceUrl,
      source_page_type: source.sourcePageType,
      source_language: source.sourceLanguage,
      source_motion_index: source.sourceMotionIndex,
      round_label: source.roundLabel,
      stage_label: source.stageLabel,
      source_tag: source.sourceTag,
      info_slide: source.infoSlide,
      stats: source.stats,
      raw_motion_text: source.rawMotionText,
      raw_motion_hash: source.rawMotionHash,
    }));
}

function buildSqlForTarget(plan: CalicoImportPlan, target: EmitSqlTarget) {
  if (target === "legacy") {
    return `
update public.practice_topics
set source_kind = 'legacy',
    is_active = false,
    updated_at = now()
where source_kind <> 'calico';
`.trim();
  }

  if (target === "topics") {
    return `
with rows as (
  select *
  from jsonb_to_recordset(${jsonbExpression(buildTopicRows(plan))})
    as x(
      topic_key text,
      category_key text,
      difficulty text,
      display_order integer,
      is_active boolean,
      source_kind text,
      source_language text,
      normalized_title_hash text,
      metadata jsonb
    )
)
insert into public.practice_topics (
  topic_key,
  category_key,
  difficulty,
  display_order,
  is_active,
  source_kind,
  source_language,
  normalized_title_hash,
  metadata
)
select
  topic_key,
  category_key,
  difficulty,
  display_order,
  is_active,
  source_kind,
  source_language,
  normalized_title_hash,
  metadata
from rows
on conflict (topic_key) do update
set category_key = excluded.category_key,
    difficulty = excluded.difficulty,
    display_order = excluded.display_order,
    is_active = excluded.is_active,
    source_kind = excluded.source_kind,
    source_language = excluded.source_language,
    normalized_title_hash = excluded.normalized_title_hash,
    metadata = excluded.metadata,
    updated_at = now();
`.trim();
  }

  if (target === "translations") {
    return `
with rows as (
  select *
  from jsonb_to_recordset(${jsonbExpression(buildTranslationRows(plan))})
    as x(
      topic_key text,
      language text,
      title text,
      context text,
      suggested_points jsonb
    )
)
insert into public.practice_topic_translations (
  topic_key,
  language,
  title,
  context,
  suggested_points
)
select
  topic_key,
  language,
  title,
  context,
  suggested_points
from rows
on conflict (topic_key, language) do update
set title = excluded.title,
    context = excluded.context,
    suggested_points = excluded.suggested_points,
    updated_at = now();
`.trim();
  }

  const sourceSlug = target.startsWith("sources:")
    ? target.slice("sources:".length)
    : undefined;
  const sourceRows = buildSourceRows(plan, sourceSlug);

  return `
with rows as (
  select *
  from jsonb_to_recordset(${jsonbExpression(sourceRows)})
    as x(
      topic_key text,
      source_slug text,
      tournament_name text,
      source_url text,
      source_page_type text,
      source_language text,
      source_motion_index integer,
      round_label text,
      stage_label text,
      source_tag text,
      info_slide text,
      stats jsonb,
      raw_motion_text text,
      raw_motion_hash text
    )
)
insert into public.practice_topic_sources (
  topic_key,
  source_slug,
  tournament_name,
  source_url,
  source_page_type,
  source_language,
  source_motion_index,
  round_label,
  stage_label,
  source_tag,
  info_slide,
  stats,
  raw_motion_text,
  raw_motion_hash
)
select
  topic_key,
  source_slug,
  tournament_name,
  source_url,
  source_page_type,
  source_language,
  source_motion_index,
  round_label,
  stage_label,
  source_tag,
  info_slide,
  stats,
  raw_motion_text,
  raw_motion_hash
from rows
on conflict (source_slug, source_motion_index, raw_motion_hash) do update
set topic_key = excluded.topic_key,
    tournament_name = excluded.tournament_name,
    source_url = excluded.source_url,
    source_page_type = excluded.source_page_type,
    source_language = excluded.source_language,
    round_label = excluded.round_label,
    stage_label = excluded.stage_label,
    source_tag = excluded.source_tag,
    info_slide = excluded.info_slide,
    stats = excluded.stats,
    raw_motion_text = excluded.raw_motion_text,
    updated_at = now();
`.trim();
}

export async function runCalicoMotionImport(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const sources = args.sources
    ? CALICO_SOURCES.filter((source) => args.sources?.has(source.slug))
    : CALICO_SOURCES;

  if (sources.length === 0) {
    throw new Error("No Calico sources matched the provided --source filter.");
  }

  const occurrences = (await Promise.all(sources.map(fetchSource))).flat();
  const plan = buildCalicoImportPlan(occurrences);
  if (args.emitSql) {
    console.log(buildSqlForTarget(plan, args.emitSql));
    return plan;
  }

  printPlanSummary(plan);

  if (!args.apply) {
    console.log("Dry run complete. Re-run with --apply to write to Supabase.");
    return plan;
  }

  await applyImport(plan);
  return plan;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  runCalicoMotionImport().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
