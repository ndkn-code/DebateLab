import assert from 'node:assert/strict';
import test from 'node:test';
import { sourceObjectsForDeletion, purgeDeletedQuestionImport } from './question-import-cleanup.mjs';
const batch = { id: 'b', club_id: 'org', status: 'deleted' };
const material = { id: 'm', club_id: 'org' };
const version = { id: 'v', material_id: 'm', purpose: 'question_import', original_bucket: 'lms-material-originals', original_path: 'org/m/u/v/v.bin' };
test('cleanup validates ownership, tombstone, leases and every storage path before removal', () => {
  assert.deepEqual(sourceObjectsForDeletion(batch,material,version,[]),[{bucket:'lms-material-originals',path:'org/m/u/v/v.bin'}]);
  for (const bad of [{...version,material_id:'other'}, {...version,purpose:'material'}, {...version,original_path:'another/m/u/v/v.bin'}, {...version,lease_expires_at:'2999-01-01'}])
    assert.throws(()=>sourceObjectsForDeletion(batch,material,bad,[]));
  assert.throws(()=>sourceObjectsForDeletion({...batch,status:'quarantined'},material,version,[]));
  assert.throws(()=>sourceObjectsForDeletion(batch,{...material,club_id:'other'},version,[]));
  assert.throws(()=>sourceObjectsForDeletion(batch,material,version,[{version_id:'v',bucket_id:'lms-material-previews',storage_path:'other/v/preview.txt'}]));
});
test('cleanup refuses a live batch before reading or deleting its artifacts', async () => {
  let tables=[];
  const db={from(table){tables.push(table);return {select(){return this},eq(){return this},single:async()=>({data:{...batch,status:'review'},error:null})}}};
  await assert.rejects(purgeDeletedQuestionImport(db,'b'),/REQUIRES_TOMBSTONE/);
  assert.deepEqual(tables,['question_import_batches']);
});

test('cleanup tombstones each document uniquely and is repeatable', async () => {
  const docs = [
    { id: 'd1', batch_id: 'b', club_id: 'org', version_id: null, media_version_id: null, source_file_name: 'one.pdf' },
    { id: 'd2', batch_id: 'b', club_id: 'org', version_id: null, media_version_id: null, source_file_name: 'two.pdf' },
  ];
  const updates = [];
  const db = { from(table) {
    const result = table === 'question_import_batches' ? { data: { ...batch }, error: null } : table === 'question_import_batch_documents' ? { data: docs, error: null } : table === 'question_import_draft_items' ? { data: [], error: null } : { data: null, error: null };
    const chain = { select() { return chain; }, eq() { return chain; }, neq() { return chain; }, or() { return chain; }, limit() { return chain; }, order() { return chain; }, range() { return chain; }, in() { return chain; }, delete() { return chain; }, update(payload) { updates.push({ table, payload }); return chain; }, insert(payload) { updates.push({ table, payload }); return chain; }, single: async () => result, then(resolve, reject) { return Promise.resolve(result).then(resolve, reject); } };
    return chain;
  }, storage: { from() { return { remove: async () => ({ data: [], error: null }) }; } } };
  const first = await purgeDeletedQuestionImport(db, 'b');
  const second = await purgeDeletedQuestionImport(db, 'b');
  assert.equal(first.versions, 0);
  assert.equal(second.versions, 0);
  const documentNames = updates.filter((entry) => entry.table === 'question_import_batch_documents').map((entry) => entry.payload.source_file_name);
  assert.deepEqual(documentNames, ['[deleted] d1', '[deleted] d2', '[deleted] d1', '[deleted] d2']);
});
