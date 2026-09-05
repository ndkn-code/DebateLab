import test from 'node:test';
import assert from 'node:assert/strict';
import { createCenterCalendar } from './calendar.mjs';
import { deterministicEventId } from './providers/google.mjs';

const schedule = { id: 'schedule-1', class_id: 'class-1', title: 'Debate', start_date: '2026-09-10', start_time: '10:00:00', end_time: '11:00:00', timezone: 'Asia/Ho_Chi_Minh', recurrence_rule: { frequency: 'weekly', weekdays: ['MO', 'WE'], endMode: 'after_occurrences', count: 8 }, status: 'active', metadata: {} };
const binding = { id: 'binding-1', external_id: 'calendar', class_id: 'class-1' };
const connection = { id: 'connection-1', connected_by: 'actor' };
const now = () => new Date('2026-09-04T12:00:00Z');

function scheduleDb(rows, updates) {
  return { from(table) {
    assert.equal(table, 'class_schedules');
    const filters = []; let patch;
    const query = {
      select() { return query; },
      update(value) { patch = value; return query; },
      eq(key, value) { filters.push([key, value]); return query; },
      then(resolve, reject) {
        if (patch) updates.push({ patch, filters });
        return Promise.resolve({ data: patch ? null : rows, error: null }).then(resolve, reject);
      },
    };
    return query;
  } };
}

test('seeds the exact COUNT recurrence and leaves native schedules intact when occurrence fetch fails', async () => {
  const updates = []; const seeds = []; const projection = [];
  const failure = new Error('occurrence fetch failed');
  const google = {
    createEvent: async (...args) => seeds.push(args),
    listOccurrences: async () => { throw failure; },
  };
  const calendar = createCenterCalendar({ db: scheduleDb([schedule], updates), googleFor: async () => google, rpc: async (...args) => projection.push(args), now });
  await assert.rejects(calendar.sync({ binding, connection }), (error) => error === failure);
  assert.equal(seeds.length, 1);
  assert.deepEqual(seeds[0], ['calendar', {
    id: deterministicEventId('schedule:schedule-1'), summary: 'Debate',
    start: { dateTime: '2026-09-10T10:00:00', timeZone: 'Asia/Ho_Chi_Minh' },
    end: { dateTime: '2026-09-10T11:00:00', timeZone: 'Asia/Ho_Chi_Minh' },
    recurrence: ['RRULE:FREQ=WEEKLY;BYDAY=MO,WE;COUNT=8'],
    extendedProperties: { private: { thinkfyScheduleId: 'schedule-1' } },
  }, { idempotencyKey: 'schedule:schedule-1', sendUpdates: 'none' }]);
  assert.deepEqual(updates, []);
  assert.deepEqual(projection, []);
});

test('projects all pages before retiring recurring originals, preserves one-off IDs, and skips projected schedules', async () => {
  const updates = []; const seeds = []; const projections = [];
  const oneoff = { ...schedule, id: 'oneoff', recurrence_rule: { frequency: 'none' } };
  const until = { ...schedule, recurrence_rule: { frequency: 'weekly', weekdays: ['MO'], interval: 2, endMode: 'on_date', until: '2026-12-01' } };
  const projected = { ...schedule, id: 'projected', metadata: { centerBindingId: binding.id } };
  const occurrences = [{ id: 'single', extendedProperties: { private: { thinkfyScheduleId: oneoff.id } } }, { id: 'weekly_20260914', recurringEventId: deterministicEventId(`schedule:${until.id}`), extendedProperties: { private: { thinkfyScheduleId: until.id } } }];
  const google = {
    createEvent: async (_calendar, event) => seeds.push(event),
    listOccurrences: async (_calendar, options) => options.pageToken === 'page-2' ? { items: [occurrences[1]] } : { items: [occurrences[0]], nextPageToken: 'page-2' },
  };
  const calendar = createCenterCalendar({ db: scheduleDb([oneoff, until, projected], updates), googleFor: async () => google, now, rpc: async (name, args) => {
    assert.equal(name, 'center_project_calendar');
    assert.deepEqual(updates, []);
    projections.push(args);
    return { projected: 2 };
  } });
  const result = await calendar.sync({ binding, connection });
  assert.equal(result.count, 2);
  assert.equal(seeds.length, 2);
  assert.equal(seeds[0].id, deterministicEventId('schedule:oneoff'));
  assert.equal(seeds[0].recurrence, undefined);
  assert.equal(seeds[1].id, deterministicEventId('schedule:schedule-1'));
  assert.deepEqual(seeds[1].recurrence, ['RRULE:FREQ=WEEKLY;BYDAY=MO;INTERVAL=2;UNTIL=20261201T235959Z']);
  assert.equal(projections.length, 1);
  assert.deepEqual(projections[0].p_items, occurrences);
  assert.equal(projections[0].p_binding_id, binding.id);
  assert.equal(projections[0].p_actor_id, connection.connected_by);
  assert.deepEqual(updates, [{ patch: { status: 'cancelled', metadata: { migratedToGoogle: true, centerBindingId: binding.id } }, filters: [['id', schedule.id], ['class_id', binding.class_id]] }]);
});

test('a later page failure never projects a partial occurrence window or cancels originals', async () => {
  const updates = []; let projected = false; let fetched = 0;
  const failure = new Error('second page unavailable');
  const calendar = createCenterCalendar({ db: scheduleDb([schedule], updates), now,
    googleFor: async () => ({ createEvent: async () => {}, listOccurrences: async () => {
      if (++fetched === 1) return { items: [{ id: 'first' }], nextPageToken: 'next' };
      throw failure;
    } }),
    rpc: async () => { projected = true; },
  });
  await assert.rejects(calendar.sync({ binding, connection }), (error) => error === failure);
  assert.equal(fetched, 2);
  assert.equal(projected, false);
  assert.deepEqual(updates, []);
});

for (const replayed of [false, true]) {
  test(replayed ? 'an already-applied command refreshes projection without a second Google write' : 'a stale etag refreshes projection and raises the exact conflict without a Google write', async () => {
    let writes = 0; let projected = 0;
    const updates = [];
    const calendar = createCenterCalendar({ db: scheduleDb([], updates), now,
      googleFor: async () => ({
        getEvent: async () => ({ etag: 'new', extendedProperties: { private: replayed ? { thinkfyCommandId: 'command' } : {} } }),
        createEvent: async () => { writes++; }, updateEvent: async () => { writes++; },
        listOccurrences: async () => ({ items: [] }),
      }),
      rpc: async (name, args) => {
        if (name === 'center_calendar_command_context') { assert.deepEqual(args, { p_event_id: 'command' }); return { binding, connection }; }
        assert.equal(name, 'center_project_calendar'); projected++; return { projected: 0 };
      },
    });
    const result = calendar.reschedule({ id: 'command', payload: { eventId: 'event', etag: 'old', input: { startAt: '2026-09-10T12:00:00Z', endAt: '2026-09-10T13:00:00Z' } } });
    if (replayed) await result;
    else await assert.rejects(result, (error) => error.message === 'Calendar event changed remotely' && error.status === 412 && error.conflict === true);
    assert.equal(projected, 1);
    assert.equal(writes, 0);
    assert.deepEqual(updates, []);
  });
}
