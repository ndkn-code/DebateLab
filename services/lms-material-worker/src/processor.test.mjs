import assert from 'node:assert/strict';
import test from 'node:test';
import { processMaterialVersion } from './processor.mjs';

function fixture(overrides = {}) {
  let version = { id: 'qa-version', processing_status: 'queued', processing_attempts: 0, original_path: null, purpose: 'material', ...overrides };
  let conversions = 0;
  const supabase = { from(table) {
    assert.equal(table, 'lms_material_versions');
    let patch;
    const query = {
      select() { return query; }, eq() { return query; }, in() { return query; }, or() { return query; },
      update(value) { patch = value; return query; },
      async maybeSingle() { if (patch) version = { ...version, ...patch }; return { data: { ...version }, error: null }; },
      then(resolve, reject) { if (patch) version = { ...version, ...patch }; return Promise.resolve({ error: null }).then(resolve, reject); },
    };
    return query;
  } };
  return { deps: { supabase, convert: async () => { conversions++; throw Error('Unexpected conversion'); } }, read: () => version, conversions: () => conversions };
}

test('missing finalized original releases its lease and records a retryable failure', async () => {
  const f = fixture();
  await assert.rejects(processMaterialVersion('qa-version', f.deps), /original path is missing/);
  assert.equal(f.read().processing_status, 'queued');
  assert.equal(f.read().lease_token, null);
  assert.equal(f.read().lease_expires_at, null);
  assert.equal(f.read().processing_attempts, 1);
  assert.equal(f.read().error_code, 'CONVERSION_FAILED');
  assert.equal(f.conversions(), 0);
});

test('malformed input becomes terminal at the retry limit and duplicate delivery is acknowledged', async () => {
  const f = fixture({ processing_attempts: 4 });
  assert.equal(await processMaterialVersion('qa-version', f.deps), 'failed');
  assert.equal(f.read().processing_status, 'failed');
  assert.equal(f.read().lease_token, null);
  assert.equal(await processMaterialVersion('qa-version', f.deps), 'skipped');
  assert.equal(f.read().processing_attempts, 5);
  assert.equal(f.conversions(), 0);
});
