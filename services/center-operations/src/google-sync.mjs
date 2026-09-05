import { createHash } from 'node:crypto';

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const GOOGLE_EXPORTS = {
  'application/vnd.google-apps.document': 'application/pdf',
  'application/vnd.google-apps.spreadsheet': 'text/csv',
  'application/vnd.google-apps.presentation': 'application/pdf',
};

export function createGoogleSync({ provider, store, now = () => new Date().toISOString() }) {
  if (!provider || !store) throw new TypeError('provider and store are required');

  async function listAll(binding, syncToken, full) {
    let pageToken;
    let nextSyncToken;
    do {
      const page = await provider.listEvents(binding.external_id, { syncToken, pageToken });
      const events = page.items ?? [];
      if (full) await store.stageCalendarPage(binding.id, events);
      else await store.saveCalendarPage(binding.id, events);
      pageToken = page.nextPageToken;
      if (!pageToken) nextSyncToken = page.nextSyncToken;
    } while (pageToken);
    return nextSyncToken;
  }

  async function syncCalendar(binding) {
    if (!binding.cursor) {
      await store.beginFullSync(binding.id);
      try {
        const cursor = await listAll(binding, undefined, true);
        await store.completeFullSync(binding.id, cursor);
        return { cursor, full: true };
      } catch (error) {
        await store.abortFullSync(binding.id);
        throw error;
      }
    }
    try {
      const cursor = await listAll(binding, binding.cursor, false);
      if (cursor) await store.saveCursor(binding.id, cursor);
      return { cursor, full: false };
    } catch (error) {
      if (error?.status !== 410 && !error?.syncReset) throw error;
      await store.resetCursor(binding.id);
      await store.beginFullSync(binding.id);
      try {
        const cursor = await listAll(binding, undefined, true);
        await store.completeFullSync(binding.id, cursor);
        return { cursor, full: true };
      } catch (fullError) {
        await store.abortFullSync(binding.id);
        throw fullError;
      }
    }
  }

  async function reschedule({ binding, eventId, etag, patch, commandId }) {
    try {
      const event = await provider.updateEvent(binding.external_id, eventId, patch, { etag, sendUpdates: 'none' });
      await store.saveCalendarPage(binding.id, [event]);
      return event;
    } catch (error) {
      if (error?.status === 412 || error?.conflict) {
        await store.markBinding(binding.id, { state: 'conflict', lastError: `Event update conflict${commandId ? ` (${commandId})` : ''}` });
        return null;
      }
      throw error;
    }
  }

  async function revoke(binding, error) {
    await store.revokeMaterial(binding.id);
    await store.markBinding(binding.id, { state: 'revoked', lastError: error?.message ?? 'File is unavailable' });
    return null;
  }

  async function ingestFile(binding) {
    let metadata;
    try { metadata = await provider.getFile(binding.external_id); }
    catch (error) { if (error?.status === 403 || error?.status === 404) return revoke(binding, error); throw error; }
    if (metadata?.trashed) return revoke(binding, new Error('File is in the trash'));
    if (metadata?.size && Number(metadata.size) > MAX_FILE_BYTES) throw new Error('Google material exceeds the 20 MB limit');
    const exportMime = binding.metadata?.exportMimeType ?? GOOGLE_EXPORTS[metadata.mimeType];
    let bytes;
    try { bytes = await provider.downloadFile(binding.external_id, exportMime); }
    catch (error) { if (error?.status === 403 || error?.status === 404) return revoke(binding, error); throw error; }
    if (bytes.byteLength > MAX_FILE_BYTES) throw new Error('Google material exceeds the 20 MB limit');
    const hash = createHash('sha256').update(Buffer.from(bytes)).digest('hex');
    await store.storeMaterial({ bindingId: binding.id, fileId: binding.external_id, version: hash, metadata: { ...metadata, mimeType: exportMime ?? metadata.mimeType, name: exportMime === "application/pdf" ? `${metadata.name}.pdf` : metadata.name, version: metadata.modifiedTime ?? now(), parents: metadata.parents ?? [] }, bytes });
    return { fileId: binding.external_id, version: hash, metadata };
  }

  async function syncSheet(binding) {
    const range = binding.metadata?.range;
    if (!range) throw new Error('Sheet binding requires an explicit range');
    const result = await provider.readSheet(binding.external_id, range);
    await store.stageSheetImport({ bindingId: binding.id, rows: result.values ?? [], revision: binding.metadata?.revision ?? binding.cursor ?? null });
    return result;
  }

  async function writeAnalytics(binding) {
    const output = await store.writeAnalytics(binding.id);
    if (!output) return null;
    if (!output.range.startsWith('Thinkfy!')) throw new Error('Analytics range must be on the Thinkfy tab');
    return provider.writeSheet(output.spreadsheetId, output.range, output.values);
  }

  return { syncCalendar, reschedule, ingestFile, syncSheet, writeAnalytics };
}
