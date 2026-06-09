import { AdminUiShowcasePage } from "@/components/admin/ui-showcase/AdminUiShowcasePage";
import {
  DEFAULT_SHOWCASE_SCENARIO_ID,
  SHOWCASE_SCENARIOS,
  getDefaultScenarioForSurface,
  getShowcaseScenario,
  isShowcaseSurface,
} from "@/lib/admin-ui-showcase/scenarios";
import type {
  ShowcaseCoverageRow,
  ShowcaseScenarioId,
} from "@/lib/admin-ui-showcase/types";
import { createClient } from "@/lib/supabase/server";
import type { SessionReviewTab } from "@/components/feedback/session-review-shell";

export const metadata = { title: "Admin - UI Showcase" };
export const dynamic = "force-dynamic";

const COVERAGE_TABLES = [
  "practice_attempts",
  "analysis_jobs",
  "debate_duels",
] as const;

const REVIEW_TABS = ["overall", "verdict", "transcript", "clash"] as const;

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function isReviewTab(value: string | undefined): value is SessionReviewTab {
  return REVIEW_TABS.some((tab) => tab === value);
}

async function getCoverageRows(): Promise<ShowcaseCoverageRow[]> {
  const supabase = await createClient();
  const tableResults = await Promise.all(
    COVERAGE_TABLES.map(async (tableName) => {
      const { data, error } = await supabase
        .from(tableName)
        .select("status")
        .limit(5000);

      if (error) {
        return [] as ShowcaseCoverageRow[];
      }

      const counts = new Map<string, number>();
      for (const row of (data ?? []) as Array<{ status: string | null }>) {
        const status = row.status?.trim() || "unknown";
        counts.set(status, (counts.get(status) ?? 0) + 1);
      }

      return Array.from(counts.entries()).map(([status, count]) => ({
        tableName,
        status,
        count,
      }));
    })
  );

  return tableResults.flat();
}

export default async function AdminUiShowcaseRoute({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const requestedSurface = firstParam(query.surface);
  const requestedState = firstParam(query.state);
  const requestedTab = firstParam(query.tab);
  const initialSurface = isShowcaseSurface(requestedSurface)
    ? requestedSurface
    : "practice";
  const scenario = requestedState
    ? getShowcaseScenario(requestedState)
    : getDefaultScenarioForSurface(initialSurface);
  const resolvedScenario =
    SHOWCASE_SCENARIOS.some((item) => item.id === scenario.id)
      ? scenario
      : getShowcaseScenario(DEFAULT_SHOWCASE_SCENARIO_ID);
  const initialTab = isReviewTab(requestedTab)
    ? requestedTab
    : resolvedScenario.defaultTab;
  const coverageRows = await getCoverageRows();

  return (
    <AdminUiShowcasePage
      initialScenarioId={resolvedScenario.id as ShowcaseScenarioId}
      initialSurface={resolvedScenario.surface}
      initialTab={initialTab}
      coverageRows={coverageRows}
    />
  );
}
