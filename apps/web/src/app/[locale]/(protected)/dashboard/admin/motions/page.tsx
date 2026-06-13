import {
  BarChart3,
  FileSearch,
  Globe2,
  Layers3,
  ListChecks,
} from "@/components/ui/icons";
import { createClient } from "@/lib/supabase/server";
import { tryCreateAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "Admin - Motions" };

type TopicRow = {
  topic_key: string;
  category_key: string;
  difficulty: string;
  is_active: boolean;
  source_kind: "legacy" | "calico";
  source_language: "en" | "vi" | null;
  metadata: Record<string, unknown> | null;
};

type TranslationRow = {
  topic_key: string;
  language: "en" | "vi";
  title: string;
};

type SourceRow = {
  topic_key: string;
  source_slug: string;
  tournament_name: string;
  source_language: "en" | "vi";
  source_tag: string | null;
  info_slide: string | null;
  stats: Record<string, unknown> | null;
};

function countBy<T extends string>(
  rows: T[]
): Array<{ key: T; count: number }> {
  const counts = rows.reduce<Map<T, number>>((map, key) => {
    map.set(key, (map.get(key) ?? 0) + 1);
    return map;
  }, new Map());

  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((left, right) => right.count - left.count);
}

function hasStats(stats: Record<string, unknown> | null) {
  return Boolean(stats && Object.keys(stats).length > 0);
}

function formatPercent(count: number, total: number) {
  if (total === 0) return "0%";
  return `${Math.round((count / total) * 100)}%`;
}

function StatCard({
  icon,
  label,
  value,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  detail?: string;
}) {
  return (
    <div className="rounded-[24px] border border-outline-variant/15 bg-surface p-5 shadow-token-card">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        {icon}
      </div>
      <div className="mt-4 text-3xl font-bold text-on-surface">{value}</div>
      <div className="mt-1 text-sm font-medium text-on-surface-variant">
        {label}
      </div>
      {detail ? (
        <div className="mt-3 text-xs leading-5 text-on-surface-variant">
          {detail}
        </div>
      ) : null}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[28px] border border-outline-variant/15 bg-surface p-5 shadow-token-card">
      <h2 className="text-xl font-bold text-on-surface">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export default async function AdminMotionsPage() {
  const admin = tryCreateAdminClient();
  const supabase = admin ?? (await createClient());

  const [topicsRes, translationsRes, sourcesRes] = await Promise.all([
    supabase
      .from("practice_topics")
      .select(
        "topic_key, category_key, difficulty, is_active, source_kind, source_language, metadata"
      ),
    supabase
      .from("practice_topic_translations")
      .select("topic_key, language, title"),
    supabase
      .from("practice_topic_sources")
      .select(
        "topic_key, source_slug, tournament_name, source_language, source_tag, info_slide, stats"
      ),
  ]);

  const topics = (topicsRes.data ?? []) as TopicRow[];
  const translations = (translationsRes.data ?? []) as TranslationRow[];
  const sources = (sourcesRes.data ?? []) as SourceRow[];
  const activeTopics = topics.filter((topic) => topic.is_active);
  const hiddenTopics = topics.filter((topic) => !topic.is_active);
  const importedTopics = topics.filter((topic) => topic.source_kind === "calico");
  const legacyTopics = topics.filter((topic) => topic.source_kind === "legacy");
  const activeImportedTopics = importedTopics.filter((topic) => topic.is_active);
  const legacyHiddenCount = legacyTopics.filter((topic) => !topic.is_active).length;
  const englishImported = activeImportedTopics.filter(
    (topic) => topic.source_language === "en"
  ).length;
  const vietnameseImported = activeImportedTopics.filter(
    (topic) => topic.source_language === "vi"
  ).length;
  const sourcesByTopic = sources.reduce<Map<string, SourceRow[]>>((map, source) => {
    map.set(source.topic_key, [...(map.get(source.topic_key) ?? []), source]);
    return map;
  }, new Map());
  const duplicateMergedTopics = [...sourcesByTopic.values()].filter(
    (topicSources) => topicSources.length > 1
  );
  const duplicateExtraOccurrences = duplicateMergedTopics.reduce(
    (total, topicSources) => total + topicSources.length - 1,
    0
  );
  const sourceCoverage = [...sources.reduce<Map<string, SourceRow[]>>((map, source) => {
    map.set(source.source_slug, [...(map.get(source.source_slug) ?? []), source]);
    return map;
  }, new Map())]
    .map(([sourceSlug, sourceRows]) => ({
      sourceSlug,
      tournamentName: sourceRows[0]?.tournament_name ?? sourceSlug,
      occurrences: sourceRows.length,
      topics: new Set(sourceRows.map((row) => row.topic_key)).size,
      infoSlides: sourceRows.filter((row) => row.info_slide?.trim()).length,
      stats: sourceRows.filter((row) => hasStats(row.stats)).length,
    }))
    .sort((left, right) => left.tournamentName.localeCompare(right.tournamentName));
  const categoryCounts = countBy(
    activeImportedTopics.map((topic) => topic.category_key)
  );
  const difficultyCounts = countBy(
    activeImportedTopics.map((topic) => topic.difficulty)
  );
  const sourceTagCounts = countBy(
    sources
      .map((source) => source.source_tag?.trim())
      .filter((tag): tag is string => Boolean(tag))
  ).slice(0, 8);
  const infoSlideCount = sources.filter((source) => source.info_slide?.trim()).length;
  const statsCount = sources.filter((source) => hasStats(source.stats)).length;
  const missingTranslationRows = activeImportedTopics.filter(
    (topic) =>
      !translations.some(
        (translation) =>
          translation.topic_key === topic.topic_key &&
          translation.language === topic.source_language
      )
  );

  return (
    <div className="min-h-full bg-background px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-outline-variant/15 bg-surface px-3 py-1 type-eyebrow text-primary">
            <FileSearch className="h-4 w-4" />
            Motion catalog
          </div>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-on-surface">
            Calico motion import
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-on-surface-variant">
            Source coverage, visibility state, and tournament metadata for the
            active practice catalog.
          </p>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={<ListChecks className="h-5 w-5" />}
            label="Active imported motions"
            value={activeImportedTopics.length}
            detail={`${englishImported} English, ${vietnameseImported} Vietnamese`}
          />
          <StatCard
            icon={<Layers3 className="h-5 w-5" />}
            label="Hidden legacy motions"
            value={legacyHiddenCount}
            detail={`${legacyTopics.length} legacy rows retained`}
          />
          <StatCard
            icon={<Globe2 className="h-5 w-5" />}
            label="Source occurrences"
            value={sources.length}
            detail={`${sourceCoverage.length} tournament sources`}
          />
          <StatCard
            icon={<BarChart3 className="h-5 w-5" />}
            label="Merged duplicates"
            value={duplicateExtraOccurrences}
            detail={`${duplicateMergedTopics.length} visible topics with multiple sources`}
          />
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <Section title="Source Coverage">
            <div className="overflow-hidden rounded-[20px] border border-outline-variant/12">
              <table className="w-full text-left text-sm">
                <thead className="bg-surface-container-low type-eyebrow text-on-surface-variant">
                  <tr>
                    <th className="px-4 py-3">Tournament</th>
                    <th className="px-4 py-3">Occurrences</th>
                    <th className="px-4 py-3">Topics</th>
                    <th className="px-4 py-3">Info</th>
                    <th className="px-4 py-3">Stats</th>
                  </tr>
                </thead>
                <tbody>
                  {sourceCoverage.map((source) => (
                    <tr
                      key={source.sourceSlug}
                      className="border-t border-outline-variant/10"
                    >
                      <td className="px-4 py-3 font-semibold text-on-surface">
                        {source.tournamentName}
                      </td>
                      <td className="px-4 py-3 text-on-surface-variant">
                        {source.occurrences}
                      </td>
                      <td className="px-4 py-3 text-on-surface-variant">
                        {source.topics}
                      </td>
                      <td className="px-4 py-3 text-on-surface-variant">
                        {formatPercent(source.infoSlides, source.occurrences)}
                      </td>
                      <td className="px-4 py-3 text-on-surface-variant">
                        {formatPercent(source.stats, source.occurrences)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section title="Catalog Health">
            <div className="grid gap-3">
              {[
                ["Active total", activeTopics.length],
                ["Hidden total", hiddenTopics.length],
                ["Imported active", activeImportedTopics.length],
                ["Info slide coverage", formatPercent(infoSlideCount, sources.length)],
                ["Stats availability", formatPercent(statsCount, sources.length)],
                ["Translation gaps", missingTranslationRows.length],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-center justify-between rounded-[18px] bg-surface-container-low px-4 py-3"
                >
                  <span className="text-sm font-medium text-on-surface-variant">
                    {label}
                  </span>
                  <span className="text-sm font-bold text-on-surface">{value}</span>
                </div>
              ))}
            </div>
          </Section>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <Section title="Categories">
            <div className="space-y-3">
              {categoryCounts.map((category) => (
                <div
                  key={category.key}
                  className="flex items-center justify-between rounded-[18px] bg-surface-container-low px-4 py-3 text-sm"
                >
                  <span className="font-medium capitalize text-on-surface">
                    {category.key}
                  </span>
                  <span className="font-bold text-primary">{category.count}</span>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Difficulty">
            <div className="space-y-3">
              {difficultyCounts.map((difficulty) => (
                <div
                  key={difficulty.key}
                  className="flex items-center justify-between rounded-[18px] bg-surface-container-low px-4 py-3 text-sm"
                >
                  <span className="font-medium capitalize text-on-surface">
                    {difficulty.key}
                  </span>
                  <span className="font-bold text-primary">{difficulty.count}</span>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Top Source Tags">
            <div className="space-y-3">
              {sourceTagCounts.length === 0 ? (
                <div className="rounded-[18px] bg-surface-container-low px-4 py-3 text-sm text-on-surface-variant">
                  No source tags imported.
                </div>
              ) : (
                sourceTagCounts.map((tag) => (
                  <div
                    key={tag.key}
                    className="flex items-center justify-between rounded-[18px] bg-surface-container-low px-4 py-3 text-sm"
                  >
                    <span className="min-w-0 truncate font-medium text-on-surface">
                      {tag.key}
                    </span>
                    <span className="ml-4 font-bold text-primary">{tag.count}</span>
                  </div>
                ))
              )}
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
