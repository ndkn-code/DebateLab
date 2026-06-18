/**
 * Typed-score-columns gate (WS-0.1). Structured score data must use typed
 * columns (numeric / typed composite), never untyped `json`/`jsonb`.
 *
 * Flags any column whose name contains `score` or `band` declared as
 * `json`/`jsonb` in a migration.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export interface ScoreColumnViolation {
  file: string;
  line: number;
  column: string;
  text: string;
}

const SCORE_JSON = /\b(\w*(?:score|band)\w*)\s+(jsonb?|json)\b/i;

// Pre-existing columns that are legitimately flexible Json maps (NOT IELTS band
// scores). Keyed by `file:column`. WS-0.1 baseline; this list only shrinks.
export const ALLOWLIST = new Set<string>([
  // grandfathered: Club OS per-skill performance map, not an IELTS band score.
  "020_club_os_v1.sql:skill_scores",
  // grandfathered: Club OS manual point-adjustment map, not an IELTS band score.
  "020_club_os_v1.sql:score_adjustments",
]);

export function findUntypedScoreColumns(
  migrationsDir: string,
): ScoreColumnViolation[] {
  const violations: ScoreColumnViolation[] = [];
  for (const file of readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    const lines = readFileSync(path.join(migrationsDir, file), "utf8").split(
      /\r?\n/,
    );
    lines.forEach((text, i) => {
      const m = text.match(SCORE_JSON);
      if (m) {
        violations.push({ file, line: i + 1, column: m[1], text: text.trim() });
      }
    });
  }
  return violations;
}

function isMain(): boolean {
  return (
    !!process.argv[1] &&
    import.meta.url === pathToFileURL(process.argv[1]).href
  );
}

if (isMain()) {
  const dir = path.join(process.cwd(), "supabase/migrations");
  const violations = findUntypedScoreColumns(dir).filter(
    (v) => !ALLOWLIST.has(`${v.file}:${v.column}`),
  );
  if (violations.length > 0) {
    console.error(
      `Typed score columns: ${violations.length} untyped Json score/band column(s):`,
    );
    for (const v of violations) {
      console.error(`  - ${v.file}:${v.line} (${v.column}) :: ${v.text}`);
    }
    console.error(
      "\nUse typed columns for scores (numeric / typed composite), not json/jsonb.",
    );
    process.exit(1);
  }
  console.log("Typed score columns: no untyped Json score/band columns found.");
}
