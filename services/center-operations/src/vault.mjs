const KEY_PATTERN = /^projects\/[^/]+\/locations\/[^/]+\/keyRings\/[^/]+\/cryptoKeys\/[^/]+$/;
const KMS_ORIGIN = 'https://cloudkms.googleapis.com/v1/';
const METADATA_URL = 'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token';
const MAX_PLAINTEXT_BYTES = 64 * 1024;
const TIMEOUT_MS = 10_000;

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`;
  return JSON.stringify(value);
}

function aad(context) {
  if (context === undefined) return undefined;
  const value = canonical(context);
  return Buffer.from(value, 'utf8').toString('base64');
}

async function metadataAccessToken(fetchFn) {
  const response = await fetchFn(METADATA_URL, { headers: { 'Metadata-Flavor': 'Google' } });
  if (!response.ok) throw new Error('Metadata token unavailable');
  const payload = await response.json();
  if (typeof payload?.access_token !== 'string' || !payload.access_token) throw new Error('Metadata token unavailable');
  return payload.access_token;
}

export function getMetadataAccessToken(fetchFn = globalThis.fetch) {
  if (typeof fetchFn !== 'function') throw new TypeError('fetchFn is required');
  return metadataAccessToken(fetchFn);
}

export function createKmsVault({ keyName, accessToken, fetchFn = globalThis.fetch, timeoutMs = TIMEOUT_MS }) {
  if (typeof keyName !== 'string' || !KEY_PATTERN.test(keyName)) throw new TypeError('Invalid KMS key name');
  if (typeof accessToken !== 'function' || typeof fetchFn !== 'function') throw new TypeError('accessToken and fetchFn are required');

  async function request(operation, body) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const token = await accessToken();
      const response = await fetchFn(`${KMS_ORIGIN}${keyName}:${operation}`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify(body), signal: controller.signal,
      });
      if (!response.ok) throw new Error(`KMS ${operation} failed`);
      const payload = await response.json();
      if (typeof payload?.ciphertext !== 'string' && typeof payload?.plaintext !== 'string') throw new Error(`KMS ${operation} returned invalid data`);
      return payload;
    } catch (error) {
      if (error?.name === 'AbortError') throw new Error('KMS request timed out');
      throw new Error(error instanceof Error && error.message.startsWith('KMS ') ? error.message : `KMS ${operation} failed`);
    } finally { clearTimeout(timer); }
  }

  return {
    async encrypt(plaintext, context) {
      if (typeof plaintext !== 'string' || Buffer.byteLength(plaintext, 'utf8') > MAX_PLAINTEXT_BYTES) throw new Error('Plaintext is invalid or too large');
      const payload = { plaintext: Buffer.from(plaintext, 'utf8').toString('base64') };
      const authenticated = aad(context);
      if (authenticated) payload.additionalAuthenticatedData = authenticated;
      const result = await request('encrypt', payload);
      return { ciphertext: result.ciphertext, keyName };
    },
    async decrypt({ ciphertext, keyName: requestedKeyName }, context) {
      if (requestedKeyName !== keyName || typeof ciphertext !== 'string' || ciphertext.length > 200_000) throw new Error('Ciphertext is invalid');
      const payload = { ciphertext };
      const authenticated = aad(context);
      if (authenticated) payload.additionalAuthenticatedData = authenticated;
      const result = await request('decrypt', payload);
      try { return Buffer.from(result.plaintext, 'base64').toString('utf8'); } catch { throw new Error('KMS decrypt failed'); }
    },
  };
}

export const kmsKeyNamePattern = KEY_PATTERN;
