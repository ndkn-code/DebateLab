import test from 'node:test';
import assert from 'node:assert/strict';
import { createGoogleSync } from './google-sync.mjs';

function setup(overrides = {}) {
  const calls = [];
  const store = {
    saveCalendarPage: async (...args) => calls.push(['save', ...args]), saveCursor: async (...args) => calls.push(['cursor', ...args]), resetCursor: async (...args) => calls.push(['reset', ...args]),
    markBinding: async (...args) => calls.push(['mark', ...args]), beginFullSync: async (...args) => calls.push(['begin', ...args]), stageCalendarPage: async (...args) => calls.push(['stage', ...args]), completeFullSync: async (...args) => calls.push(['complete', ...args]), abortFullSync: async (...args) => calls.push(['abort', ...args]), storeMaterial: async (...args) => calls.push(['material', ...args]), revokeMaterial: async (...args) => calls.push(['revoke', ...args]), stageSheetImport: async (...args) => calls.push(['sheet', ...args]), writeAnalytics: async () => null,
    ...overrides.store,
  };
  return { calls, store, sync: createGoogleSync({ provider: overrides.provider, store, now: () => 'now' }) };
}

test('stores every calendar page before advancing the cursor', async () => {
  const provider = { listEvents: async (_id, options) => options.pageToken ? { items: [{ id: 'b' }], nextSyncToken: 'next' } : { items: [{ id: 'a' }], nextPageToken: 'p' } };
  const { calls, sync } = setup({ provider });
  await sync.syncCalendar({ id: 'b', external_id: 'cal', cursor: 'old', metadata: {} });
  assert.deepEqual(calls.map((call) => call[0]), ['save', 'save', 'cursor']);
  assert.equal(calls[2][2], 'next');
});

test('aborts a failed page without advancing cursor', async () => {
  const provider = { listEvents: async (_id, options) => options.pageToken ? Promise.reject(new Error('crash')) : { items: [], nextPageToken: 'p' } };
  const { calls, sync } = setup({ provider });
  await assert.rejects(sync.syncCalendar({ id: 'b', external_id: 'cal', cursor: 'old', metadata: {} }));
  assert.equal(calls.some((call) => call[0] === 'cursor'), false);
});

test('410 preserves projection until the replacement full sync completes', async () => {
  let attempt = 0;
  const provider = { listEvents: async () => { if (!attempt++) throw Object.assign(new Error('expired'), { status: 410 }); return { items: [{ id: 'fresh' }], nextSyncToken: 'full' }; } };
  const { calls, sync } = setup({ provider });
  await sync.syncCalendar({ id: 'b', external_id: 'cal', cursor: 'old', metadata: {} });
  assert.deepEqual(calls.map((call) => call[0]), ['reset', 'begin', 'stage', 'complete']);
});

test('412 marks conflict and never writes an optimistic projection', async () => {
  const provider = { updateEvent: async () => { throw Object.assign(new Error('etag'), { status: 412 }); } };
  const { calls, sync } = setup({ provider });
  assert.equal(await sync.reschedule({ binding: { id: 'b', external_id: 'cal' }, eventId: 'e', etag: 'v', patch: {}, commandId: 'cmd' }), null);
  assert.equal(calls[0][0], 'mark'); assert.equal(calls.some((call) => call[0] === 'save'), false);
});

test('unavailable files are revoked and de-indexed', async () => {
  const provider = { getFile: async () => { throw Object.assign(new Error('gone'), { status: 404 }); } };
  const { calls, sync } = setup({ provider });
  assert.equal(await sync.ingestFile({ id: 'b', external_id: 'file', metadata: {} }), null);
  assert.deepEqual(calls.map((call) => call[0]), ['revoke', 'mark']);
});

test('sheet sync reads only its explicit range and stages rows', async () => {
  const provider = { readSheet: async (...args) => { assert.deepEqual(args, ['sheet', 'Thinkfy!A1:B2']); return { values: [['name', 'score']] }; } };
  const { calls, sync } = setup({ provider });
  await sync.syncSheet({ id: 'b', external_id: 'sheet', cursor: 'r1', metadata: { range: 'Thinkfy!A1:B2' } });
  assert.equal(calls[0][0], 'sheet'); assert.deepEqual(calls[0][1].rows, [['name', 'score']]);
});
