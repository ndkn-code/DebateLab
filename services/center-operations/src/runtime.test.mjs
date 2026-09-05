import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRuntime } from './runtime.mjs';

const config = { appOrigin: 'https://thinkfy.test', callbackOrigin: 'https://worker.test', google: { clientId: 'client', clientSecret: 'secret', redirectUri: 'https://worker.test/oauth/google/callback' } };
const vault = { encrypt: async (value) => ({ ciphertext: value, keyName: 'key' }), decrypt: async (row) => row.ciphertext };
const envelope = (data) => ({ data, error: null });

function queryDb(resolve, rpc) {
  return { rpc, from(table) {
    const request = { table, filters: [], operation: 'select' };
    const query = {
      select() { return query; }, eq(key, value) { request.filters.push([key, value]); return query; },
      in(key, value) { request.filters.push([key, value]); return query; },
      order() { return query; }, limit() { return query; }, single() { return query; },
      update(value) { request.operation = 'update'; request.value = value; return query; },
      insert(value) { request.operation = 'insert'; request.value = value; return query; },
      then(fulfilled, rejected) { return Promise.resolve().then(() => resolve(request)).then(fulfilled, rejected); },
    };
    return query;
  } };
}

test('one failed merchant query does not prevent another center notification job from being processed', async () => {
  const calls = []; const updates = []; let claimCount = 0; let queries = 0;
  const event = { id: 'other-job', clubId: 'other-club', kind: 'message.requested', subjectId: 'student', payload: {}, leaseToken: 'lease', attempts: 1 };
  const db = queryDb((request) => {
    if (request.table === 'center_resource_bindings') return envelope([]);
    if (request.table === 'center_connections') {
      assert.deepEqual(request.filters, [['id', 'merchant'], ['club_id', 'merchant-club']]);
      return envelope({ id: 'merchant', club_id: 'merchant-club', status: 'sandbox' });
    }
    if (request.table === 'center_payment_attempts' && request.operation === 'select') return envelope([{ id: 'attempt', club_id: 'merchant-club', connection_id: 'merchant', provider_order_id: '260904_order' }]);
    if (request.table === 'center_payment_attempts' && request.operation === 'update') { updates.push(request); return envelope(null); }
    assert.fail(`Unexpected table operation: ${request.table}/${request.operation}`);
  }, async (name, args) => {
    calls.push({ name, args });
    // Supabase returns envelopes here. Runtime unwraps them, while notifications uses db.rpc directly.
    if (name === 'center_schedule_reminders') return envelope({ created: 1 });
    if (name === 'center_load_credentials') return envelope({ provider: 'zalopay', clubId: 'merchant-club', ciphertext: JSON.stringify({ appId: 'app', key1: 'key1', key2: 'key2' }) });
    if (name === 'center_claim_event') return envelope(claimCount++ === 0 ? event : null);
    if (name === 'center_notification_context') { assert.equal(args.p_event_id, event.id); return envelope({ allowed: true, recipients: [] }); }
    if (name === 'center_finish_event') return envelope({ status: args.p_status });
    assert.fail(`Unexpected RPC: ${name}`);
  });
  const runtime = createRuntime({ db, vault, config, fetchFn: async (url) => {
    assert.equal(url, 'https://sb-openapi.zalopay.vn/v2/query'); queries++;
    throw new Error('merchant network unavailable');
  } });
  assert.deepEqual(await runtime.reconcile(), { processed: 1, payments: 0, bindings: 0, failures: 1 });
  assert.equal(queries, 1);
  assert.equal(calls[0].name, 'center_schedule_reminders');
  assert.ok(calls.some((call) => call.name === 'center_notification_context'));
  assert.deepEqual(calls.find((call) => call.name === 'center_finish_event').args, { p_event_id: event.id, p_lease_token: 'lease', p_status: 'completed' });
  assert.equal(updates.length, 1);
  assert.equal(updates[0].value.error_code, 'reconciliation_retry');
  assert.deepEqual(updates[0].filters, [['id', 'attempt'], ['club_id', 'merchant-club'], ['status', 'pending']]);
});

test('ZBS webhook rejects a different OA even with a correct signature and records the verified connection tenant', async () => {
  const inserts = []; const secret = { appId: 'app', oaSecretKey: 'oa-secret' };
  const db = queryDb((request) => {
    assert.equal(request.table, 'center_events'); assert.equal(request.operation, 'insert');
    inserts.push(request.value); return envelope(null);
  }, async (name, args) => {
    assert.equal(name, 'center_load_credentials'); assert.deepEqual(args, { p_connection_id: 'connection' });
    return envelope({ provider: 'zbs', clubId: 'verified-club', externalAccountId: 'oa-1', ciphertext: JSON.stringify(secret) });
  });
  const runtime = createRuntime({ db, vault, config, fetchFn: async () => assert.fail('Webhook must not call a provider') });
  const callback = (oa) => {
    const body = { app_id: 'app', sender: { id: 'recipient' }, recipient: { id: oa }, timestamp: Date.now(), event_name: 'user_received_message', message: { msg_id: 'message-1' }, clubId: 'untrusted-club' };
    const rawBody = JSON.stringify(body);
    const signature = createHash('sha256').update(secret.appId + rawBody + body.timestamp + secret.oaSecretKey).digest('hex');
    return runtime.callbacks.zbs({ connectionId: 'connection', body, rawBody, headers: { 'x-zevent-signature': signature } });
  };
  await assert.rejects(callback('other-oa'), /Invalid OA webhook/);
  assert.deepEqual(inserts, []);
  assert.deepEqual(await callback('oa-1'), { ok: true });
  assert.equal(inserts.length, 1);
  assert.equal(inserts[0].club_id, 'verified-club');
  assert.equal(inserts[0].subject_id, 'connection');
  assert.equal(inserts[0].payload.messageId, 'message-1');
  assert.equal(inserts[0].kind, 'provider.zbs_receipt');
});
