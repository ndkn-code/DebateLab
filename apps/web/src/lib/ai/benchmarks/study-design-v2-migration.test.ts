import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL(
    "../../../../../../supabase/migrations/20260902130000_ielts_benchmark_study_design_v2.sql",
    import.meta.url,
  ),
  "utf8",
);

assert.match(migration, /studyDesignVersion' is distinct from '2'/);
assert.match(migration, /tg_op = 'UPDATE'/i);
assert.match(migration, /new\.metadata is not distinct from old\.metadata/i);
assert.match(migration, /old\.metadata ->> 'studyDesignVersion' = '1'/);
assert.doesNotMatch(migration, /update\s+public\.ai_grading_benchmarks/i);
assert.doesNotMatch(migration, /delete\s+from\s+public\.ai_grading_benchmarks/i);
assert.match(
  migration,
  /create or replace function private\.validate_ielts_benchmark_study_row\(\)/,
);

console.log("IELTS benchmark study-design V2 migration tests passed");
