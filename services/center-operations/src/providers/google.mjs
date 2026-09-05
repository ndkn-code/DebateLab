const CALENDAR_ORIGIN = 'https://www.googleapis.com/calendar/v3';
const SHEETS_ORIGIN = 'https://sheets.googleapis.com/v4';
const DRIVE_ORIGIN = 'https://www.googleapis.com/drive/v3';
const TOKEN_ORIGIN = 'https://oauth2.googleapis.com/token';
const AUTH_ORIGIN = 'https://accounts.google.com/o/oauth2/v2/auth';
const DEFAULT_TIMEOUT_MS = 15_000;

export class GoogleApiError extends Error {
  constructor(message, { status = 0, code, details, retryable, requiresReconnect, syncReset, conflict } = {}) {
    super(message);
    this.name = 'GoogleApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.retryable = retryable ?? (status === 408 || status === 429 || status >= 500);
    this.requiresReconnect = requiresReconnect ?? status === 401;
    this.syncReset = syncReset ?? status === 410;
    this.conflict = conflict ?? status === 412;
  }
}

const encoded = (value) => encodeURIComponent(String(value));

async function parseResponse(response) {
  const contentType = response.headers?.get?.('content-type') || '';
  if (contentType.includes('application/json')) return response.json();
  const text = await response.text();
  return text || null;
}

export function createGoogleProvider({ accessToken, fetchFn = globalThis.fetch, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  if (typeof fetchFn !== 'function') throw new TypeError('fetchFn is required');
  if (!accessToken) throw new TypeError('accessToken is required');

  async function request(url, { method = 'GET', body, headers = {}, query, raw = false } = {}) {
    const target = new URL(url);
    if (query) for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') target.searchParams.set(key, String(value));
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchFn(target, {
        method,
        headers: { Authorization: `Bearer ${accessToken}`, ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...headers },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: controller.signal,
      });
      if (!response.ok) {
        let parsed;
        try { parsed = await parseResponse(response); } catch { parsed = undefined; }
        const errorBody = parsed?.error || parsed;
        throw new GoogleApiError(errorBody?.message || `Google API request failed (${response.status})`, {
          status: response.status, code: errorBody?.code, details: errorBody,
        });
      }
      return raw ? response : parseResponse(response);
    } catch (error) {
      if (error instanceof GoogleApiError) throw error;
      if (error?.name === 'AbortError') throw new GoogleApiError('Google API request timed out', { retryable: true });
      throw new GoogleApiError(error?.message || 'Google API request failed', { retryable: true });
    } finally { clearTimeout(timer); }
  }

  return {
    listCalendars: () => request(`${CALENDAR_ORIGIN}/users/me/calendarList`),
    createCalendar: ({ summary, timeZone }) => request(`${CALENDAR_ORIGIN}/calendars`, { method: 'POST', body: { summary, timeZone } }),
    getEvent: (calendarId, eventId) => request(`${CALENDAR_ORIGIN}/calendars/${encoded(calendarId)}/events/${encoded(eventId)}`),
    createEvent: (calendarId, event, { idempotencyKey, sendUpdates = 'none' } = {}) => {
      const body = { ...event };
      if (idempotencyKey) body.id = deterministicEventId(idempotencyKey);
      return request(`${CALENDAR_ORIGIN}/calendars/${encoded(calendarId)}/events`, { method: 'POST', query: { sendUpdates }, body });
    },
    updateEvent: (calendarId, eventId, event, { etag, sendUpdates = 'none' } = {}) => request(`${CALENDAR_ORIGIN}/calendars/${encoded(calendarId)}/events/${encoded(eventId)}`, {
      method: 'PATCH', query: { sendUpdates }, headers: etag ? { 'If-Match': etag } : {}, body: event,
    }),
    listEvents: (calendarId, { syncToken, pageToken } = {}) => request(`${CALENDAR_ORIGIN}/calendars/${encoded(calendarId)}/events`, { query: { syncToken, pageToken } }),
    listOccurrences: (calendarId, { timeMin, timeMax, pageToken } = {}) => request(`${CALENDAR_ORIGIN}/calendars/${encoded(calendarId)}/events`, { query: { singleEvents: true, showDeleted: true, maxResults: 2500, timeMin, timeMax, pageToken } }),
    watchEvents: (calendarId, { id, token, address, expiration } = {}) => request(`${CALENDAR_ORIGIN}/calendars/${encoded(calendarId)}/events/watch`, { method: 'POST', body: { id, token, address, expiration } }),
    stopChannel: ({ id, resourceId }) => request(`${CALENDAR_ORIGIN}/channels/stop`, { method: 'POST', body: { id, resourceId } }),
    freeBusy: ({ timeMin, timeMax, calendarIds = [] }) => request(`${CALENDAR_ORIGIN}/freeBusy`, { method: 'POST', body: { timeMin, timeMax, items: calendarIds.map((id) => ({ id })) } }),
    readSheet: (spreadsheetId, range) => request(`${SHEETS_ORIGIN}/spreadsheets/${encoded(spreadsheetId)}/values/${encoded(range)}`, { query: { valueRenderOption: 'UNFORMATTED_VALUE' } }),
    writeSheet: (spreadsheetId, range, values) => request(`${SHEETS_ORIGIN}/spreadsheets/${encoded(spreadsheetId)}/values/${encoded(range)}`, { method: 'PUT', query: { valueInputOption: 'RAW' }, body: { range, majorDimension: 'ROWS', values } }),
    getFile: (fileId) => request(`${DRIVE_ORIGIN}/files/${encoded(fileId)}`, { query: { fields: 'id,name,mimeType,size,modifiedTime,webViewLink,parents,trashed' } }),
    downloadFile: async (fileId, mimeType) => {
      const endpoint = mimeType ? `${DRIVE_ORIGIN}/files/${encoded(fileId)}/export` : `${DRIVE_ORIGIN}/files/${encoded(fileId)}`;
      const response = await request(endpoint, { query: mimeType ? { mimeType } : { alt: 'media' }, raw: true });
      return response.arrayBuffer();
    },
    listFileChanges: ({ pageToken }) => request(`${DRIVE_ORIGIN}/changes`, { query: { pageToken, spaces: 'drive', fields: 'nextPageToken,newStartPageToken,changes(fileId,removed,file(id,name,mimeType,modifiedTime,parents,webViewLink))' } }),
  };
}

export function deterministicEventId(idempotencyKey) {
  let hash = 2166136261;
  for (const byte of new TextEncoder().encode(String(idempotencyKey))) { hash ^= byte; hash = Math.imul(hash, 16777619); }
  return `thinkfy-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function buildGoogleAuthorizationUrl({ clientId, redirectUri, state, scopes, codeChallenge }) {
  const url = new URL(AUTH_ORIGIN);
  url.search = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: 'code', access_type: 'offline', prompt: 'consent', scope: scopes.join(' '), state, code_challenge: codeChallenge, code_challenge_method: 'S256' }).toString();
  return url.toString();
}

async function tokenRequest(body, fetchFn = globalThis.fetch) {
  const response = await fetchFn(TOKEN_ORIGIN, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(body) });
  const payload = await parseResponse(response);
  if (!response.ok) throw new GoogleApiError(payload?.error_description || 'Google OAuth request failed', { status: response.status, details: payload });
  return payload;
}

export const exchangeGoogleCode = ({ clientId, clientSecret, code, redirectUri, codeVerifier, fetchFn }) => tokenRequest({ client_id: clientId, client_secret: clientSecret, code, redirect_uri: redirectUri, grant_type: 'authorization_code', code_verifier: codeVerifier }, fetchFn);
export const refreshGoogleToken = ({ clientId, clientSecret, refreshToken, fetchFn }) => tokenRequest({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' }, fetchFn);
