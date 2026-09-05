import { createClient } from '@supabase/supabase-js';
import { pathToFileURL } from 'node:url';

function checked(result) {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

export function sourceObjectsForDeletion(batch, material, version, renditions) {
  if (batch.status !== 'deleted' || material.club_id !== batch.club_id ||
      version.material_id !== material.id || version.purpose !== 'question_import')
    throw new Error('QUESTION_IMPORT_DELETE_SCOPE_MISMATCH');
  if (version.lease_expires_at && Date.parse(version.lease_expires_at) > Date.now())
    throw new Error('QUESTION_IMPORT_DELETE_LEASE_ACTIVE');
  const objects = [];
  for (const kind of ['ingest', 'original']) {
    const bucket = version[`${kind}_bucket`];
    const path = version[`${kind}_path`];
    if (!path) continue;
    const expected = kind === 'ingest' ? 'lms-material-ingest' : 'lms-material-originals';
    if (bucket !== expected || !path.startsWith(`${batch.club_id}/${material.id}/`) ||
        !path.includes(`/${version.id}/`) || path.includes('..'))
      throw new Error('QUESTION_IMPORT_DELETE_PATH_MISMATCH');
    objects.push({ bucket, path });
  }
  for (const row of renditions) {
    if (row.version_id !== version.id || row.bucket_id !== 'lms-material-previews' ||
        !row.storage_path?.startsWith(`${material.id}/${version.id}/`) || row.storage_path.includes('..'))
      throw new Error('QUESTION_IMPORT_DELETE_RENDITION_MISMATCH');
    objects.push({ bucket: row.bucket_id, path: row.storage_path });
  }
  return objects;
}

/** Run in the existing private worker image after a lead has tombstoned the batch.
 * Storage removal is retryable. A completion event is written only after all removals.
 * This does not assert that a provider has fulfilled its separate deletion obligations.
 */
export async function purgeDeletedQuestionImport(supabase, batchId) {
  const batch = checked(await supabase.from('question_import_batches').select('*').eq('id', batchId).single());
  if (batch.status !== 'deleted') throw new Error('QUESTION_IMPORT_DELETE_REQUIRES_TOMBSTONE');
  const documents = checked(await supabase.from('question_import_batch_documents').select('*').eq('batch_id', batch.id));
  const versions = new Map();
  for (const doc of documents) {
    if (doc.club_id !== batch.club_id) throw new Error('QUESTION_IMPORT_DELETE_SCOPE_MISMATCH');
    if (doc.version_id) versions.set(doc.version_id, doc.material_id);
    if (doc.media_version_id) versions.set(doc.media_version_id, doc.media_material_id);
  }
  const plans = [];
  // Validate every binding before deleting the first object.
  for (const [versionId, materialId] of versions) {
    const otherBindings = checked(await supabase.from('question_import_batch_documents').select('id')
      .neq('batch_id', batch.id).or(`version_id.eq.${versionId},media_version_id.eq.${versionId}`).limit(1));
    if (otherBindings.length) throw new Error('QUESTION_IMPORT_DELETE_SHARED_SOURCE');
    const material = checked(await supabase.from('lms_materials').select('id,club_id').eq('id', materialId).single());
    const version = checked(await supabase.from('lms_material_versions').select('*').eq('id', versionId).single());
    const renditions = checked(await supabase.from('lms_material_renditions').select('version_id,bucket_id,storage_path').eq('version_id', versionId));
    plans.push({ versionId, objects: sourceObjectsForDeletion(batch, material, version, renditions) });
  }
  let removed = 0;
  for (const plan of plans) {
    for (const { bucket, path } of plan.objects) {
      checked(await supabase.storage.from(bucket).remove([path]));
      removed += 1;
    }
    checked(await supabase.from('lms_material_renditions').delete().eq('version_id', plan.versionId));
    checked(await supabase.from('lms_material_versions').update({ ingest_bucket: null, ingest_path: null,
      original_bucket: null, original_path: null, native_document: null, source_file_name: '[deleted]',
      processing_status: 'rejected', error_message: null }).eq('id', plan.versionId).eq('purpose', 'question_import'));
  }
  let offset = 0;
  for (;;) {
    const drafts = checked(await supabase.from('question_import_draft_items').select('id')
      .eq('batch_id', batch.id).order('id').range(offset, offset + 499));
    if (!drafts.length) break;
    const ids = drafts.map((row) => row.id);
    checked(await supabase.from('question_import_draft_keys').delete().in('draft_item_id', ids).eq('club_id', batch.club_id));
    // Keep IDs and source evidence so compliance provenance survives content erasure.
    checked(await supabase.from('question_import_draft_items').update({ payload: {}, review_note: null })
      .in('id', ids).eq('club_id', batch.club_id));
    const items = checked(await supabase.from('question_bank_items').select('id,stimulus_id')
      .in('source_draft_item_id', ids).eq('club_id', batch.club_id));
    if (items.length) {
      checked(await supabase.from('question_bank_keys').delete().in('bank_item_id', items.map((item) => item.id)).eq('club_id', batch.club_id));
      checked(await supabase.from('question_bank_items').update({ payload: {} }).in('id', items.map((item) => item.id)).eq('club_id', batch.club_id));
      for (const stimulusId of new Set(items.map((item) => item.stimulus_id).filter(Boolean))) {
        const references = checked(await supabase.from('question_bank_items').select('source_draft_item_id').eq('stimulus_id', stimulusId));
        if (references.every((item) => ids.includes(item.source_draft_item_id)))
          checked(await supabase.from('question_bank_stimuli').update({ payload: {} }).eq('id', stimulusId).eq('club_id', batch.club_id));
      }
    }
    offset += drafts.length;
  }
  for (const document of documents) {
    checked(await supabase.from('question_import_batch_documents').update({ provider_result: {}, source_file_name: `[deleted] ${document.id}`, error_message: null })
      .eq('id', document.id).eq('batch_id', batch.id).eq('club_id', batch.club_id));
  }
  checked(await supabase.from('question_import_batches').update({ title: '[deleted]', failure_message: null }).eq('id', batch.id).eq('status', 'deleted'));
  checked(await supabase.from('question_import_compliance_events').insert({ club_id: batch.club_id, batch_id: batch.id,
    event_type: 'deleted', reason: 'Private source cleanup completed', metadata: { storage_cleanup_completed: true,
      provider_deletion_verified: false, versions: plans.map((plan) => plan.versionId), objects_removed_this_run: removed } }));
  return { batchId: batch.id, versions: plans.length, objectsRemoved: removed, providerDeletionVerified: false };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const batchId = process.argv[2];
  if (!/^[0-9a-f-]{36}$/i.test(batchId ?? '')) throw new Error('Usage: node src/question-import-cleanup.mjs BATCH_UUID');
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  console.info(await purgeDeletedQuestionImport(db, batchId));
}
