import { deterministicEventId } from './providers/google.mjs';

const DAY_MS = 86_400_000;
const iso = (date) => new Date(date).toISOString();

function recurrence(schedule) {
  const rule = schedule.recurrence_rule ?? {};
  if (rule.frequency === 'none') return undefined;
  const frequency = String(rule.frequency).toUpperCase();
  if (!['DAILY', 'WEEKLY', 'MONTHLY'].includes(frequency)) return undefined;
  const byDay = Array.isArray(rule.weekdays) ? rule.weekdays.join(',') : Array.isArray(rule.byDay) ? rule.byDay.join(',') : undefined;
  const parts = [`RRULE:FREQ=${frequency}`];
  if (frequency === 'WEEKLY' && byDay) parts.push(`BYDAY=${byDay}`);
  if (rule.interval) parts.push(`INTERVAL=${Number(rule.interval)}`);
  if (rule.endMode === "on_date" && rule.until) parts.push(`UNTIL=${String(rule.until).slice(0,10).replaceAll("-", "")}T235959Z`);
  if (rule.endMode === "after_occurrences" && rule.count) parts.push(`COUNT=${Number(rule.count)}`);
  return [parts.join(';')];
}

function eventFromSchedule(schedule) {
  const date = schedule.start_date;
  const start = `${date}T${schedule.start_time}`;
  const end = `${date}T${schedule.end_time}`;
  return { id: deterministicEventId(`schedule:${schedule.id}`), summary: schedule.title, start: { dateTime: start, timeZone: schedule.timezone }, end: { dateTime: end, timeZone: schedule.timezone }, recurrence: recurrence(schedule), extendedProperties: { private: { thinkfyScheduleId: schedule.id } } };
}

export function createCenterCalendar({ db, rpc, googleFor, now = () => new Date() }) {
  if (!db || typeof rpc !== 'function' || typeof googleFor !== 'function') throw new TypeError('db, rpc, and googleFor are required');
  async function sync({ binding, connection }) {
    const google = await googleFor(connection.id ?? connection);
    const current = now(); const from = new Date(current.getTime() - 90 * DAY_MS); const until = new Date(current.getTime() + 366 * DAY_MS);
    const schedules = await db.from('class_schedules').select('*').eq('class_id', binding.class_id).eq('status', 'active');
    if (schedules.error) throw schedules.error;

    for (const schedule of (schedules.data ?? []).filter((item) => !item.metadata?.centerBindingId)) {
      const event = eventFromSchedule(schedule);
      try { await google.createEvent(binding.external_id, event, { idempotencyKey: `schedule:${schedule.id}`, sendUpdates: 'none' }); }
      catch (error) { if (error.status !== 409) throw error; try { await google.getEvent(binding.external_id, event.id); } catch (missing) { if (missing.status !== 404) throw missing; await google.createEvent(binding.external_id, event, { idempotencyKey: `schedule:${schedule.id}`, sendUpdates: 'none' }); } }

    }
    let pageToken; const occurrences = [];
    do { const page = await google.listOccurrences(binding.external_id, { timeMin: iso(from), timeMax: iso(until), pageToken }); occurrences.push(...(page.items ?? [])); pageToken = page.nextPageToken; if (occurrences.length > 10000) throw new Error('Google occurrence window exceeds 10,000 events'); } while (pageToken);
    const projection = await rpc('center_project_calendar', { p_binding_id: binding.id, p_actor_id: connection.connected_by, p_items: occurrences, p_from: iso(from), p_until: iso(until) });
    for (const schedule of (schedules.data ?? []).filter((item) => !item.metadata?.centerBindingId && item.recurrence_rule?.frequency !== 'none')) { const result = await db.from('class_schedules').update({ status: 'cancelled', metadata: { ...(schedule.metadata ?? {}), migratedToGoogle: true, centerBindingId: binding.id } }).eq('id', schedule.id).eq('class_id', binding.class_id); if (result.error) throw result.error; }
    return { from: iso(from), until: iso(until), count: occurrences.length, projected: projection };
  }

  async function reschedule(event) {
    const context = await rpc('center_calendar_command_context', { p_event_id: event.id });
    const { binding, connection } = context; const google = await googleFor(connection.id ?? connection); const current = await google.getEvent(binding.external_id, event.payload.eventId);
    if (current.extendedProperties?.private?.thinkfyCommandId === event.id) return sync({ binding, connection });
    if (event.payload.etag !== current.etag) { await sync({ binding, connection }); throw Object.assign(new Error('Calendar event changed remotely'), { conflict: true, status: 412 }); }
    const updated = await google.updateEvent(binding.external_id, event.payload.eventId, { ...current, start: { dateTime: event.payload.input.startAt, timeZone: current.start?.timeZone }, end: { dateTime: event.payload.input.endAt, timeZone: current.end?.timeZone }, extendedProperties: { ...(current.extendedProperties ?? {}), private: { ...(current.extendedProperties?.private ?? {}), thinkfyCommandId: event.id } } }, { etag: event.payload.etag, sendUpdates: 'none' });
    return sync({ binding, connection }).then(() => updated);
  }

  async function trial(event) {
    const trialResult = await db.from('center_trials').select('*').eq('id', event.subjectId).eq('club_id', event.clubId).single();
    if (trialResult.error || !trialResult.data) throw trialResult.error ?? new Error('Trial unavailable');
    const bindingResult = await db.from('center_resource_bindings').select('*,center_connections(*)').eq('class_id', trialResult.data.class_id).eq('club_id', event.clubId).eq('kind','calendar').eq('state','active').maybeSingle();
    if(bindingResult.error) throw bindingResult.error;
    if(!bindingResult.data) return {status:'native'};
    if(bindingResult.data.class_id !== trialResult.data.class_id) throw new Error('Trial binding unavailable');
    const binding = bindingResult.data; const connection = binding.center_connections; const trial = trialResult.data; if(connection?.status !== 'connected' || connection.club_id !== event.clubId || connection.provider !== 'google') throw new Error('Google is not connected'); const google = await googleFor(connection.id ?? connection);
    const idempotencyKey = `trial:${event.subjectId}`; const payload = { id: deterministicEventId(idempotencyKey), summary: trial.title ?? 'Trial', start: { dateTime: trial.starts_at, timeZone: trial.timezone }, end: { dateTime: trial.ends_at, timeZone: trial.timezone }, status: event.kind === 'trial.cancelled' ? 'cancelled' : 'confirmed', extendedProperties: { private: { thinkfyTrialId: event.subjectId } } };
    if (event.kind === 'trial.cancelled') { const existing = await google.getEvent(binding.external_id, payload.id); await google.updateEvent(binding.external_id, payload.id, { ...existing, status: 'cancelled' }, { etag: existing.etag, sendUpdates: 'none' }); } else { try { await google.createEvent(binding.external_id, payload, { idempotencyKey, sendUpdates: 'none' }); } catch (error) { if (error.status !== 409) throw error; const existing = await google.getEvent(binding.external_id, payload.id); if (existing.id !== payload.id) throw error; } }
    return sync({ binding, connection });
  }
  return { sync, reschedule, trial };
}
