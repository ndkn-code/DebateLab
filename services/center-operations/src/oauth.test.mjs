import assert from 'node:assert/strict';
import test from 'node:test';
import { createOAuthService } from './oauth.mjs';

const cfg = { clientId: 'client', clientSecret: 'secret', redirectUri: 'https://app.test/oauth' };
const cryptoBox = () => ({
  async encrypt(value) { return { ciphertext: `enc:${value}`, keyName: 'test-key' }; },
  async decrypt({ ciphertext }) { return ciphertext.slice(4); },
});

test('start persists only a hash and callback is single use through RPC', async () => {
  const calls = [];
  const box = cryptoBox();
  const service = createOAuthService({ googleConfig: cfg, encrypt: box.encrypt, decrypt: box.decrypt, rpc: async (name, args) => { calls.push({ name, args }); if (name === 'center_oauth_begin') return { connectionId: 'c1' }; if (name === 'center_oauth_consume') return { clubId: 'club', actorId: 'actor', connectionId: 'c1', ciphertext: 'enc:verifier', keyName: 'test-key', scopes: ['https://www.googleapis.com/auth/calendar.app.created'] }; if (name === 'center_store_credentials') return {}; }, fetchFn: async () => new Response(JSON.stringify({ access_token: 'access', refresh_token: 'refresh', expires_in: 3600, scope: 'https://www.googleapis.com/auth/calendar.app.created' }), { status: 200, headers: { 'content-type': 'application/json' } }) });
  const started = await service.start({ clubId: 'club', actorId: 'actor' });
  const state = new URL(started.url).searchParams.get('state');
  assert.ok(state);
  assert.notEqual(calls[0].args.p_state_hash, state);
  const result = await service.callback({ state, code: 'code' });
  assert.deepEqual(result, { clubId: 'club', connectionId: 'c1' });
  assert.equal(calls.some((call) => call.name === 'center_store_credentials' && JSON.stringify(call.args).includes('refresh')), true);
});

test('rejects missing granted scopes and never stores credentials', async () => {
  let stored = false;
  const box = cryptoBox();
  const service = createOAuthService({ googleConfig: cfg, encrypt: box.encrypt, decrypt: box.decrypt, rpc: async (name) => { if (name === 'center_oauth_consume') return { clubId: 'club', actorId: 'actor', connectionId: 'c1', ciphertext: 'enc:v', keyName: 'k', scopes: ['https://www.googleapis.com/auth/calendar.app.created', 'https://www.googleapis.com/auth/drive.file'] }; if (name === 'center_store_credentials') stored = true; }, fetchFn: async () => new Response(JSON.stringify({ access_token: 'a', refresh_token: 'r', scope: 'https://www.googleapis.com/auth/calendar.app.created' }), { status: 200, headers: { 'content-type': 'application/json' } }) });
  await assert.rejects(() => service.callback({ state: 'state', code: 'code' }), /did not grant/);
  assert.equal(stored, false);
});

test('marks reconnect on invalid grant and does not leak token data', async () => {
  const calls = [];
  const box = cryptoBox();
  const service = createOAuthService({ googleConfig: cfg, encrypt: box.encrypt, decrypt: box.decrypt, rpc: async (name, args) => { calls.push({ name, args }); if (name === 'center_load_credentials') return { connectionId: 'c1', ciphertext: 'enc:' + JSON.stringify({ access_token: 'old', refresh_token: 'refresh', expires_at: 0 }), keyName: 'k', updatedAt: 'now' }; if (name === 'center_mark_reconnect') return {}; }, fetchFn: async () => new Response(JSON.stringify({ error: 'invalid_grant', error_description: 'revoked' }), { status: 400, headers: { 'content-type': 'application/json' } }) });
  await assert.rejects(() => service.getGoogleAccessToken('c1'), /revoked/);
  assert.equal(calls.at(-1).name, 'center_mark_reconnect');
  assert.equal(JSON.stringify(calls).includes('refresh'), false);
});
