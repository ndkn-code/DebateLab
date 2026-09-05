import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGoogleAuthorizationUrl, createGoogleProvider, deterministicEventId, GoogleApiError } from './google.mjs';

function mockFetch(responses) {
  const calls = [];
  const fetchFn = async (url, options) => {
    calls.push({ url: String(url), options });
    const next = responses.shift();
    if (next instanceof Error) throw next;
    return new Response(next?.body === undefined ? '{}' : JSON.stringify(next.body), {
      status: next?.status ?? 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  return { fetchFn, calls };
}

test('calendar requests encode identifiers, use bearer auth, and deterministic event ids', async () => {
  const mock = mockFetch([{ body: { id: 'event' } }]);
  const provider = createGoogleProvider({ accessToken: 'token', fetchFn: mock.fetchFn });
  await provider.createEvent('team/a', { summary: 'Hello' }, { idempotencyKey: 'signup:42' });
  const call = mock.calls[0];
  assert.match(call.url, /calendars\/team%2Fa\/events\?sendUpdates=none$/);
  assert.equal(call.options.headers.Authorization, 'Bearer token');
  assert.equal(JSON.parse(call.options.body).id, deterministicEventId('signup:42'));
  assert.match(JSON.parse(call.options.body).id, /^[0-9a-f]{64}$/);
  const watchMock = mockFetch([{ body: { resourceId: 'resource' } }]);
  const watchProvider = createGoogleProvider({ accessToken: 'token', fetchFn: watchMock.fetchFn });
  await watchProvider.watchEvents('team/a', { id: 'channel', token: 'opaque', address: 'https://example.test/callback', expiration: '2099-01-01T00:00:00Z' });
  const watchBody = JSON.parse(watchMock.calls[0].options.body);
  assert.equal(watchBody.type, 'web_hook');
  assert.equal(watchBody.id, 'channel');
  assert.equal(watchBody.address, 'https://example.test/callback');
});

test('event ids are stable, full length, and collision-resistant', () => {
  const first = deterministicEventId('signup:42');
  assert.equal(first, deterministicEventId('signup:42'));
  assert.equal(first.length, 64);
  assert.match(first, /^[0-9a-f]+$/);
  assert.notEqual(first, deterministicEventId('signup:43'));
});

test('maps reconnect, sync reset, and etag conflicts without retrying mutations', async () => {
  for (const [status, field] of [[401, 'requiresReconnect'], [410, 'syncReset'], [412, 'conflict']]) {
    const mock = mockFetch([{ status, body: { error: { message: 'failure' } } }]);
    const provider = createGoogleProvider({ accessToken: 'token', fetchFn: mock.fetchFn });
    await assert.rejects(provider.updateEvent('c', 'e', { summary: 'x' }, { etag: '"v1"' }), (error) => {
      assert.ok(error instanceof GoogleApiError); assert.equal(error.status, status); assert.equal(error[field], true); return true;
    });
    assert.equal(mock.calls.length, 1);
  }
});

test('preserves pagination tokens and uses Sheets render/input safety options', async () => {
  const mock = mockFetch([{ body: { nextPageToken: 'next', items: [] } }, { body: {} }, { body: { values: [['=SUM(A1:A2)']] } }]);
  const provider = createGoogleProvider({ accessToken: 'token', fetchFn: mock.fetchFn });
  await provider.listEvents('calendar', { syncToken: 'sync', pageToken: 'page' });
  await provider.writeSheet('sheet/id', 'Tab 1!A1:B2', [['=SUM(A1:A2)']]);
  await provider.readSheet('sheet/id', 'Tab 1!A1:B2');
  assert.match(mock.calls[0].url, /syncToken=sync&pageToken=page/);
  assert.match(mock.calls[1].url, /valueInputOption=RAW/);
  assert.equal(JSON.parse(mock.calls[1].options.body).values[0][0], '=SUM(A1:A2)');
  assert.match(mock.calls[2].url, /valueRenderOption=UNFORMATTED_VALUE/);
});

test('freeBusy sends calendar ids only and does not request personal details', async () => {
  const mock = mockFetch([{ body: { calendars: {} } }]);
  const provider = createGoogleProvider({ accessToken: 'token', fetchFn: mock.fetchFn });
  await provider.freeBusy({ timeMin: '2026-01-01T00:00:00Z', timeMax: '2026-01-02T00:00:00Z', calendarIds: ['a', 'b'] });
  const body = JSON.parse(mock.calls[0].options.body);
  assert.deepEqual(body.items, [{ id: 'a' }, { id: 'b' }]);
  assert.deepEqual(Object.keys(body), ['timeMin', 'timeMax', 'items']);
});

test('authorization URL carries offline PKCE parameters', () => {
  const url = new URL(buildGoogleAuthorizationUrl({ clientId: 'client', redirectUri: 'https://example.test/cb', state: 'state', scopes: ['scope:a', 'scope:b'], codeChallenge: 'challenge' }));
  assert.equal(url.origin, 'https://accounts.google.com');
  assert.equal(url.searchParams.get('access_type'), 'offline');
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(url.searchParams.get('scope'), 'scope:a scope:b');
});
