// Local-only fixture transport for the production welcome dismissal component.
import http from 'node:http';
const userId = '00000000-0000-0000-0000-000000000073';
let preferences = {first_dashboard_visit: true, daily_goal_minutes: 20, locale: 'vi', fixture_marker: 'preserve-me'};
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', 'http://127.0.0.1:3073');
  res.setHeader('Access-Control-Allow-Headers', 'authorization, apikey, content-type, prefer, x-client-info');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PATCH, OPTIONS');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') { res.end(); return; }
  const url = new URL(req.url, 'http://127.0.0.1:3074');
  if (url.pathname === '/fixture/preferences' && req.method === 'GET') {
    res.end(JSON.stringify(preferences)); return;
  }
  if (url.pathname === '/rest/v1/profiles' && url.searchParams.get('id') === `eq.${userId}`) {
    if (req.method === 'PATCH') {
      let body = ''; for await (const chunk of req) body += chunk;
      preferences = JSON.parse(body).preferences;
    }
    res.end(JSON.stringify({id: userId, preferences})); return;
  }
  res.statusCode = 503;
  res.end(JSON.stringify({message: 'Mocked local QA: source unavailable'}));
});
server.listen(3074, '127.0.0.1', () => console.log('Learner home mock REST: loopback 3074, synthetic account only'));
