import assert from 'node:assert/strict';
import test from 'node:test';
import { createKmsVault, getMetadataAccessToken } from './vault.mjs';

const keyName = 'projects/demo/locations/us/keyRings/center/cryptoKeys/oauth';

test('uses only configured key and binds canonical context as AAD', async () => {
  const calls = [];
  const vault = createKmsVault({ keyName, accessToken: async () => 'token', fetchFn: async (url, init) => { calls.push({ url, init }); return new Response(JSON.stringify({ ciphertext: 'cipher' }), { status: 200 }); } });
  const encrypted = await vault.encrypt('secret', { state: 'abc', connectionId: 'c1' });
  assert.deepEqual(encrypted, { ciphertext: 'cipher', keyName });
  assert.equal(calls[0].url, `https://cloudkms.googleapis.com/v1/${keyName}:encrypt`);
  const body = JSON.parse(calls[0].init.body);
  assert.equal(body.plaintext, Buffer.from('secret').toString('base64'));
  assert.ok(body.additionalAuthenticatedData);
  await assert.rejects(() => vault.decrypt({ ciphertext: 'cipher', keyName: 'projects/other/locations/us/keyRings/x/cryptoKeys/y' }, { state: 'abc' }), /Ciphertext is invalid/);
});

test('does not include plaintext in KMS errors and bounds input', async () => {
  const vault = createKmsVault({ keyName, accessToken: async () => 'token', fetchFn: async () => new Response('nope', { status: 500 }) });
  await assert.rejects(() => vault.encrypt('top-secret'), (error) => error.message === 'KMS encrypt failed' && !error.message.includes('top-secret'));
  await assert.rejects(() => vault.encrypt('x'.repeat(64 * 1024 + 1)), /too large/);
  assert.throws(() => createKmsVault({ keyName: 'https://evil.example/key', accessToken: async () => 'x' }), /Invalid KMS key name/);
});

test('metadata helper uses the fixed Google metadata endpoint and header', async () => {
  let request;
  const token = await getMetadataAccessToken(async (url, init) => { request = { url, init }; return new Response(JSON.stringify({ access_token: 'metadata-token' }), { status: 200 }); });
  assert.equal(token, 'metadata-token');
  assert.equal(request.url, 'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token');
  assert.equal(request.init.headers['Metadata-Flavor'], 'Google');
});
