import { createHash, randomUUID } from 'node:crypto';
import { validateMaterialBytes } from './material-validation.mjs';

export function createGoogleStore({ db, binding, actorId }) {
  if (!db || !binding?.id || !actorId) throw new TypeError('db, binding, and actorId are required');
  const rpc = async (mode, extra = {}) => {
    const { data, error } = await db.rpc('center_google_projection', { p_binding_id: binding.id, p_actor_id: actorId, p_items: extra.items ?? [], p_mode: mode, p_cursor: extra.cursor ?? null });
    if (error) throw error;
    return data;
  };
  return {
    saveCalendarPage: (_id, events) => rpc('incremental', { items: events }),
    saveCursor: (_id, cursor) => rpc('cursor', { cursor }),
    resetCursor: () => rpc('reset'),
    markBinding: async (_id, values) => { const { error } = await db.from('center_resource_bindings').update({ state: values.state, metadata: { ...(binding.metadata ?? {}), lastError: values.lastError ?? null } }).eq('id', binding.id).eq('club_id', binding.club_id); if (error) throw error; },
    beginFullSync: () => rpc('begin_full'),
    stageCalendarPage: (_id, events) => rpc('stage', { items: events }),
    completeFullSync: (_id, cursor) => rpc('complete_full', { cursor }),
    abortFullSync: () => rpc('abort_full'),
    stageSheetImport: async ({ bindingId, rows }) => { const contentHash = createHash('sha256').update(JSON.stringify(rows)).digest('hex'); const { error } = await db.from('center_sheet_staging').upsert({ binding_id: bindingId, club_id: binding.club_id, rows, status: 'pending', content_hash: contentHash }, { onConflict: 'binding_id,content_hash', ignoreDuplicates: true }); if (error) throw error; },
    writeAnalytics: async () => { const { data, error } = await db.from('student_records').select('id,full_name,student_code').eq('club_id', binding.club_id).order('full_name'); if (error) throw error; return { spreadsheetId: binding.external_id, range: 'Thinkfy!A1:C', values: [['student_record_id', 'full_name', 'student_code'], ...(data ?? []).map((row) => [row.id, row.full_name, row.student_code ?? ''])] }; },
    storeMaterial: async ({ fileId, version, metadata, bytes }) => {
      const existing = await db.from('center_drive_sources').select('material_id,version_id,content_hash').eq('binding_id',binding.id).eq('club_id',binding.club_id).maybeSingle();
      if(existing.error) throw existing.error;
      if(existing.data?.content_hash === version) return {materialId:existing.data.material_id,versionId:existing.data.version_id};
      const materialId = existing.data?.material_id ?? randomUUID(); const versionId = randomUUID();
      const validated = validateMaterialBytes(bytes, metadata.mimeType, version);
      const path = `${binding.club_id}/${materialId}/${versionId}/google-${fileId}`;
      const upload = await db.storage.from('lms-material-originals').upload(path, validated.bytes, { contentType: validated.detectedMime, upsert: false });
      if (upload.error) throw upload.error;
      const { data, error } = await db.rpc('center_queue_google_material', { p_binding_id: binding.id, p_actor_id: actorId, p_file_id: fileId, p_version: version, p_metadata: { ...metadata, storageBucket: 'lms-material-originals', detectedMimeType: validated.detectedMime }, p_storage_path: path, p_size_bytes: validated.bytes.byteLength });
      if (error || data?.versionId !== versionId) await db.storage.from('lms-material-originals').remove([path]);
      if (error) throw error;
      return data;
    },
    revokeMaterial: async () => { const { error } = await db.rpc('center_revoke_google_material', { p_binding_id: binding.id, p_actor_id: actorId }); if (error) throw error; },
  };
}
