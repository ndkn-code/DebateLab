import { createHash, randomBytes } from 'node:crypto';
import {
  buildGoogleAuthorizationUrl,
  exchangeGoogleCode,
  refreshGoogleToken,
} from './providers/google.mjs';

const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.app.created';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const ALLOWED_SCOPES = new Set([CALENDAR_SCOPE, DRIVE_SCOPE,"https://www.googleapis.com/auth/calendar.events","https://www.googleapis.com/auth/calendar.calendarlist.readonly"]);
const DEFAULT_SCOPES = [CALENDAR_SCOPE, DRIVE_SCOPE];

const encoded = (bytes) => bytes.toString('base64url');
const stateHash = (state) => createHash('sha256').update(state).digest('hex');
const parseScopes = (scopes) => [...new Set(scopes?.length ? scopes : DEFAULT_SCOPES)];
const assertScopes = (scopes) => {
  const normalized = parseScopes(scopes);
  if (normalized.some((scope) => !ALLOWED_SCOPES.has(scope))) throw new Error('Unsupported Google scope');
  return normalized;
};

export function createOAuthService({ rpc, encrypt, decrypt, googleConfig, fetchFn = globalThis.fetch, now = () => Date.now() }) {
  if (typeof rpc !== 'function' || typeof encrypt !== 'function' || typeof decrypt !== 'function') throw new TypeError('rpc, encrypt, and decrypt are required');
  if (!googleConfig?.clientId || !googleConfig.clientSecret || !googleConfig.redirectUri) throw new TypeError('Google OAuth configuration is required');

  async function start({ clubId, actorId, scopes }) {
    const requestedScopes = assertScopes(scopes);
    const state = encoded(randomBytes(32));
    const verifier = encoded(randomBytes(32));
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    const encrypted = await encrypt(verifier, { purpose: 'center-oauth-pkce', clubId, actorId });
    await rpc('center_oauth_begin', { p_club_id: clubId, p_actor_id: actorId, p_state_hash: stateHash(state), p_ciphertext: encrypted.ciphertext, p_key_name: encrypted.keyName, p_scopes: requestedScopes });
    return { url: buildGoogleAuthorizationUrl({ clientId: googleConfig.clientId, redirectUri: googleConfig.redirectUri, state, scopes: requestedScopes, codeChallenge: challenge }) };
  }

  async function callback({ state, code }) {
    if (typeof state !== 'string' || !state || typeof code !== 'string' || !code) throw new Error('Invalid OAuth callback');
    const intent = await rpc('center_oauth_consume', { p_state_hash: stateHash(state) });
    if (!intent?.clubId || !intent.connectionId || !intent.ciphertext || !intent.keyName) throw new Error('OAuth intent is invalid or expired');
    const verifier = await decrypt({ ciphertext: intent.ciphertext, keyName: intent.keyName }, { purpose: 'center-oauth-pkce', clubId: intent.clubId, actorId: intent.actorId });
    const tokens = await exchangeGoogleCode({ ...googleConfig, code, codeVerifier: verifier, fetchFn });
    const granted = new Set(String(tokens.scope || '').split(' ').filter(Boolean));
    const requested = assertScopes(intent.scopes);
    if (requested.some((scope) => !granted.has(scope))) throw new Error('Google did not grant all requested scopes');
    if (!tokens.refresh_token) throw new Error('Google did not return a refresh token');
    const encrypted = await encrypt(JSON.stringify({ access_token: tokens.access_token, refresh_token: tokens.refresh_token, expires_at: now() + Number(tokens.expires_in || 3600) * 1000 }), { purpose: 'center-google-tokens', connectionId: intent.connectionId });
    await rpc('center_store_credentials', { p_connection_id: intent.connectionId, p_actor_id: intent.actorId, p_ciphertext: encrypted.ciphertext, p_key_name: encrypted.keyName, p_scopes: requested, p_account_label: tokens.email || 'Google account' });
    return { clubId: intent.clubId, connectionId: intent.connectionId };
  }

  async function getGoogleAccessToken(connectionId) {
    const row = await rpc('center_load_credentials', { p_connection_id: connectionId });
    if (!row?.ciphertext || !row.keyName || !row.connectionId) throw new Error('Google connection is unavailable');
    const tokens = JSON.parse(await decrypt({ ciphertext: row.ciphertext, keyName: row.keyName }, { purpose: 'center-google-tokens', connectionId }));
    if (tokens.expires_at && Number(tokens.expires_at) > now() + 60_000) return tokens.access_token;
    try {
      const refreshed = await refreshGoogleToken({ ...googleConfig, refreshToken: tokens.refresh_token, fetchFn });
      const next = { access_token: refreshed.access_token, refresh_token: tokens.refresh_token, expires_at: now() + Number(refreshed.expires_in || 3600) * 1000 };
      const encrypted = await encrypt(JSON.stringify(next), { purpose: 'center-google-tokens', connectionId });
      const saved = await rpc('center_refresh_credentials', { p_connection_id: connectionId, p_ciphertext: encrypted.ciphertext, p_key_name: encrypted.keyName, p_expected_updated_at: row.updatedAt });
      if (saved?.ciphertext && saved.keyName) return JSON.parse(await decrypt({ ciphertext: saved.ciphertext, keyName: saved.keyName }, { purpose: 'center-google-tokens', connectionId })).access_token;
      return next.access_token;
    } catch (error) {
      const details = error?.details;
      if (details?.error === 'invalid_grant' || error?.code === 'invalid_grant') await rpc('center_mark_reconnect', { p_connection_id: connectionId });
      throw error;
    }
  }

  return { start, callback, getGoogleAccessToken };
}
