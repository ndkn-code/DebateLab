// Loopback-only, synthetic QA provider. No credentials or production data.
import http from 'node:http';
let mode = 'healthy';
const user = { id: '00000000-0000-4000-8000-000000000074', aud: 'authenticated', role: 'authenticated', email: 'auth-shell-fixture@example.invalid', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
const counts = {};
http.createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1:54329');
  res.setHeader('Content-Type', 'application/json');
  if (url.pathname === '/__qa') {
    if (url.searchParams.has('mode')) { mode = url.searchParams.get('mode'); for (const key of Object.keys(counts)) delete counts[key]; }
    return res.end(JSON.stringify({ mode, counts }));
  }
  counts[url.pathname] = (counts[url.pathname] ?? 0) + 1;
  if (url.pathname.startsWith('/auth/')) {
    if (mode === 'hang') return;
    if (mode === 'expired') { res.statusCode = 401; return res.end(JSON.stringify({ code: 'bad_jwt', msg: 'Invalid JWT' })); }
    if (mode === 'unavailable') { res.statusCode = 503; return res.end(JSON.stringify({ code: 'unexpected_failure', msg: 'Fixture dependency unavailable' })); }
    return res.end(JSON.stringify(user));
  }
  if (url.pathname === '/rest/v1/profiles') {
    if (mode === 'profile-error') { res.statusCode = 503; return res.end(JSON.stringify({ code: 'fixture_failure', message: 'Fixture profile unavailable' })); }
    return res.end(JSON.stringify({ id: user.id, role: 'user', display_name: 'QA fixture', onboarding_completed: true, preferences: {}, orb_balance: 0, xp: 0, level: 1 }));
  }
  if (url.pathname === '/rest/v1/club_memberships' && mode === 'optional-error') return;
  res.setHeader('Content-Range', '*/0');
  return res.end(JSON.stringify([]));
}).listen(54329, '127.0.0.1', () => console.log('Synthetic auth fixture listening on 127.0.0.1:54329'));
