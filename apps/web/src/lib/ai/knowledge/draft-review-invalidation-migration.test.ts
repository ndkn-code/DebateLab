import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

const invalidationMigration = readFileSync(
  resolve(
    process.cwd(),
    "../../supabase/migrations/20260902110000_ai_knowledge_draft_review_invalidation.sql",
  ),
  "utf8",
);
const operationsMigration = readFileSync(
  resolve(
    process.cwd(),
    "../../supabase/migrations/20260829120000_ai_knowledge_operations.sql",
  ),
  "utf8",
);

function triggerColumns(triggerName: string): string {
  const match = invalidationMigration.match(
    new RegExp(
      `create trigger ${triggerName}\\s+before update of([\\s\\S]*?)\\s+on public\\.ai_knowledge_`,
    ),
  );
  assert.ok(match?.[1], `${triggerName} must declare its guarded columns`);
  return match[1];
}

test("source provenance changes invalidate source and dependent draft-item review", () => {
  const columns = triggerColumns("invalidate_ai_knowledge_draft_source_review");
  for (const column of [
    "id",
    "canonical_url",
    "publisher",
    "title",
    "authority_tier",
    "rights_status",
    "checksum",
    "captured_at",
    "metadata",
    "submitted_by",
  ]) {
    assert.match(columns, new RegExp(`\\b${column}\\b`));
    assert.match(
      invalidationMigration,
      new RegExp(`new\\.${column} is not distinct from old\\.${column}`),
    );
  }
  assert.match(
    invalidationMigration,
    /update public\.ai_knowledge_items item[\s\S]*item\.source_id = old\.id[\s\S]*version\.status = 'draft'/,
  );
  assert.match(
    invalidationMigration,
    /new\.review_status := 'needs_review';\s*new\.reviewed_by := null;\s*new\.reviewed_at := null;/,
  );
});

test("independent source review can atomically clear rights and approve", () => {
  assert.match(
    invalidationMigration,
    /v_atomic_classification_review :=[\s\S]*new\.reviewed_at is distinct from old\.reviewed_at[\s\S]*new\.rights_status in \([\s\S]*'approved_for_derived_use'/,
  );
  assert.match(
    invalidationMigration,
    /new\.submitted_by is null or new\.reviewed_by <> new\.submitted_by/,
  );
  assert.match(
    invalidationMigration,
    /if not v_atomic_classification_review then\s*new\.review_status := 'needs_review'/,
  );
  // Even an atomically re-approved source changes the evidence classification,
  // so every dependent draft item still needs its own fresh review.
  assert.match(
    invalidationMigration,
    /update public\.ai_knowledge_items item[\s\S]*review_status = 'needs_review'/,
  );
});

test("item content, purpose, band and provenance changes invalidate only draft review", () => {
  const columns = triggerColumns("invalidate_ai_knowledge_draft_item_review");
  for (const column of [
    "id",
    "collection_id",
    "source_id",
    "external_key",
    "collection_version",
    "item_kind",
    "language",
    "criterion",
    "band_min",
    "band_max",
    "task_type",
    "format",
    "source_locator",
    "permitted_excerpt",
    "structured_insight",
    "usable_for",
    "embedding_text",
    "content_hash",
    "metadata",
    "submitted_by",
  ]) {
    assert.match(columns, new RegExp(`\\b${column}\\b`));
    assert.match(
      invalidationMigration,
      new RegExp(`new\\.${column} is not distinct from old\\.${column}`),
    );
  }
  assert.match(invalidationMigration, /version\.status = 'draft'/);
  assert.match(
    invalidationMigration,
    /version\.status in \('published', 'superseded'\)[\s\S]*raise exception 'Published AI knowledge items are immutable/,
  );
});

test("approval-only updates and identical importer upserts remain valid", () => {
  const sourceColumns = triggerColumns(
    "invalidate_ai_knowledge_draft_source_review",
  );
  const itemColumns = triggerColumns("invalidate_ai_knowledge_draft_item_review");
  for (const reviewColumn of ["review_status", "reviewed_by", "reviewed_at"]) {
    assert.doesNotMatch(sourceColumns, new RegExp(`\\b${reviewColumn}\\b`));
    assert.doesNotMatch(itemColumns, new RegExp(`\\b${reviewColumn}\\b`));
  }
  assert.match(
    invalidationMigration,
    /if tg_op = 'UPDATE'[\s\S]*new\.embedding::text is not distinct from old\.embedding::text[\s\S]*return new;/,
  );
});

test("embedding mutations require fresh draft review and cannot alter published evidence", () => {
  assert.match(
    invalidationMigration,
    /after insert or update or delete on public\.ai_knowledge_embeddings/,
  );
  assert.match(
    invalidationMigration,
    /item\.review_status = 'approved'[\s\S]*item\.reviewed_by is not null[\s\S]*item\.reviewed_at is not null/,
  );
  assert.match(
    invalidationMigration,
    /version\.status in \('published', 'superseded'\)[\s\S]*raise exception 'Published AI knowledge embeddings are immutable/,
  );
});

test("approve then mutate is blocked from publication until a fresh approval", () => {
  // Mutation clears the exact fields required by the publication RPC. A
  // separate approval-only update restores them after independent review.
  assert.match(
    invalidationMigration,
    /review_status = 'needs_review',\s*reviewed_by = null,\s*reviewed_at = null/,
  );
  assert.match(
    operationsMigration,
    /item\.review_status <> 'approved'[\s\S]*source\.review_status <> 'approved'[\s\S]*item\.reviewed_by is null[\s\S]*source\.reviewed_by is null/,
  );
  assert.match(
    operationsMigration,
    /raise exception 'Draft contains unapproved, unlicensed, self-reviewed, or non-authoritative grading evidence'/,
  );
});

test("review identity is session-bound and direct authenticated mutations are revoked", () => {
  assert.match(
    invalidationMigration,
    /create or replace function public\.review_ai_knowledge_record\(/,
  );
  assert.match(invalidationMigration, /v_reviewer uuid := auth\.uid\(\)/);
  assert.match(
    invalidationMigration,
    /not private\.is_admin\(v_reviewer\)/,
  );
  assert.match(
    invalidationMigration,
    /revoke insert, update, delete on public\.ai_knowledge_sources from authenticated/,
  );
  assert.match(
    invalidationMigration,
    /grant execute on function public\.review_ai_knowledge_record\([\s\S]*to authenticated/,
  );
  assert.match(
    invalidationMigration,
    /revoke all on function public\.review_ai_knowledge_record\([\s\S]*from public, anon, service_role/,
  );
});
