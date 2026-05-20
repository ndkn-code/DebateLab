import { createSign } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { TTSVoice } from "@/lib/tts-voices";

const GOOGLE_TOKEN_URI = "https://oauth2.googleapis.com/token";
const GOOGLE_TTS_SCOPE = "https://www.googleapis.com/auth/cloud-platform";

interface GoogleServiceAccount {
  client_email: string;
  private_key: string;
  token_uri?: string;
}

interface GoogleTokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

let cachedGoogleToken: { accessToken: string; expiresAt: number } | null = null;

export function escapeSsml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function buildAzureSsml(text: string, voice: TTSVoice) {
  const escapedText = escapeSsml(text);
  return `<speak version="1.0" xml:lang="${voice.locale}"><voice xml:lang="${voice.locale}" name="${voice.id}">${escapedText}</voice></speak>`;
}

function base64Url(input: Buffer | string) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function arrayBufferFromBuffer(buffer: Buffer) {
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength
  ) as ArrayBuffer;
}

export function parseGoogleServiceAccount(raw: string) {
  const parsed = JSON.parse(raw) as Partial<GoogleServiceAccount>;
  if (!parsed.client_email || !parsed.private_key) {
    throw new Error("GOOGLE_TTS_INVALID_SERVICE_ACCOUNT");
  }

  return {
    client_email: parsed.client_email,
    private_key: parsed.private_key.replace(/\\n/g, "\n"),
    token_uri: parsed.token_uri || GOOGLE_TOKEN_URI,
  } satisfies GoogleServiceAccount;
}

function extractJsonObjectFromText(text: string) {
  const start = text.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const char = text[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
    } else if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return text.slice(start, index + 1);
      }
    }
  }

  return null;
}

async function readGoogleServiceAccountFromEnvFiles() {
  if (process.env.NODE_ENV === "production") return null;

  for (const envFile of [".env.local", ".env"]) {
    let contents: string;
    try {
      contents = await readFile(envFile, "utf8");
    } catch {
      continue;
    }

    const marker = "GOOGLE_TTS_SERVICE_ACCOUNT_JSON=";
    const markerIndex = contents.indexOf(marker);
    if (markerIndex === -1) continue;

    const rawValue = contents.slice(markerIndex + marker.length);
    const json = extractJsonObjectFromText(rawValue);
    if (!json) continue;

    return parseGoogleServiceAccount(json);
  }

  return null;
}

async function readGoogleServiceAccount() {
  const inlineJson = process.env.GOOGLE_TTS_SERVICE_ACCOUNT_JSON;
  if (inlineJson) {
    try {
      return parseGoogleServiceAccount(inlineJson);
    } catch (error) {
      const envFileServiceAccount = await readGoogleServiceAccountFromEnvFiles();
      if (envFileServiceAccount) return envFileServiceAccount;
      throw error;
    }
  }

  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!credentialsPath) {
    throw new Error("GOOGLE_TTS_MISSING_CONFIG");
  }

  return parseGoogleServiceAccount(await readFile(credentialsPath, "utf8"));
}

export function buildGoogleJwtAssertion(serviceAccount: GoogleServiceAccount) {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64Url(
    JSON.stringify({
      iss: serviceAccount.client_email,
      scope: GOOGLE_TTS_SCOPE,
      aud: serviceAccount.token_uri || GOOGLE_TOKEN_URI,
      iat: nowSeconds,
      exp: nowSeconds + 3600,
    })
  );
  const unsignedToken = `${header}.${payload}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsignedToken);
  signer.end();
  const signature = signer.sign(serviceAccount.private_key);

  return `${unsignedToken}.${base64Url(signature)}`;
}

export function buildGoogleSynthesizeRequest(text: string, voice: TTSVoice) {
  return {
    input: { text },
    voice: {
      languageCode: voice.locale,
      name: voice.id,
    },
    audioConfig: {
      audioEncoding: "MP3",
    },
  };
}

async function getGoogleAccessToken() {
  const now = Date.now();
  if (cachedGoogleToken && cachedGoogleToken.expiresAt > now + 60_000) {
    return cachedGoogleToken.accessToken;
  }

  const serviceAccount = await readGoogleServiceAccount();
  const assertion = buildGoogleJwtAssertion(serviceAccount);
  const response = await fetch(serviceAccount.token_uri || GOOGLE_TOKEN_URI, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const token = (await response.json()) as GoogleTokenResponse;

  if (!response.ok || !token.access_token) {
    if (process.env.NODE_ENV === "development") {
      console.error("Google TTS auth error:", token);
    }
    throw new Error("GOOGLE_TTS_AUTH_FAILED");
  }

  cachedGoogleToken = {
    accessToken: token.access_token,
    expiresAt: now + (token.expires_in ?? 3600) * 1000,
  };

  return token.access_token;
}

export async function synthesizeDeepgram(text: string, voiceId: string): Promise<ArrayBuffer> {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    throw new Error("DEEPGRAM_TTS_MISSING_API_KEY");
  }

  const response = await fetch(
    `https://api.deepgram.com/v1/speak?model=${encodeURIComponent(voiceId)}&encoding=mp3`,
    {
      method: "POST",
      headers: {
        Authorization: `Token ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    if (process.env.NODE_ENV === "development") console.error("Deepgram TTS error:", error);
    throw new Error("DEEPGRAM_TTS_FAILED");
  }

  return response.arrayBuffer();
}

export async function synthesizeAzure(text: string, voice: TTSVoice): Promise<ArrayBuffer> {
  const apiKey = process.env.AZURE_SPEECH_KEY;
  const region = process.env.AZURE_SPEECH_REGION;
  if (!apiKey || !region) {
    throw new Error("AZURE_TTS_MISSING_CONFIG");
  }

  const response = await fetch(
    `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`,
    {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": apiKey,
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
        "User-Agent": "Thinkfy",
      },
      body: buildAzureSsml(text, voice),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    if (process.env.NODE_ENV === "development") console.error("Azure TTS error:", error);
    throw new Error("AZURE_TTS_FAILED");
  }

  return response.arrayBuffer();
}

export async function synthesizeGoogle(text: string, voice: TTSVoice): Promise<ArrayBuffer> {
  const accessToken = await getGoogleAccessToken();
  const response = await fetch("https://texttospeech.googleapis.com/v1/text:synthesize", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(buildGoogleSynthesizeRequest(text, voice)),
  });
  const body = (await response.json()) as { audioContent?: string; error?: unknown };

  if (!response.ok || !body.audioContent) {
    if (process.env.NODE_ENV === "development") {
      console.error("Google TTS error:", body);
    }
    throw new Error("GOOGLE_TTS_FAILED");
  }

  return arrayBufferFromBuffer(Buffer.from(body.audioContent, "base64"));
}

export async function synthesizeTtsVoice(text: string, voice: TTSVoice): Promise<ArrayBuffer> {
  if (voice.provider === "azure") {
    return synthesizeAzure(text, voice);
  }

  if (voice.provider === "google") {
    return synthesizeGoogle(text, voice);
  }

  return synthesizeDeepgram(text, voice.id);
}
