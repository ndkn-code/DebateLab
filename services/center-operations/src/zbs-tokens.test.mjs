import test from 'node:test';
import assert from 'node:assert/strict';
import { createZbsTokens } from './zbs-tokens.mjs';

const instant = 1_800_000_000_000;
const initialSecret = { appId: 'app', secretKey: 'secret-key', accessToken: 'old-access', refreshToken: 'single-use-refresh', expiresAt: instant - 1 };
const vault = {
  async decrypt(row, context) { assert.deepEqual(context, { purpose: 'center-provider-tokens', connectionId: 'oa' }); return row.ciphertext; },
  async encrypt(value, context) { assert.deepEqual(context, { purpose: 'center-provider-tokens', connectionId: 'oa' }); return { ciphertext: value, keyName: 'key' }; },
};

function tokenStore() {
  let row = { connectionId: 'oa', provider: 'zbs', status: 'connected', ciphertext: JSON.stringify(initialSecret), keyName: 'key', updatedAt: 'revision-1' };
  let leased = false;
  const calls = [];
  return { calls, get row() { return row; }, rpc: async (name, args) => {
    calls.push({ name, args });
    assert.equal(args.p_connection_id, 'oa');
    if (name === 'center_load_credentials') return { ...row };
    if (name === 'center_claim_token_refresh') {
      if (leased || args.p_expected_updated_at !== row.updatedAt) return null;
      leased = true; return 'lease-token';
    }
    if (name === 'center_finish_token_refresh') {
      assert.equal(leased, true); assert.equal(args.p_token, 'lease-token');
      row = { ...row, ciphertext: args.p_ciphertext, keyName: args.p_key_name, updatedAt: 'revision-2' };
      leased = false; return null;
    }
    if (name === 'center_mark_reconnect') { row = { ...row, status: 'reconnect_required' }; return null; }
    assert.fail(`Unexpected RPC ${name}`);
  } };
}

test('a concurrent caller cannot reuse the single-use refresh token and the rotated token is persisted', async () => {
  const store = tokenStore(); let release; let started;
  const requestStarted = new Promise((resolve) => { started = resolve; });
  const pendingResponse = new Promise((resolve) => { release = resolve; });
  let requests = 0;
  const access = createZbsTokens({ rpc: store.rpc, vault, now: () => instant, fetchFn: async (url, options) => {
    requests++;
    assert.equal(url, 'https://oauth.zaloapp.com/v4/oa/access_token');
    assert.equal(options.headers.secret_key, 'secret-key');
    assert.equal(options.body.get('refresh_token'), 'single-use-refresh');
    assert.equal(options.body.get('grant_type'), 'refresh_token');
    started(); return pendingResponse;
  } });
  const first = access('oa');
  await requestStarted;
  await assert.rejects(access('oa'), /refresh pending/);
  assert.equal(requests, 1);
  release(new Response(JSON.stringify({ access_token: 'new-access', refresh_token: 'rotated-refresh', expires_in: 3600 })));
  assert.equal(await first, 'new-access');
  const saved = JSON.parse(store.row.ciphertext);
  assert.equal(saved.refreshToken, 'rotated-refresh');
  assert.equal(saved.expiresAt, instant + 3_600_000);
  assert.equal(saved.appId, initialSecret.appId);
  assert.equal(await access('oa'), 'new-access');
  assert.equal(requests, 1);
  assert.equal(store.calls.filter((call) => call.name === 'center_finish_token_refresh').length, 1);
  assert.equal(store.calls.some((call) => call.name === 'center_mark_reconnect'), false);
});

test('an uncertain refresh marks reconnect and never repeats the consumed token request', async () => {
  const store = tokenStore(); let requests = 0;
  const access = createZbsTokens({ rpc: store.rpc, vault, now: () => instant, fetchFn: async () => { requests++; throw new Error('connection lost after request'); } });
  await assert.rejects(access('oa'), /token refresh could not be confirmed/);
  assert.equal(store.row.status, 'reconnect_required');
  await assert.rejects(access('oa'), /OA is not connected/);
  assert.equal(requests, 1);
  assert.equal(store.calls.filter((call) => call.name === 'center_mark_reconnect').length, 1);
  assert.equal(store.calls.some((call) => call.name === 'center_finish_token_refresh'), false);
});
