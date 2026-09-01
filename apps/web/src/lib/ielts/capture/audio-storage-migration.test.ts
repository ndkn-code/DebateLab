import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const migration = readFileSync(
  join(
    process.cwd(),
    "../../supabase/migrations/20260901010000_fix_ielts_speaking_audio_upload.sql",
  ),
  "utf8",
);
const captureClient = readFileSync(
  join(process.cwd(), "src/lib/api/ielts/capture-client.ts"),
  "utf8",
);

assert.match(
  migration,
  /grant execute on function private\.can_manage_lms_material_storage\(text, text, uuid\)\s+to authenticated/i,
  "the authenticated storage policy must be allowed to execute its predicate",
);
assert.match(migration, /'audio\/wav'/);
assert.match(migration, /'audio\/x-wav'/);
assert.match(
  migration,
  /coalesce\(storage\.buckets\.allowed_mime_types, '\{\}'::text\[\]\)\s+\|\| excluded\.allowed_mime_types/i,
  "the repair must retain previously enabled mobile and web MIME types",
);
assert.match(
  captureClient,
  /contentType:\s*"audio\/wav"/,
  "the storage allowlist must cover the recorder's upload format",
);

console.log("IELTS Speaking audio storage migration contract tests passed");
