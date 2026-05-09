import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/018_speed_read_models_and_web_vitals.sql"),
  "utf8"
);

for (const functionName of [
  "get_dashboard_payload",
  "get_course_library_payload",
  "get_chat_sidebar_payload",
  "get_practice_feedback_payload",
]) {
  assert.match(migration, new RegExp(`function public\\.${functionName}\\(`));
  assert.match(migration, new RegExp(`grant execute on function public\\.${functionName}`));
}

assert.match(migration, /security invoker/g);
assert.match(migration, /auth\.uid\(\)/g);
assert.match(migration, /analytics_events_web_vitals_idx/);
assert.doesNotMatch(migration, /select to_jsonb\(p\)/);
assert.doesNotMatch(migration, /select jsonb_agg\(to_jsonb\(c\)/);
assert.match(migration, /'display_name', p\.display_name/);
assert.match(migration, /'visibility', c\.visibility/);

console.log("student read-model RPC migration fixture tests passed");
