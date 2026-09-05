import test from 'node:test';
import assert from 'node:assert/strict';
import { createGoogleStore } from './google-store.mjs';

const binding = { id: 'binding-1', club_id: 'club-1', metadata: {} };
const pdf = new TextEncoder().encode('%PDF-1.7\ncontent');
const versionOf = async (bytes) => (await import('node:crypto')).createHash('sha256').update(bytes).digest('hex');

function fakeDb({ existing = null, rpc = { data: { materialId: 'm', versionId: 'v' }, error: null }, uploadError = null } = {}) {
  const calls = { uploads: [], removals: [], rpc: [] };
  const storage = { from: (bucket) => ({ upload: async (path, bytes, options) => { calls.uploads.push({ bucket, path, bytes, options }); return { error: uploadError }; }, remove: async (paths) => { calls.removals.push({ bucket, paths }); return { error: null }; } }) };
  const db = { storage, rpc: async (name, args) => { calls.rpc.push({ name, args }); const result = typeof rpc === 'function' ? await rpc(name, args) : rpc; return result; }, from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: existing, error: null }) }) }) }) }) };
  return { db, calls };
}

test('validates bytes, uploads immutable originals, and queues with provenance', async () => {
  const version = await versionOf(pdf);
  const fake = fakeDb({ rpc: (_name, args) => ({ data: { materialId: 'm', versionId: args.p_storage_path.split('/')[2] }, error: null }) });
  const result = await createGoogleStore({ db: fake.db, binding, actorId: 'actor-1' }).storeMaterial({ fileId: 'file-1', version, metadata: { mimeType: 'application/pdf', name: 'lesson.pdf' }, bytes: pdf });
  assert.equal(result.materialId, 'm');
  assert.match(result.versionId, /^[0-9a-f-]{36}$/);
  assert.equal(fake.calls.uploads[0].bucket, 'lms-material-originals');
  assert.equal(fake.calls.uploads[0].options.contentType, 'application/pdf');
  assert.match(fake.calls.uploads[0].path, /^club-1\/[0-9a-f-]{36}\/[0-9a-f-]{36}\/google-file-1$/);
  assert.equal(fake.calls.rpc[0].args.p_metadata.storageBucket, 'lms-material-originals');
  assert.equal(fake.calls.rpc[0].args.p_metadata.detectedMimeType, 'application/pdf');
  assert.equal(fake.calls.removals.length, 0);
});

test('rejects mismatched MIME and hash before upload', async () => {
  const fake = fakeDb();
  const store = createGoogleStore({ db: fake.db, binding, actorId: 'actor-1' });
  await assert.rejects(store.storeMaterial({ fileId: 'file-1', version: '0'.repeat(64), metadata: { mimeType: 'text/plain' }, bytes: pdf }), /MIME/);
  await assert.rejects(store.storeMaterial({ fileId: 'file-1', version: '0'.repeat(64), metadata: { mimeType: 'application/pdf' }, bytes: pdf }), /hash/);
  assert.equal(fake.calls.uploads.length, 0);
});

test('cleans the original when queueing fails or loses the idempotency race', async () => {
  for (const rpc of [{ data: null, error: new Error('queue failed') }, { data: { materialId: 'm', versionId: 'other' }, error: null }]) {
    const version = await versionOf(pdf);
    const fake = fakeDb({ rpc });
    const result = createGoogleStore({ db: fake.db, binding, actorId: 'actor-1' }).storeMaterial({ fileId: 'file-1', version, metadata: { mimeType: 'application/pdf' }, bytes: pdf });
    if (rpc.error) await assert.rejects(result);
    else await result;
    assert.equal(fake.calls.removals.length, 1);
    assert.equal(fake.calls.removals[0].bucket, 'lms-material-originals');
  }
});

test('unchanged versions remain idempotent without downloading or uploading', async () => {
  const version = await versionOf(pdf);
  const fake = fakeDb({ existing: { material_id: 'm', version_id: 'v1', content_hash: version } });
  const result = await createGoogleStore({ db: fake.db, binding, actorId: 'actor-1' }).storeMaterial({ fileId: 'file-1', version, metadata: { mimeType: 'application/pdf' }, bytes: pdf });
  assert.deepEqual(result, { materialId: 'm', versionId: 'v1' });
  assert.equal(fake.calls.uploads.length, 0);
  assert.equal(fake.calls.rpc.length, 0);
});
