import assert from "node:assert/strict";
import test from "node:test";
import { pendingMigrationNames } from "./preflight-db-core";

test("extracts unique migration filenames from Supabase dry-run output", () => {
  assert.deepEqual(
    pendingMigrationNames(
      [
        "DRY RUN: migrations that would be applied:",
        "  20260830070000_chat_product_context.sql",
        "  supabase/migrations/20260830070000_chat_product_context.sql",
        "  20260830120000_lms-material-release.sql",
      ].join("\n"),
    ),
    [
      "20260830070000_chat_product_context.sql",
      "20260830120000_lms-material-release.sql",
    ],
  );
});

test("does not report an up-to-date dry run", () => {
  assert.deepEqual(
    pendingMigrationNames("Remote database is up to date."),
    [],
  );
});
